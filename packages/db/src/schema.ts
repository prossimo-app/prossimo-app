import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography";
  },
});

export const scheduledJobRuns = pgTable(
  "scheduled_job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobName: text("job_name").notNull(),
    environment: text("environment").notNull(),
    status: text("status").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    result: text("result"),
    error: text("error"),
    schedule: jsonb("schedule"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("scheduled_job_runs_job_name_started_at_idx").on(
      table.jobName,
      table.startedAt,
    ),
    index("scheduled_job_runs_status_started_at_idx").on(
      table.status,
      table.startedAt,
    ),
  ],
);

export const gtfsRealtimeAlerts = pgTable(
  "gtfs_realtime_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    feedEntityId: text("feed_entity_id").notNull(),
    contentHash: text("content_hash").notNull(),
    cause: integer("cause"),
    effect: integer("effect"),
    severityLevel: integer("severity_level"),
    headerText: jsonb("header_text"),
    descriptionText: jsonb("description_text"),
    url: jsonb("url"),
    activePeriods: jsonb("active_periods")
      .default(sql`'[]'::jsonb`)
      .notNull(),
    rawAlert: jsonb("raw_alert")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    feedTimestamp: timestamp("feed_timestamp", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("gtfs_realtime_alerts_source_entity_unique").on(
      table.source,
      table.feedEntityId,
    ),
    index("gtfs_realtime_alerts_source_ended_idx").on(
      table.source,
      table.endedAt,
    ),
    index("gtfs_realtime_alerts_last_seen_idx").on(table.lastSeenAt),
  ],
);

export const gtfsRealtimeAlertInformedEntities = pgTable(
  "gtfs_realtime_alert_informed_entities",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => gtfsRealtimeAlerts.id, { onDelete: "cascade" }),
    selectorIndex: integer("selector_index").notNull(),
    agencyId: text("agency_id"),
    routeId: text("route_id"),
    routeType: integer("route_type"),
    directionId: integer("direction_id"),
    stopId: text("stop_id"),
    tripId: text("trip_id"),
    tripRouteId: text("trip_route_id"),
    tripStartDate: text("trip_start_date"),
    tripStartTime: text("trip_start_time"),
    selector: jsonb("selector")
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.alertId, table.selectorIndex],
      name: "gtfs_realtime_alert_informed_entities_pk",
    }),
    index("gtfs_realtime_alert_entities_route_idx").on(table.routeId),
    index("gtfs_realtime_alert_entities_stop_idx").on(table.stopId),
    index("gtfs_realtime_alert_entities_trip_idx").on(table.tripId),
    index("gtfs_realtime_alert_entities_type_idx").on(table.routeType),
  ],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const gtfsFeedVersions = pgTable(
  "gtfs_feed_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceUrl: text("source_url").notNull(),
    sha256Hash: text("sha256_hash").notNull(),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    status: text("status").default("pending").notNull(),
    serviceStartDate: date("service_start_date"),
    serviceEndDate: date("service_end_date"),
    routesCount: integer("routes_count"),
    stopsCount: integer("stops_count"),
    tripsCount: integer("trips_count"),
    stopTimesCount: integer("stop_times_count"),
    shapesCount: integer("shapes_count"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    zipByteLength: integer("zip_byte_length").notNull(),
  },
  (table) => [
    uniqueIndex("gtfs_feed_versions_sha256_hash_unique").on(table.sha256Hash),
  ],
);

export const agencies = pgTable(
  "agencies",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    agencyId: text("agency_id").notNull(),
    agencyName: text("agency_name").notNull(),
    agencyUrl: text("agency_url"),
    agencyTimezone: text("agency_timezone"),
    agencyLang: text("agency_lang"),
    agencyPhone: text("agency_phone"),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.agencyId],
      name: "agencies_feed_version_id_agency_id_pk",
    }),
  ],
);

export const routes = pgTable(
  "routes",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    routeId: text("route_id").notNull(),
    agencyId: text("agency_id"),
    routeShortName: text("route_short_name"),
    routeLongName: text("route_long_name"),
    routeDesc: text("route_desc"),
    routeType: integer("route_type").notNull(),
    routeUrl: text("route_url"),
    routeColor: text("route_color"),
    routeTextColor: text("route_text_color"),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.routeId],
      name: "routes_feed_version_id_route_id_pk",
    }),
    index("idx_routes_feed_short_name").on(
      table.feedVersionId,
      table.routeShortName,
    ),
  ],
);

export const calendars = pgTable(
  "calendars",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull(),
    monday: boolean("monday").notNull(),
    tuesday: boolean("tuesday").notNull(),
    wednesday: boolean("wednesday").notNull(),
    thursday: boolean("thursday").notNull(),
    friday: boolean("friday").notNull(),
    saturday: boolean("saturday").notNull(),
    sunday: boolean("sunday").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.serviceId],
      name: "calendars_feed_version_id_service_id_pk",
    }),
  ],
);

export const calendarDates = pgTable(
  "calendar_dates",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull(),
    date: date("date").notNull(),
    exceptionType: integer("exception_type").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.serviceId, table.date],
      name: "calendar_dates_feed_version_id_service_id_date_pk",
    }),
    index("idx_calendar_dates_feed_date").on(table.feedVersionId, table.date),
  ],
);

export const shapes = pgTable(
  "shapes",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    shapeId: text("shape_id").notNull(),
    shapePtLat: doublePrecision("shape_pt_lat").notNull(),
    shapePtLon: doublePrecision("shape_pt_lon").notNull(),
    shapePtSequence: integer("shape_pt_sequence").notNull(),
    shapeDistTraveled: doublePrecision("shape_dist_traveled"),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.shapeId, table.shapePtSequence],
      name: "shapes_feed_version_id_shape_id_shape_pt_sequence_pk",
    }),
    index("idx_shapes_feed_shape").on(table.feedVersionId, table.shapeId),
  ],
);

