import type { DbClient } from "./client.js";
import { getQueryRows } from "./query-result.js";
import { sql } from "drizzle-orm";

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

export async function upsertRealtimeAlert(
  db: Db,
  values: UpsertRealtimeAlertValues,
) {
  const [alert] = getQueryRows<{ id: string }>(
    await db.execute(sql`
      INSERT INTO gtfs_realtime_alerts (
        source,
        feed_entity_id,
        content_hash,
        cause,
        effect,
        severity_level,
        header_text,
        description_text,
        url,
        active_periods,
        raw_alert,
        feed_timestamp,
        first_seen_at,
        last_seen_at,
        ended_at,
        updated_at
      )
      VALUES (
        ${values.source},
        ${values.feedEntityId},
        ${values.contentHash},
        ${values.cause},
        ${values.effect},
        ${values.severityLevel},
        ${JSON.stringify(values.headerText)}::jsonb,
        ${JSON.stringify(values.descriptionText)}::jsonb,
        ${JSON.stringify(values.url)}::jsonb,
        ${JSON.stringify(values.activePeriods)}::jsonb,
        ${JSON.stringify(values.rawAlert)}::jsonb,
        ${values.feedTimestamp},
        now(),
        now(),
        NULL,
        now()
      )
      ON CONFLICT (source, feed_entity_id)
      DO UPDATE SET
        content_hash = excluded.content_hash,
        cause = excluded.cause,
        effect = excluded.effect,
        severity_level = excluded.severity_level,
        header_text = excluded.header_text,
        description_text = excluded.description_text,
        url = excluded.url,
        active_periods = excluded.active_periods,
        raw_alert = excluded.raw_alert,
        feed_timestamp = excluded.feed_timestamp,
        last_seen_at = now(),
        ended_at = NULL,
        updated_at = now()
      RETURNING id
    `),
  );

  if (!alert) {
    throw new Error("Failed to upsert GTFS realtime alert");
  }

  await db.execute(sql`
    DELETE FROM gtfs_realtime_alert_informed_entities
    WHERE alert_id = ${alert.id}::uuid
  `);

  for (const [selectorIndex, selector] of values.informedEntities.entries()) {
    await db.execute(sql`
      INSERT INTO gtfs_realtime_alert_informed_entities (
        alert_id,
        selector_index,
        agency_id,
        route_id,
        route_type,
        direction_id,
        stop_id,
        trip_id,
        trip_route_id,
        trip_start_date,
        trip_start_time,
        selector
      )
      VALUES (
        ${alert.id}::uuid,
        ${selectorIndex},
        ${selector.agencyId},
        ${selector.routeId},
        ${selector.routeType},
        ${selector.directionId},
        ${selector.stopId},
        ${selector.trip?.tripId ?? null},
        ${selector.trip?.routeId ?? null},
        ${selector.trip?.startDate ?? null},
        ${selector.trip?.startTime ?? null},
        ${JSON.stringify(selector)}::jsonb
      )
    `);
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
