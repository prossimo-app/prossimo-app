import type { DbClient } from "./client.js";
import { getQueryRows } from "./query-result.js";
import {
  gtfsRealtimeAlertInformedEntities,
  gtfsRealtimeAlerts,
} from "./schema.js";
import { eq, sql } from "drizzle-orm";

type Db = DbClient["db"];

export interface RealtimeAlertText {
  translations: {
    language: string | null;
    text: string;
  }[];
}

export interface RealtimeAlertTimeRange {
  end: number | null;
  start: number | null;
}

export interface RealtimeAlertSelector {
  agencyId: string | null;
  directionId: number | null;
  routeId: string | null;
  routeType: number | null;
  stopId: string | null;
  trip: {
    directionId: number | null;
    routeId: string | null;
    startDate: string | null;
    startTime: string | null;
    tripId: string | null;
  } | null;
}

export interface UpsertRealtimeAlertValues {
  activePeriods: RealtimeAlertTimeRange[];
  cause: number | null;
  contentHash: string;
  descriptionText: RealtimeAlertText | null;
  effect: number | null;
  feedEntityId: string;
  feedTimestamp: Date | null;
  headerText: RealtimeAlertText | null;
  informedEntities: RealtimeAlertSelector[];
  rawAlert: unknown;
  severityLevel: number | null;
  source: string;
  url: RealtimeAlertText | null;
}

export interface ActiveRealtimeAlertRow {
  activePeriods: RealtimeAlertTimeRange[];
  cause: number | null;
  descriptionText: RealtimeAlertText | null;
  effect: number | null;
  feedEntityId: string;
  firstSeenAt: Date;
  headerText: RealtimeAlertText | null;
  id: string;
  lastSeenAt: Date;
  severityLevel: number | null;
  source: string;
  url: RealtimeAlertText | null;
}

function getAffectedRows(result: unknown) {
  if (typeof result === "object" && result !== null) {
    if ("rowCount" in result && typeof result.rowCount === "number") {
      return result.rowCount;
    }

    if ("count" in result && typeof result.count === "number") {
      return result.count;
    }
  }

  return 0;
}

function createTextArraySql(values: string[]) {
  if (values.length === 0) {
    return sql`ARRAY[]::text[]`;
  }

  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;
}

export async function upsertRealtimeAlert(
  db: Db,
  values: UpsertRealtimeAlertValues,
) {
  const [alert] = await db
    .insert(gtfsRealtimeAlerts)
    .values({
      activePeriods: values.activePeriods,
      cause: values.cause,
      contentHash: values.contentHash,
      descriptionText: values.descriptionText,
      effect: values.effect,
      feedEntityId: values.feedEntityId,
      feedTimestamp: values.feedTimestamp,
      headerText: values.headerText,
      rawAlert: values.rawAlert,
      severityLevel: values.severityLevel,
      source: values.source,
      url: values.url,
    })
    .onConflictDoUpdate({
      set: {
        activePeriods: values.activePeriods,
        cause: values.cause,
        contentHash: values.contentHash,
        descriptionText: values.descriptionText,
        effect: values.effect,
        endedAt: null,
        feedTimestamp: values.feedTimestamp,
        headerText: values.headerText,
        lastSeenAt: sql`now()`,
        rawAlert: values.rawAlert,
        severityLevel: values.severityLevel,
        updatedAt: sql`now()`,
        url: values.url,
      },
      target: [gtfsRealtimeAlerts.source, gtfsRealtimeAlerts.feedEntityId],
    })
    .returning({ id: gtfsRealtimeAlerts.id });

  if (!alert) {
    throw new Error("Failed to upsert GTFS realtime alert");
  }

  await db
    .delete(gtfsRealtimeAlertInformedEntities)
    .where(eq(gtfsRealtimeAlertInformedEntities.alertId, alert.id));

  if (values.informedEntities.length > 0) {
    await db.insert(gtfsRealtimeAlertInformedEntities).values(
      values.informedEntities.map((selector, selectorIndex) => ({
        agencyId: selector.agencyId,
        alertId: alert.id,
        directionId: selector.directionId,
        routeId: selector.routeId,
        routeType: selector.routeType,
        selector,
        selectorIndex,
        stopId: selector.stopId,
        tripId: selector.trip?.tripId ?? null,
        tripRouteId: selector.trip?.routeId ?? null,
        tripStartDate: selector.trip?.startDate ?? null,
        tripStartTime: selector.trip?.startTime ?? null,
      })),
    );
  }

  return alert;
}

