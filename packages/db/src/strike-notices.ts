import { and, eq, sql } from "drizzle-orm";

import type { DbClient } from "./client.js";
import type { ActiveRealtimeAlertRow } from "./realtime-alerts.js";
import { getQueryRows } from "./query-result.js";
import { strikeNotices } from "./schema.js";

type Db = DbClient["db"];

export type StrikeRelevanceStatus = "definite" | "possible";

export interface UpsertStrikeNoticeValues {
  description: string | null;
  endsAt: Date | null;
  link: string | null;
  publishedAt: Date | null;
  rawPayload: unknown;
  relevanceStatus: StrikeRelevanceStatus;
  source: string;
  sourceHash: string;
  sourceId: string;
  startsAt: Date | null;
  title: string;
}

export interface StrikeNoticeRow {
  description: string | null;
  endsAt: Date | null;
  id: string;
  link: string | null;
  publishedAt: Date | null;
  relevanceStatus: StrikeRelevanceStatus;
  source: string;
  startsAt: Date | null;
  title: string;
}

export async function upsertStrikeNotice(
  db: Db,
  values: UpsertStrikeNoticeValues,
) {
  const [existingByHash] = await db
    .update(strikeNotices)
    .set({
      description: values.description,
      endsAt: values.endsAt,
      lastSeenAt: sql`now()`,
      link: values.link,
      publishedAt: values.publishedAt,
      rawPayload: values.rawPayload,
      relevanceStatus: values.relevanceStatus,
      sourceId: values.sourceId,
      startsAt: values.startsAt,
      title: values.title,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(strikeNotices.source, values.source),
        eq(strikeNotices.sourceHash, values.sourceHash),
      ),
    )
    .returning({ id: strikeNotices.id });

  if (existingByHash) {
    return existingByHash;
  }

  const [notice] = await db
    .insert(strikeNotices)
    .values({
      description: values.description,
      endsAt: values.endsAt,
      link: values.link,
      publishedAt: values.publishedAt,
      rawPayload: values.rawPayload,
      relevanceStatus: values.relevanceStatus,
      source: values.source,
      sourceHash: values.sourceHash,
      sourceId: values.sourceId,
      startsAt: values.startsAt,
      title: values.title,
    })
    .onConflictDoUpdate({
      set: {
        description: values.description,
        endsAt: values.endsAt,
        lastSeenAt: sql`now()`,
        link: values.link,
        publishedAt: values.publishedAt,
        rawPayload: values.rawPayload,
        relevanceStatus: values.relevanceStatus,
        sourceHash: values.sourceHash,
        startsAt: values.startsAt,
        title: values.title,
        updatedAt: sql`now()`,
      },
      target: [strikeNotices.source, strikeNotices.sourceId],
    })
    .returning({ id: strikeNotices.id });

  if (!notice) {
    throw new Error("Failed to upsert strike notice");
  }

  return notice;
}

export async function getRelevantStrikeNotices({
  db,
  limit = 20,
  source,
}: {
  db: Db;
  limit?: number;
  source?: string;
}) {
  const result = await db.execute(sql<StrikeNoticeRow>`
    SELECT
      id,
      source,
      title,
      description,
      link,
      published_at AS "publishedAt",
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      relevance_status AS "relevanceStatus"
    FROM strike_notices
    WHERE relevance_status IN ('definite', 'possible')
      AND (${source ?? null}::text IS NULL OR source = ${source ?? null})
      AND starts_at IS NOT NULL
      AND COALESCE(ends_at, starts_at) >= now()
    ORDER BY
      CASE relevance_status
        WHEN 'definite' THEN 0
        ELSE 1
      END,
      COALESCE(starts_at, published_at, last_seen_at) ASC,
      title
    LIMIT ${limit}
  `);

  return getQueryRows<StrikeNoticeRow>(result);
}

export async function getSeverityOneGlobalRealtimeNews({
  db,
  limit = 20,
  source,
}: {
  db: Db;
  limit?: number;
  source?: string;
}) {
  const result = await db.execute(sql<ActiveRealtimeAlertRow>`
    SELECT
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
    WHERE gtfs_realtime_alerts.ended_at IS NULL
      AND gtfs_realtime_alerts.severity_level = 1
      AND (${source ?? null}::text IS NULL OR gtfs_realtime_alerts.source = ${source ?? null})
      AND NOT EXISTS (
        SELECT 1
        FROM gtfs_realtime_alert_informed_entities
        WHERE gtfs_realtime_alert_informed_entities.alert_id = gtfs_realtime_alerts.id
          AND (
            gtfs_realtime_alert_informed_entities.stop_id IS NOT NULL
            OR gtfs_realtime_alert_informed_entities.route_id IS NOT NULL
            OR gtfs_realtime_alert_informed_entities.trip_id IS NOT NULL
            OR gtfs_realtime_alert_informed_entities.trip_route_id IS NOT NULL
          )
      )
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
    ORDER BY
      gtfs_realtime_alerts.last_seen_at DESC,
      gtfs_realtime_alerts.feed_entity_id
    LIMIT ${limit}
  `);

  return getQueryRows<ActiveRealtimeAlertRow>(result);
}
