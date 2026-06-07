import { createHash } from "node:crypto";

import type { ObservedTopic } from "@prossimo-app/api";
import type {
  GtfsRealtimeAlert,
  GtfsRealtimeTripUpdate,
  GtfsRealtimeVehiclePosition,
} from "@prossimo-app/gtfs";
import {
  cacheAndPublishTopicPayload,
  getActiveObservedTopics,
} from "@prossimo-app/api";
import {
  createDbClient,
  getQueryRows,
  markMissingRealtimeAlertsEnded,
  markRealtimeAlertEnded,
  pruneEndedRealtimeAlerts,
  sql,
  upsertRealtimeAlert,
} from "@prossimo-app/db";
import {
  parseGtfsRealtimeAlerts,
  parseGtfsRealtimeFeedMetadata,
  parseGtfsRealtimeTripUpdates,
  parseGtfsRealtimeVehiclePositions,
} from "@prossimo-app/gtfs";
import { createRedisClientFromEnv } from "@prossimo-app/redis";

import type { ScheduledJob, WorkerContext } from "../scheduler.js";

const GTT_GTFS_REALTIME_BASE_URL =
  "https://percorsieorari.gtt.to.it/das_gtfsrt";
const GTFS_REALTIME_FETCH_TIMEOUT_MS = 10_000;
const GTT_GTFS_REALTIME_SOURCE = "gtt";
const DEFAULT_ALERT_RETENTION_DAYS = 90;
const GTFS_REALTIME_INCREMENTALITY_FULL_DATASET = 0;

const GTFS_REALTIME_FEEDS = {
  alerts: {
    intervalMs: 5 * 60 * 1000,
    name: "alerts",
    path: "alerts.aspx",
  },
  tripUpdates: {
    intervalMs: 15 * 1000,
    name: "trip-updates",
    path: "trip_update.aspx",
  },
  vehiclePositions: {
    intervalMs: 15 * 1000,
    name: "vehicle-positions",
    path: "vehicle_position.aspx",
  },
} as const;

type GtfsRealtimeFeedKey = keyof typeof GTFS_REALTIME_FEEDS;
type RouteType = "tram" | "bus" | "metro" | "rail" | "unknown";

interface StopArrivalsPayload {
  arrivals: {
    arrivalTime: number | null;
    departureTime: number | null;
    delaySeconds: number | null;
    directionName: string | null;
    routeId: string | null;
    routeColor: string | null;
    routeLongName: string | null;
    routeShortName: string | null;
    routeType: RouteType;
    routeTypeId: number | null;
    scheduledArrivalSeconds: number | null;
    scheduledDepartureSeconds: number | null;
    stopId: string;
    stopSequence: number | null;
    tripId: string | null;
    vehiclePosition: GtfsRealtimeVehiclePosition["position"];
    vehicleId: string | null;
  }[];
  fetchedAt: string;
  stopId: string;
}

interface RouteVehiclesPayload {
  fetchedAt: string;
  routeId: string;
  vehicles: {
    bearing: number | null;
    currentStopSequence: number | null;
    id: string;
    label: string | null;
    lat: number;
    lon: number;
    routeId: string | null;
    speed: number | null;
    stopId: string | null;
    timestamp: number | null;
    tripId: string | null;
    vehicleId: string | null;
  }[];
}

interface StaticStopTimeRow {
  observedStopId: string;
  observedTripId: string;
  routeColor: string | null;
  routeId: string;
  routeLongName: string | null;
  routeShortName: string | null;
  routeType: number | null;
  scheduledArrivalSeconds: number | null;
  scheduledDepartureSeconds: number | null;
  stopId: string;
  stopSequence: number;
  tripHeadsign: string | null;
  tripId: string;
}

interface ObservedStopArrivalCacheResult {
  activeTopics: number;
  skippedReason:
    | "no-active-stop-topics"
    | "no-redis"
    | "no-trip-updates"
    | null;
  staticStopTimeMatches: number;
  stopTopics: number;
  topics: string[];
  tripUpdates: number;
  updatedTopics: number;
  writtenArrivals: number;
}

interface AlertImportResult {
  alerts: number;
  deletedAlerts: number;
  endedAlerts: number;
  feedTimestamp: string | null;
  prunedAlerts: number;
  skippedReason: "no-db" | null;
  upsertedAlerts: number;
}