export async function markMissingRealtimeAlertsEnded({
  db,
  feedEntityIds,
  source,
}: {
  db: Db;
  feedEntityIds: string[];
  source: string;
}) {
  if (feedEntityIds.length === 0) {
    const result = await db.execute(sql`
      UPDATE gtfs_realtime_alerts
      SET ended_at = now(), updated_at = now()
      WHERE source = ${source}
        AND ended_at IS NULL
    `);

    return { ended: getAffectedRows(result) };
  }

  const feedEntityIdValues = sql.join(
    feedEntityIds.map((feedEntityId) => sql`${feedEntityId}`),
    sql`, `,
  );
  const result = await db.execute(sql`
    UPDATE gtfs_realtime_alerts
    SET ended_at = now(), updated_at = now()
    WHERE source = ${source}
      AND ended_at IS NULL
      AND feed_entity_id NOT IN (${feedEntityIdValues})
  `);

  return { ended: getAffectedRows(result) };
}

export async function markRealtimeAlertEnded({
  db,
  feedEntityId,
  source,
}: {
  db: Db;
  feedEntityId: string;
  source: string;
}) {
  const result = await db.execute(sql`
    UPDATE gtfs_realtime_alerts
    SET ended_at = now(), updated_at = now()
    WHERE source = ${source}
      AND feed_entity_id = ${feedEntityId}
      AND ended_at IS NULL
  `);

  return { ended: getAffectedRows(result) };
}

export async function pruneEndedRealtimeAlerts({
  db,
  retentionDays,
  source,
}: {
  db: Db;
  retentionDays: number;
  source?: string;
}) {
  const result = await db.execute(sql`
    DELETE FROM gtfs_realtime_alerts
    WHERE ended_at IS NOT NULL
      AND ended_at < now() - (${retentionDays}::text || ' days')::interval
      AND (${source ?? null}::text IS NULL OR source = ${source ?? null})
  `);

  return { pruned: getAffectedRows(result) };
}

export async function getActiveRealtimeAlerts({
  db,
  limit = 50,
  source,
}: {
  db: Db;
  limit?: number;
  source?: string;
}) {
  const result = await db.execute(sql<ActiveRealtimeAlertRow>`
    SELECT
      id,
      source,
      feed_entity_id AS "feedEntityId",
      cause,
      effect,
      severity_level AS "severityLevel",
      header_text AS "headerText",
      description_text AS "descriptionText",
      url,
      active_periods AS "activePeriods",
      first_seen_at AS "firstSeenAt",
      last_seen_at AS "lastSeenAt"
    FROM gtfs_realtime_alerts
    WHERE ended_at IS NULL
      AND (${source ?? null}::text IS NULL OR source = ${source ?? null})
      AND (
        jsonb_array_length(active_periods) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(active_periods) AS period(value)
          WHERE
            COALESCE((period.value->>'start')::bigint, 0) <= extract(epoch from now())
            AND COALESCE((period.value->>'end')::bigint, 9223372036854775807) > extract(epoch from now())
        )
      )
    ORDER BY
      COALESCE(severity_level, 0) DESC,
      last_seen_at DESC,
      feed_entity_id
    LIMIT ${limit}
  `);

  return getQueryRows<ActiveRealtimeAlertRow>(result);
}

