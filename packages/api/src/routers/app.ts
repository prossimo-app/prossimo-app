import { TRPCError } from "@trpc/server";

import { appSettings, getQueryRows, inArray, sql } from "@prossimo-app/db";

import type { Context } from "../context.js";
import { rateLimitedProcedure, router } from "../trpc.js";

const APP_SETTING_KEYS = [
  "attribution_text",
  "maintenance_mode",
  "min_supported_app_version",
] as const;

function getDb(ctx: Pick<Context, "db">) {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "DATABASE_URL is required for app bootstrap",
    });
  }

  return ctx.db;
}

function readBooleanSetting(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

interface ActiveFeedVersionRow {
  endDate: string | null;
  id: string;
  startDate: string | null;
}

export const appRouter = router({
  getBootstrap: rateLimitedProcedure("appBootstrap").query(async ({ ctx }) => {
    const db = getDb(ctx);

    const [activeFeedVersion, settings] = await Promise.all([
      db.execute(sql<ActiveFeedVersionRow>`
        WITH configured_feed AS (
          SELECT value::uuid AS feed_version_id
          FROM app_settings
          WHERE key = 'active_gtfs_feed_version_id'
            AND value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ORDER BY updated_at DESC
          LIMIT 1
        ),
        active_feed AS (
          SELECT id, "endDate", "startDate"
          FROM (
            SELECT
              gtfs_feed_versions.id,
              gtfs_feed_versions.service_end_date AS "endDate",
              gtfs_feed_versions.service_start_date AS "startDate",
              0 AS priority,
              gtfs_feed_versions.activated_at
            FROM gtfs_feed_versions
            WHERE gtfs_feed_versions.id = (
              SELECT feed_version_id FROM configured_feed LIMIT 1
            )
              AND gtfs_feed_versions.status = 'imported'
              AND gtfs_feed_versions.service_start_date IS NOT NULL
              AND gtfs_feed_versions.service_end_date IS NOT NULL

            UNION ALL

            SELECT
              gtfs_feed_versions.id,
              gtfs_feed_versions.service_end_date AS "endDate",
              gtfs_feed_versions.service_start_date AS "startDate",
              1 AS priority,
              gtfs_feed_versions.activated_at
            FROM gtfs_feed_versions
            WHERE NOT EXISTS (SELECT 1 FROM configured_feed)
              AND gtfs_feed_versions.status = 'imported'
              AND gtfs_feed_versions.activated_at IS NOT NULL
              AND gtfs_feed_versions.service_start_date IS NOT NULL
              AND gtfs_feed_versions.service_end_date IS NOT NULL
          ) active_feed_candidates
          ORDER BY priority, activated_at DESC NULLS LAST
          LIMIT 1
        )
        SELECT active_feed.id, active_feed."endDate", active_feed."startDate"
        FROM active_feed
        LIMIT 1
      `),
      db
        .select({
          key: appSettings.key,
          value: appSettings.value,
        })
        .from(appSettings)
        .where(inArray(appSettings.key, APP_SETTING_KEYS)),
    ]);

    const feedVersion = getQueryRows<ActiveFeedVersionRow>(activeFeedVersion)[0];

    if (!feedVersion?.startDate || !feedVersion.endDate) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: ctx.t("serverErrors.noActiveFeedVersion"),
      });
    }

    const settingByKey = new Map(
      settings.map((setting) => [setting.key, setting.value]),
    );

    return {
      activeFeedVersionId: feedVersion.id,
      config: {
        attributionText: settingByKey.get("attribution_text") ?? "",
        maintenanceMode: readBooleanSetting(
          settingByKey.get("maintenance_mode"),
          false,
        ),
        minSupportedAppVersion: settingByKey.get("min_supported_app_version"),
      },
      feedServiceRange: {
        endDate: feedVersion.endDate,
        startDate: feedVersion.startDate,
      },
    };
  }),
});