interface ObservedRouteVehiclesCacheResult {
  activeTopics: number;
  routeTopics: number;
  skippedReason: "no-active-route-topics" | "no-redis" | null;
  topics: string[];
  updatedTopics: number;
  vehiclePositions: number;
  writtenVehicles: number;
}

let redisClient: ReturnType<typeof createRedisClientFromEnv> | null | undefined;
let dbClient: ReturnType<typeof createDbClient> | null | undefined;
let latestTripUpdates: GtfsRealtimeTripUpdate[] = [];
let latestVehiclePositionsByTripId = new Map<
  string,
  GtfsRealtimeVehiclePosition
>();

function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  redisClient =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? createRedisClientFromEnv()
      : null;

  return redisClient;
}

function getDbClient() {
  if (dbClient !== undefined) {
    return dbClient;
  }

  dbClient = process.env.DATABASE_URL
    ? createDbClient(process.env.DATABASE_URL)
    : null;

  return dbClient;
}

function getFeedUrl(feedKey: GtfsRealtimeFeedKey) {
  const feed = GTFS_REALTIME_FEEDS[feedKey];

  return `${GTT_GTFS_REALTIME_BASE_URL}/${feed.path}`;
}

function getFetchErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;

  if (cause instanceof Error) {
    return `${error.message}: ${cause.message}`;
  }

  return error.message;
}