export const stops = pgTable(
  "stops",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    stopId: text("stop_id").notNull(),
    stopCode: text("stop_code"),
    stopName: text("stop_name").notNull(),
    stopDesc: text("stop_desc"),
    stopLat: doublePrecision("stop_lat").notNull(),
    stopLon: doublePrecision("stop_lon").notNull(),
    location: geographyPoint("location").generatedAlwaysAs(
      sql`public.ST_SetSRID(public.ST_MakePoint(stop_lon, stop_lat), 4326)::public.geography`,
    ),
    zoneId: text("zone_id"),
    stopUrl: text("stop_url"),
    locationType: integer("location_type"),
    parentStation: text("parent_station"),
    wheelchairBoarding: integer("wheelchair_boarding"),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.stopId],
      name: "stops_feed_version_id_stop_id_pk",
    }),
    index("idx_stops_location").using("gist", table.location),
    index("idx_stops_name").using(
      "gin",
      sql`to_tsvector('simple', ${table.stopName})`,
    ),
    index("idx_stops_feed_code").on(table.feedVersionId, table.stopCode),
  ],
);

export const trips = pgTable(
  "trips",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    tripId: text("trip_id").notNull(),
    routeId: text("route_id").notNull(),
    serviceId: text("service_id").notNull(),
    tripHeadsign: text("trip_headsign"),
    tripShortName: text("trip_short_name"),
    directionId: integer("direction_id"),
    blockId: text("block_id"),
    shapeId: text("shape_id"),
    wheelchairAccessible: integer("wheelchair_accessible"),
    bikesAllowed: integer("bikes_allowed"),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.tripId],
      name: "trips_feed_version_id_trip_id_pk",
    }),
    index("idx_trips_feed_route").on(table.feedVersionId, table.routeId),
    index("idx_trips_feed_service").on(table.feedVersionId, table.serviceId),
    index("idx_trips_feed_shape").on(table.feedVersionId, table.shapeId),
  ],
);

export const stopTimes = pgTable(
  "stop_times",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    tripId: text("trip_id").notNull(),
    arrivalTime: text("arrival_time"),
    departureTime: text("departure_time"),
    arrivalSeconds: integer("arrival_seconds"),
    departureSeconds: integer("departure_seconds"),
    stopId: text("stop_id").notNull(),
    stopSequence: integer("stop_sequence").notNull(),
    stopHeadsign: text("stop_headsign"),
    pickupType: integer("pickup_type"),
    dropOffType: integer("drop_off_type"),
    shapeDistTraveled: doublePrecision("shape_dist_traveled"),
    timepoint: integer("timepoint"),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.tripId, table.stopSequence],
      name: "stop_times_feed_version_id_trip_id_stop_sequence_pk",
    }),
    index("idx_stop_times_feed_stop").on(table.feedVersionId, table.stopId),
    index("idx_stop_times_feed_trip").on(table.feedVersionId, table.tripId),
    index("idx_stop_times_stop_departure").on(
      table.feedVersionId,
      table.stopId,
      table.departureSeconds,
    ),
  ],
);

export const stopRoutes = pgTable(
  "stop_routes",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    stopId: text("stop_id").notNull(),
    routeId: text("route_id").notNull(),
    routeShortName: text("route_short_name"),
    routeType: integer("route_type"),
    directionId: integer("direction_id").notNull(),
    tripCount: integer("trip_count").default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.feedVersionId,
        table.stopId,
        table.routeId,
        table.directionId,
      ],
      name: "stop_routes_feed_version_id_stop_id_route_id_direction_id_pk",
    }),
    index("idx_stop_routes_stop").on(table.feedVersionId, table.stopId),
    index("idx_stop_routes_route").on(table.feedVersionId, table.routeId),
  ],
);

export const routeStops = pgTable(
  "route_stops",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    routeId: text("route_id").notNull(),
    directionId: integer("direction_id").notNull(),
    stopId: text("stop_id").notNull(),
    stopSequence: integer("stop_sequence").notNull(),
    representativeTripId: text("representative_trip_id"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.feedVersionId,
        table.routeId,
        table.directionId,
        table.stopSequence,
      ],
      name: "route_stops_feed_route_direction_sequence_pk",
    }),
    index("idx_route_stops_route").on(
      table.feedVersionId,
      table.routeId,
      table.directionId,
    ),
  ],
);

export const routeServiceDays = pgTable(
  "route_service_days",
  {
    feedVersionId: uuid("feed_version_id")
      .notNull()
      .references(() => gtfsFeedVersions.id, { onDelete: "cascade" }),
    serviceDate: date("service_date").notNull(),
    routeId: text("route_id").notNull(),
    routeShortName: text("route_short_name"),
    routeType: integer("route_type"),
    firstDepartureSeconds: integer("first_departure_seconds"),
    lastArrivalSeconds: integer("last_arrival_seconds"),
    tripCount: integer("trip_count").default(0).notNull(),
    serviceIds: text("service_ids")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.feedVersionId, table.serviceDate, table.routeId],
      name: "route_service_days_feed_version_id_service_date_route_id_pk",
    }),
    index("idx_route_service_days_date").on(
      table.feedVersionId,
      table.serviceDate,
    ),
  ],
);

export const schema = {
  agencies,
  appSettings,
  calendarDates,
  calendars,
  gtfsFeedVersions,
  gtfsRealtimeAlertInformedEntities,
  gtfsRealtimeAlerts,
  routeServiceDays,
  routeStops,
  routes,
  scheduledJobRuns,
  shapes,
  stopRoutes,
  stopTimes,
  stops,
  trips,
};

export type Schema = typeof schema;