export async function getActiveRealtimeAlertsForStop({
  db,
  limit = 20,
  source,
  stopIds,
}: {
  db: Db;
  limit?: number;
  source?: string;
  stopIds: string[];
}) {
  const uniqueStopIds = Array.from(new Set(stopIds));
  const stopIdsSql = createTextArraySql(uniqueStopIds);

  const result = await db.execute(sql<ActiveRealtimeAlertRow>`
    SELECT DISTINCT ON (gtfs_realtime_alerts.id)
      gtfs_realtime_alerts.id,
      gtfs_realtime_alerts.source,
      gtfs_realtime_alerts.feed_entity_id AS "feedEntityId",
      gtfs_realtime_alerts.cause,
      gtfs_realtime_alerts.effect,
      gtfs_realtime_alerts.severity_level AS "severityLevel",
      gtfs_realtime_alerts.header_text AS "headerText",
      gtfs_realtime_alerts.description_text AS "descriptionText",
      gtfs_realtime_alerts.url,
      gtfs_realtime_alerts.active_periods AS "activePeriods",
      gtfs_realtime_alerts.first_seen_at AS "firstSeenAt",
      gtfs_realtime_alerts.last_seen_at AS "lastSeenAt"
    FROM gtfs_realtime_alerts
    INNER JOIN gtfs_realtime_alert_informed_entities
      ON gtfs_realtime_alert_informed_entities.alert_id = gtfs_realtime_alerts.id
    WHERE gtfs_realtime_alerts.ended_at IS NULL
      AND (${source ?? null}::text IS NULL OR gtfs_realtime_alerts.source = ${source ?? null})
      AND (
        jsonb_array_length(gtfs_realtime_alerts.active_periods) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(gtfs_realtime_alerts.active_periods) AS period(value)
          WHERE
            COALESCE((period.value->>'start')::bigint, 0) <= extract(epoch from now())
            AND COALESCE((period.value->>'end')::bigint, 9223372036854775807) > extract(epoch from now())
        )
      )
      AND (
        gtfs_realtime_alert_informed_entities.stop_id = ANY(${stopIdsSql})
      )
    ORDER BY
      gtfs_realtime_alerts.id,
      COALESCE(gtfs_realtime_alerts.severity_level, 0) DESC,
      gtfs_realtime_alerts.last_seen_at DESC,
      gtfs_realtime_alerts.feed_entity_id
    LIMIT ${limit}
  `);

  return getQueryRows<ActiveRealtimeAlertRow>(result).sort(
    (left, right) =>
      (right.severityLevel ?? 0) - (left.severityLevel ?? 0) ||
      String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)) ||
      left.feedEntityId.localeCompare(right.feedEntityId),
  );
}

export async function getActiveRealtimeAlertsForRoute({
  db,
  limit = 20,
  routeId,
  routeType,
  source,
}: {
  db: Db;
  limit?: number;
  routeId: string;
  routeType: number | null;
  source?: string;
}) {
  const result = await db.execute(sql<ActiveRealtimeAlertRow>`
    SELECT DISTINCT ON (gtfs_realtime_alerts.id)
      gtfs_realtime_alerts.id,
      gtfs_realtime_alerts.source,
      gtfs_realtime_alerts.feed_entity_id AS "feedEntityId",
      gtfs_realtime_alerts.cause,
      gtfs_realtime_alerts.effect,
      gtfs_realtime_alerts.severity_level AS "severityLevel",
      gtfs_realtime_alerts.header_text AS "headerText",
      gtfs_realtime_alerts.description_text AS "descriptionText",
      gtfs_realtime_alerts.url,
      gtfs_realtime_alerts.active_periods AS "activePeriods",
      gtfs_realtime_alerts.first_seen_at AS "firstSeenAt",
      gtfs_realtime_alerts.last_seen_at AS "lastSeenAt"
    FROM gtfs_realtime_alerts
    INNER JOIN gtfs_realtime_alert_informed_entities
      ON gtfs_realtime_alert_informed_entities.alert_id = gtfs_realtime_alerts.id
    WHERE gtfs_realtime_alerts.ended_at IS NULL
      AND (${source ?? null}::text IS NULL OR gtfs_realtime_alerts.source = ${source ?? null})
      AND (
        jsonb_array_length(gtfs_realtime_alerts.active_periods) = 0
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(gtfs_realtime_alerts.active_periods) AS period(value)
          WHERE
            COALESCE((period.value->>'start')::bigint, 0) <= extract(epoch from now())
            AND COALESCE((period.value->>'end')::bigint, 9223372036854775807) > extract(epoch from now())
        )
      )
      AND (
        gtfs_realtime_alert_informed_entities.route_id = ${routeId}
        OR gtfs_realtime_alert_informed_entities.trip_route_id = ${routeId}
        OR (
          ${routeType}::int IS NOT NULL
          AND gtfs_realtime_alert_informed_entities.route_type = ${routeType}
        )
      )
    ORDER BY
      gtfs_realtime_alerts.id,
      COALESCE(gtfs_realtime_alerts.severity_level, 0) DESC,
      gtfs_realtime_alerts.last_seen_at DESC,
      gtfs_realtime_alerts.feed_entity_id
    LIMIT ${limit}
  `);

  return getQueryRows<ActiveRealtimeAlertRow>(result).sort(
    (left, right) =>
      (right.severityLevel ?? 0) - (left.severityLevel ?? 0) ||
      String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)) ||
      left.feedEntityId.localeCompare(right.feedEntityId),
  );
}