async function fetchWithTimeout(url: string, signal: AbortSignal) {
  const timeoutAbortController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutAbortController.abort(
      new Error(`Timed out after ${GTFS_REALTIME_FETCH_TIMEOUT_MS}ms`),
    );
  }, GTFS_REALTIME_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        accept: "application/x-protobuf, application/octet-stream, */*",
        "user-agent": "@prossimo-app/worker GTFS-RT poller",
      },
      signal: AbortSignal.any([signal, timeoutAbortController.signal]),
    });
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${getFetchErrorMessage(error)}`, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheActiveStopArrivals({
  activeTopics,
  fetchedAt,
}: {
  activeTopics?: ObservedTopic[];
  fetchedAt: string;
}) {
  const redis = getRedisClient();

  if (!redis) {
    return createObservedStopArrivalCacheResult({
      skippedReason: "no-redis",
    });
  }

  const topics = activeTopics ?? (await getActiveObservedTopics(redis));
  const stopTopics = topics.filter((topic) => topic.type === "stop");

  if (stopTopics.length === 0) {
    return createObservedStopArrivalCacheResult({
      activeTopics: topics.length,
      skippedReason: "no-active-stop-topics",
      topics: topics.map((topic) => `${topic.type}:${topic.id}`),
    });
  }

  if (latestTripUpdates.length === 0) {
    let updatedTopics = 0;

    for (const topic of stopTopics) {
      await cacheAndPublishTopicPayload({
        payload: {
          arrivals: [],
          fetchedAt,
          stopId: topic.id,
        } satisfies StopArrivalsPayload,
        redis,
        topic,
      });
      updatedTopics += 1;
    }

    return createObservedStopArrivalCacheResult({
      activeTopics: topics.length,
      skippedReason: "no-trip-updates",
      stopTopics: stopTopics.length,
      topics: stopTopics.map((topic) => `${topic.type}:${topic.id}`),
      updatedTopics,
    });
  }

  const staticStopTimesByTripAndSequence =
    await getStaticStopTimesByTripAndSequence({
      stops: stopTopics.map((topic) => ({
        stopCode: topic.stopCode ?? null,
        stopId: topic.id,
      })),
      tripIds: latestTripUpdates
        .map((tripUpdate) => tripUpdate.trip?.tripId)
        .filter((tripId): tripId is string => Boolean(tripId)),
    });
  let updatedTopics = 0;
  let writtenArrivals = 0;

  for (const topic of stopTopics) {
    const stopPayload = deriveStopArrivals({
      fetchedAt,
      staticStopTimesByTripAndSequence,
      stopId: topic.id,
      tripUpdates: latestTripUpdates,
      vehiclePositionsByTripId: latestVehiclePositionsByTripId,
    });

    await cacheAndPublishTopicPayload({
      payload: stopPayload,
      redis,
      topic,
    });
    updatedTopics += 1;
    writtenArrivals += stopPayload.arrivals.length;
  }

  return createObservedStopArrivalCacheResult({
    activeTopics: topics.length,
    staticStopTimeMatches: staticStopTimesByTripAndSequence.size,
    stopTopics: stopTopics.length,
    topics: stopTopics.map((topic) => `${topic.type}:${topic.id}`),
    tripUpdates: latestTripUpdates.length,
    updatedTopics,
    writtenArrivals,
  });
}

async function cacheActiveRouteVehicles({
  activeTopics,
  fetchedAt,
  vehiclePositions,
}: {
  activeTopics?: ObservedTopic[];
  fetchedAt: string;
  vehiclePositions: GtfsRealtimeVehiclePosition[];
}) {
  const redis = getRedisClient();

  if (!redis) {
    return createObservedRouteVehiclesCacheResult({
      skippedReason: "no-redis",
      vehiclePositions: vehiclePositions.length,
    });
  }

  const topics = activeTopics ?? (await getActiveObservedTopics(redis));
  const routeTopics = topics.filter((topic) => topic.type === "route");

  if (routeTopics.length === 0) {
    return createObservedRouteVehiclesCacheResult({
      activeTopics: topics.length,
      skippedReason: "no-active-route-topics",
      topics: topics.map((topic) => `${topic.type}:${topic.id}`),
      vehiclePositions: vehiclePositions.length,
    });
  }

  const routeIdsByTripId = indexRouteIdsByTripId(latestTripUpdates);
  const tripUpdatesByTripId = indexTripUpdatesByTripId(latestTripUpdates);
  let updatedTopics = 0;
  let writtenVehicles = 0;

  for (const topic of routeTopics) {
    const routePayload = deriveRouteVehicles({
      fetchedAt,
      routeId: topic.id,
      routeIdsByTripId,
      tripUpdatesByTripId,
      vehiclePositions,
    });

    await cacheAndPublishTopicPayload({
      payload: routePayload,
      redis,
      topic,
    });
    updatedTopics += 1;
    writtenVehicles += routePayload.vehicles.length;
  }

  return createObservedRouteVehiclesCacheResult({
    activeTopics: topics.length,
    routeTopics: routeTopics.length,
    topics: routeTopics.map((topic) => `${topic.type}:${topic.id}`),
    updatedTopics,
    vehiclePositions: vehiclePositions.length,
    writtenVehicles,
  });
}

function createObservedStopArrivalCacheResult(
  values: Partial<ObservedStopArrivalCacheResult> = {},
): ObservedStopArrivalCacheResult {
  return {
    activeTopics: values.activeTopics ?? 0,
    skippedReason: values.skippedReason ?? null,
    staticStopTimeMatches: values.staticStopTimeMatches ?? 0,
    stopTopics: values.stopTopics ?? 0,
    topics: values.topics ?? [],
    tripUpdates: values.tripUpdates ?? latestTripUpdates.length,
    updatedTopics: values.updatedTopics ?? 0,
    writtenArrivals: values.writtenArrivals ?? 0,
  };
}

function createObservedRouteVehiclesCacheResult(
  values: Partial<ObservedRouteVehiclesCacheResult> = {},
): ObservedRouteVehiclesCacheResult {
  return {
    activeTopics: values.activeTopics ?? 0,
    routeTopics: values.routeTopics ?? 0,
    skippedReason: values.skippedReason ?? null,
    topics: values.topics ?? [],
    updatedTopics: values.updatedTopics ?? 0,
    vehiclePositions: values.vehiclePositions ?? 0,
    writtenVehicles: values.writtenVehicles ?? 0,
  };
}

async function getStaticStopTimesByTripAndSequence({
  stops,
  tripIds,
}: {
  stops: { stopCode: string | null; stopId: string }[];
  tripIds: string[];
}) {
  const dbClient = getDbClient();
  const rowsByTripAndSequence = new Map<string, StaticStopTimeRow>();

  if (!dbClient || stops.length === 0 || tripIds.length === 0) {
    return rowsByTripAndSequence;
  }

  const uniqueStops = Array.from(
    new Map(stops.map((stop) => [stop.stopId, stop])).values(),
  );
  const uniqueTripIds = Array.from(new Set(tripIds));
  const requestedStopValues = sql.join(
    uniqueStops.map((stop) => sql`(${stop.stopId}, ${stop.stopCode})`),
    sql`, `,
  );
  const requestedTripValues = sql.join(
    uniqueTripIds.map(
      (tripId) => sql`(${tripId}, ${normalizeRealtimeTripId(tripId)})`,
    ),
    sql`, `,
  );
  const result = await dbClient.db.execute(sql<StaticStopTimeRow>`
    WITH requested_stops AS (
      SELECT observed_stop_id, observed_stop_code
      FROM (VALUES ${requestedStopValues}) AS requested_stops(
        observed_stop_id,
        observed_stop_code
      )
    ),
    requested_trips AS (
      SELECT observed_trip_id, normalized_trip_id
      FROM (VALUES ${requestedTripValues}) AS requested_trips(
        observed_trip_id,
        normalized_trip_id
      )
    ),
    configured_feed AS (
      SELECT value::uuid AS feed_version_id
      FROM app_settings
      WHERE key = 'active_gtfs_feed_version_id'
        AND value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ORDER BY updated_at DESC
      LIMIT 1
    ),
    active_feed AS (
      SELECT gtfs_feed_versions.id
      FROM gtfs_feed_versions
      WHERE gtfs_feed_versions.id = (
        SELECT feed_version_id FROM configured_feed LIMIT 1
      )
        AND gtfs_feed_versions.status = 'imported'
      UNION ALL
      SELECT gtfs_feed_versions.id
      FROM gtfs_feed_versions
      WHERE NOT EXISTS (SELECT 1 FROM configured_feed)
        AND gtfs_feed_versions.status = 'imported'
        AND gtfs_feed_versions.activated_at IS NOT NULL
      ORDER BY id
      LIMIT 1
    )
    SELECT
      requested_stops.observed_stop_id AS "observedStopId",
      requested_trips.observed_trip_id AS "observedTripId",
      stop_times.trip_id AS "tripId",
      stop_times.stop_sequence AS "stopSequence",
      stop_times.stop_id AS "stopId",
      stop_times.arrival_seconds AS "scheduledArrivalSeconds",
      stop_times.departure_seconds AS "scheduledDepartureSeconds",
      trips.route_id AS "routeId",
      trips.trip_headsign AS "tripHeadsign",
      routes.route_short_name AS "routeShortName",
      routes.route_long_name AS "routeLongName",
      routes.route_color AS "routeColor",
      routes.route_type AS "routeType"
    FROM stop_times
    INNER JOIN active_feed
      ON active_feed.id = stop_times.feed_version_id
    INNER JOIN requested_trips
      ON stop_times.trip_id = requested_trips.observed_trip_id
      OR stop_times.trip_id = requested_trips.normalized_trip_id
    INNER JOIN stops
      ON stops.feed_version_id = stop_times.feed_version_id
      AND stops.stop_id = stop_times.stop_id
    INNER JOIN requested_stops
      ON requested_stops.observed_stop_id = stops.stop_id
      OR requested_stops.observed_stop_id = stops.stop_code
      OR requested_stops.observed_stop_code = stops.stop_code
    INNER JOIN trips
      ON trips.feed_version_id = stop_times.feed_version_id
      AND trips.trip_id = stop_times.trip_id
    LEFT JOIN routes
      ON routes.feed_version_id = trips.feed_version_id
      AND routes.route_id = trips.route_id
  `);

  for (const row of getQueryRows<StaticStopTimeRow>(result)) {
    rowsByTripAndSequence.set(
      getTripSequenceKey(row.observedTripId, row.stopSequence),
      row,
    );
  }

  return rowsByTripAndSequence;
}

async function hasActiveStopTopics() {
  const redis = getRedisClient();

  if (!redis) {
    return false;
  }

  const activeTopics = await getActiveObservedTopics(redis);

  return activeTopics.some((topic) => topic.type === "stop");
}

async function hasActiveStopOrRouteTopics() {
  const redis = getRedisClient();

  if (!redis) {
    return false;
  }

  const activeTopics = await getActiveObservedTopics(redis);

  return activeTopics.some(
    (topic) => topic.type === "stop" || topic.type === "route",
  );
}

function deriveStopArrivals({
  fetchedAt,
  staticStopTimesByTripAndSequence,
  stopId,
  tripUpdates,
  vehiclePositionsByTripId,
}: {
  fetchedAt: string;
  staticStopTimesByTripAndSequence: ReadonlyMap<string, StaticStopTimeRow>;
  stopId: string;
  tripUpdates: GtfsRealtimeTripUpdate[];
  vehiclePositionsByTripId: ReadonlyMap<string, GtfsRealtimeVehiclePosition>;
}): StopArrivalsPayload {
  const arrivals: StopArrivalsPayload["arrivals"] = [];

  for (const tripUpdate of tripUpdates) {
    const tripId = tripUpdate.trip?.tripId;

    if (!tripId) {
      continue;
    }

    for (const stopTimeUpdate of tripUpdate.stopTimeUpdates) {
      const staticStopTime =
        stopTimeUpdate.stopSequence === null
          ? null
          : staticStopTimesByTripAndSequence.get(
              getTripSequenceKey(tripId, stopTimeUpdate.stopSequence),
            );

      if (staticStopTime?.observedStopId !== stopId) {
        continue;
      }

      const vehiclePosition = vehiclePositionsByTripId.get(tripId);

      arrivals.push({
        arrivalTime: stopTimeUpdate.arrival?.time ?? null,
        departureTime: stopTimeUpdate.departure?.time ?? null,
        delaySeconds:
          stopTimeUpdate.arrival?.delaySeconds ??
          stopTimeUpdate.departure?.delaySeconds ??
          null,
        directionName: staticStopTime.tripHeadsign,
        routeId: tripUpdate.trip?.routeId ?? staticStopTime.routeId,
        routeColor: staticStopTime.routeColor,
        routeLongName: staticStopTime.routeLongName,
        routeShortName: staticStopTime.routeShortName,
        routeType: normalizeRouteType(staticStopTime.routeType),
        routeTypeId: staticStopTime.routeType,
        scheduledArrivalSeconds: staticStopTime.scheduledArrivalSeconds,
        scheduledDepartureSeconds: staticStopTime.scheduledDepartureSeconds,
        stopId,
        stopSequence: stopTimeUpdate.stopSequence,
        tripId,
        vehiclePosition: vehiclePosition?.position ?? null,
        vehicleId:
          tripUpdate.vehicle?.id ??
          tripUpdate.vehicle?.label ??
          vehiclePosition?.vehicle?.id ??
          vehiclePosition?.vehicle?.label ??
          null,
      });
    }
  }

  arrivals.sort(
    (left, right) =>
      (left.arrivalTime ?? left.departureTime ?? Number.MAX_SAFE_INTEGER) -
      (right.arrivalTime ?? right.departureTime ?? Number.MAX_SAFE_INTEGER),
  );

  return {
    arrivals,
    fetchedAt,
    stopId,
  };
}

function deriveRouteVehicles({
  fetchedAt,
  routeId,
  routeIdsByTripId,
  tripUpdatesByTripId,
  vehiclePositions,
}: {
  fetchedAt: string;
  routeId: string;
  routeIdsByTripId: ReadonlyMap<string, string>;
  tripUpdatesByTripId: ReadonlyMap<string, GtfsRealtimeTripUpdate>;
  vehiclePositions: GtfsRealtimeVehiclePosition[];
}): RouteVehiclesPayload {
  const vehicles: RouteVehiclesPayload["vehicles"] = [];

  for (const vehiclePosition of vehiclePositions) {
    const tripId = vehiclePosition.trip?.tripId ?? null;
    const matchedRouteId =
      vehiclePosition.trip?.routeId ??
      (tripId ? routeIdsByTripId.get(tripId) : null) ??
      null;
    const position = vehiclePosition.position;
    const tripUpdate = tripId ? tripUpdatesByTripId.get(tripId) : null;
    const vehicleId =
      vehiclePosition.vehicle?.id ??
      tripUpdate?.vehicle?.id ??
      vehiclePosition.vehicle?.label ??
      tripUpdate?.vehicle?.label ??
      null;
    const vehicleLabel =
      vehiclePosition.vehicle?.label ?? tripUpdate?.vehicle?.label ?? null;

    if (matchedRouteId !== routeId || !position) {
      continue;
    }

    vehicles.push({
      bearing: position.bearing,
      currentStopSequence: vehiclePosition.currentStopSequence,
      id: vehicleId ?? vehiclePosition.id,
      label: vehicleLabel,
      lat: position.lat,
      lon: position.lon,
      routeId: matchedRouteId,
      speed: position.speed,
      stopId: vehiclePosition.stopId,
      timestamp: vehiclePosition.timestamp,
      tripId,
      vehicleId,
    });
  }

  vehicles.sort(
    (left, right) =>
      (right.timestamp ?? 0) - (left.timestamp ?? 0) ||
      left.id.localeCompare(right.id),
  );

  return {
    fetchedAt,
    routeId,
    vehicles,
  };
}

function getTripSequenceKey(tripId: string, stopSequence: number) {
  return `${tripId}:${stopSequence}`;
}

function normalizeRealtimeTripId(tripId: string) {
  return tripId.replace(/[A-Za-z]+$/, "");
}

function normalizeRouteType(routeType: number | null): RouteType {
  if (routeType === 0) {
    return "tram";
  }

  if (routeType === 1) {
    return "metro";
  }

  if (routeType === 2) {
    return "rail";
  }

  if (routeType === 3) {
    return "bus";
  }

  return "unknown";
}

function getAlertRetentionDays() {
  const retentionDays = Number(process.env.GTFS_REALTIME_ALERT_RETENTION_DAYS);

  return Number.isInteger(retentionDays) && retentionDays > 0
    ? retentionDays
    : DEFAULT_ALERT_RETENTION_DAYS;
}

function getAlertContentHash(alert: GtfsRealtimeAlert) {
  return createHash("sha256").update(JSON.stringify(alert)).digest("hex");
}

function getFeedTimestampDate(timestamp: number | null) {
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp * 1000);

  return Number.isFinite(date.getTime()) ? date : null;
}

async function importGtfsRealtimeAlerts(payload: Buffer) {
  const dbClient = getDbClient();

  if (!dbClient) {
    return {
      alerts: 0,
      deletedAlerts: 0,
      endedAlerts: 0,
      feedTimestamp: null,
      prunedAlerts: 0,
      skippedReason: "no-db",
      upsertedAlerts: 0,
    } satisfies AlertImportResult;
  }

  const metadata = parseGtfsRealtimeFeedMetadata(payload);
  const feedTimestamp = getFeedTimestampDate(metadata.timestamp);
  const alerts = parseGtfsRealtimeAlerts(payload);
  const isFullDataset =
    metadata.incrementality === null ||
    metadata.incrementality === GTFS_REALTIME_INCREMENTALITY_FULL_DATASET;
  let deletedAlerts = 0;
  let endedAlerts = 0;
  let upsertedAlerts = 0;
  const currentFeedEntityIds: string[] = [];

  for (const alert of alerts) {
    if (!alert.id) {
      continue;
    }

    if (alert.isDeleted) {
      const ended = await markRealtimeAlertEnded({
        db: dbClient.db,
        feedEntityId: alert.id,
        source: GTT_GTFS_REALTIME_SOURCE,
      });

      deletedAlerts += 1;
      endedAlerts += ended.ended;
      continue;
    }

    currentFeedEntityIds.push(alert.id);
    await upsertRealtimeAlert(dbClient.db, {
      activePeriods: alert.activePeriods,
      cause: alert.cause,
      contentHash: getAlertContentHash(alert),
      descriptionText: alert.descriptionText,
      effect: alert.effect,
      feedEntityId: alert.id,
      feedTimestamp,
      headerText: alert.headerText,
      informedEntities: alert.informedEntities,
      rawAlert: alert,
      severityLevel: alert.severityLevel,
      source: GTT_GTFS_REALTIME_SOURCE,
      url: alert.url,
    });
    upsertedAlerts += 1;
  }

  if (isFullDataset) {
    const ended = await markMissingRealtimeAlertsEnded({
      db: dbClient.db,
      feedEntityIds: currentFeedEntityIds,
      source: GTT_GTFS_REALTIME_SOURCE,
    });

    endedAlerts += ended.ended;
  }

  const pruned = await pruneEndedRealtimeAlerts({
    db: dbClient.db,
    retentionDays: getAlertRetentionDays(),
    source: GTT_GTFS_REALTIME_SOURCE,
  });

  return {
    alerts: alerts.length,
    deletedAlerts,
    endedAlerts,
    feedTimestamp: feedTimestamp?.toISOString() ?? null,
    prunedAlerts: pruned.pruned,
    skippedReason: null,
    upsertedAlerts,
  } satisfies AlertImportResult;
}

function indexVehiclePositionsByTripId(
  vehiclePositions: GtfsRealtimeVehiclePosition[],
) {
  const nextVehiclePositionsByTripId = new Map<
    string,
    GtfsRealtimeVehiclePosition
  >();

  for (const vehiclePosition of vehiclePositions) {
    const tripId = vehiclePosition.trip?.tripId;

    if (tripId) {
      nextVehiclePositionsByTripId.set(tripId, vehiclePosition);
    }
  }

  return nextVehiclePositionsByTripId;
}

function indexRouteIdsByTripId(tripUpdates: GtfsRealtimeTripUpdate[]) {
  const routeIdsByTripId = new Map<string, string>();

  for (const tripUpdate of tripUpdates) {
    const tripId = tripUpdate.trip?.tripId;
    const routeId = tripUpdate.trip?.routeId;

    if (tripId && routeId) {
      routeIdsByTripId.set(tripId, routeId);
    }
  }

  return routeIdsByTripId;
}

function indexTripUpdatesByTripId(tripUpdates: GtfsRealtimeTripUpdate[]) {
  const tripUpdatesByTripId = new Map<string, GtfsRealtimeTripUpdate>();

  for (const tripUpdate of tripUpdates) {
    const tripId = tripUpdate.trip?.tripId;

    if (tripId) {
      tripUpdatesByTripId.set(tripId, tripUpdate);
    }
  }

  return tripUpdatesByTripId;
}

async function fetchGtfsRealtimeFeed({
  feedKey,
  signal,
}: {
  feedKey: GtfsRealtimeFeedKey;
  signal: AbortSignal;
}) {
  const sourceUrl = getFeedUrl(feedKey);
  const response = await fetchWithTimeout(sourceUrl, signal);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch GTT GTFS-RT ${GTFS_REALTIME_FEEDS[feedKey].name}: ${response.status} ${response.statusText}`,
    );
  }

  const payload = Buffer.from(await response.arrayBuffer());
  const sha256Hash = createHash("sha256").update(payload).digest("hex");
  const fetchedAt = new Date().toISOString();
  const feedResult = {
    byteLength: payload.byteLength,
    contentType: response.headers.get("content-type"),
    fetchedAt,
    sha256Hash,
    sourceUrl,
  };
  const observedTopics: {
    routeVehicles: ObservedRouteVehiclesCacheResult | null;
    stopArrivals: ObservedStopArrivalCacheResult | null;
  } = { routeVehicles: null, stopArrivals: null };
  let importedAlerts: AlertImportResult | null = null;
  const shouldDeriveStopArrivals = await hasActiveStopTopics();
  const shouldDeriveVehiclePositionTopics =
    feedKey === "vehiclePositions" ? await hasActiveStopOrRouteTopics() : false;

  if (feedKey === "vehiclePositions" && shouldDeriveVehiclePositionTopics) {
    const vehiclePositions = parseGtfsRealtimeVehiclePositions(payload);

    latestVehiclePositionsByTripId =
      indexVehiclePositionsByTripId(vehiclePositions);
    observedTopics.routeVehicles = await cacheActiveRouteVehicles({
      fetchedAt,
      vehiclePositions,
    });

    if (shouldDeriveStopArrivals) {
      observedTopics.stopArrivals = await cacheActiveStopArrivals({
        fetchedAt,
      });
    }
  } else if (feedKey === "tripUpdates" && shouldDeriveStopArrivals) {
    latestTripUpdates = parseGtfsRealtimeTripUpdates(payload);
    observedTopics.stopArrivals = await cacheActiveStopArrivals({ fetchedAt });
  } else if (feedKey === "alerts") {
    importedAlerts = await importGtfsRealtimeAlerts(payload);
  }

  return {
    ...feedResult,
    importedAlerts,
    observedTopics,
  };
}

async function fetchGtfsRealtimeFeedPayload({
  feedKey,
  signal,
}: {
  feedKey: GtfsRealtimeFeedKey;
  signal: AbortSignal;
}) {
  const sourceUrl = getFeedUrl(feedKey);
  const response = await fetchWithTimeout(sourceUrl, signal);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch GTT GTFS-RT ${GTFS_REALTIME_FEEDS[feedKey].name}: ${response.status} ${response.statusText}`,
    );
  }

  const payload = Buffer.from(await response.arrayBuffer());

  return {
    byteLength: payload.byteLength,
    contentType: response.headers.get("content-type"),
    feedKey,
    payload,
    sha256Hash: createHash("sha256").update(payload).digest("hex"),
    sourceUrl,
  };
}

async function fetchGtfsRealtimeVehiclePositionsAndTripUpdates({
  signal,
}: {
  signal: AbortSignal;
}) {
  const fetchedAt = new Date().toISOString();
  const [vehiclePositionsFeed, tripUpdatesFeed] = await Promise.all([
    fetchGtfsRealtimeFeedPayload({ feedKey: "vehiclePositions", signal }),
    fetchGtfsRealtimeFeedPayload({ feedKey: "tripUpdates", signal }),
  ]);
  const vehiclePositions = parseGtfsRealtimeVehiclePositions(
    vehiclePositionsFeed.payload,
  );
  const tripUpdates = parseGtfsRealtimeTripUpdates(tripUpdatesFeed.payload);
  const redis = getRedisClient();
  const activeTopics = redis ? await getActiveObservedTopics(redis) : [];
  const shouldDeriveStopArrivals = activeTopics.some(
    (topic) => topic.type === "stop",
  );
  const shouldDeriveRouteVehicles = activeTopics.some(
    (topic) => topic.type === "route",
  );
  const observedTopics: {
    routeVehicles: ObservedRouteVehiclesCacheResult | null;
    stopArrivals: ObservedStopArrivalCacheResult | null;
  } = { routeVehicles: null, stopArrivals: null };

  latestTripUpdates = tripUpdates;
  latestVehiclePositionsByTripId =
    indexVehiclePositionsByTripId(vehiclePositions);

  if (shouldDeriveRouteVehicles) {
    observedTopics.routeVehicles = await cacheActiveRouteVehicles({
      activeTopics,
      fetchedAt,
      vehiclePositions,
    });
  }

  if (shouldDeriveStopArrivals) {
    observedTopics.stopArrivals = await cacheActiveStopArrivals({
      activeTopics,
      fetchedAt,
    });
  }

  return {
    feeds: {
      tripUpdates: {
        byteLength: tripUpdatesFeed.byteLength,
        contentType: tripUpdatesFeed.contentType,
        sha256Hash: tripUpdatesFeed.sha256Hash,
        sourceUrl: tripUpdatesFeed.sourceUrl,
        tripUpdates: tripUpdates.length,
      },
      vehiclePositions: {
        byteLength: vehiclePositionsFeed.byteLength,
        contentType: vehiclePositionsFeed.contentType,
        sha256Hash: vehiclePositionsFeed.sha256Hash,
        sourceUrl: vehiclePositionsFeed.sourceUrl,
        vehiclePositions: vehiclePositions.length,
      },
    },
    fetchedAt,
    observedTopics,
  };
}

function createGtfsRealtimeJob(feedKey: GtfsRealtimeFeedKey): ScheduledJob {
  const feed = GTFS_REALTIME_FEEDS[feedKey];

  return {
    input: {
      url: getFeedUrl(feedKey),
    },
    name: `poll-gtt-gtfs-realtime-${feed.name}`,
    run({ signal }: WorkerContext) {
      return fetchGtfsRealtimeFeed({ feedKey, signal });
    },
    runOnStart: true,
    schedule: {
      intervalMs: feed.intervalMs,
      type: "interval",
    },
  };
}

export const pollGttGtfsRealtimeVehiclePositionsJob =
  createGtfsRealtimeVehiclePositionsAndTripUpdatesJob();
export const pollGttGtfsRealtimeAlertsJob = createGtfsRealtimeJob("alerts");

function createGtfsRealtimeVehiclePositionsAndTripUpdatesJob(): ScheduledJob {
  return {
    input: {
      urls: {
        tripUpdates: getFeedUrl("tripUpdates"),
        vehiclePositions: getFeedUrl("vehiclePositions"),
      },
    },
    name: "poll-gtt-gtfs-realtime-vehicle-positions-and-trip-updates",
    run({ signal }: WorkerContext) {
      return fetchGtfsRealtimeVehiclePositionsAndTripUpdates({ signal });
    },
    runOnStart: true,
    schedule: {
      intervalMs: GTFS_REALTIME_FEEDS.vehiclePositions.intervalMs,
      type: "interval",
    },
  };
}
