import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getActiveRealtimeAlerts,
  getActiveRealtimeAlertsForRoute,
  getActiveRealtimeAlertsForStop,
} from "@prossimo-app/db";

import type { Context } from "../context.js";
import { rateLimitedProcedure, router } from "../trpc.js";

const getActiveAlertsInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  source: z.string().min(1).max(64).default("gtt"),
});
const routeTypeSchema = z.enum(["bus", "metro", "rail", "tram", "unknown"]);
const getStopAlertsInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  source: z.string().min(1).max(64).default("gtt"),
  stopCode: z.string().min(1).max(200).nullish(),
  stopId: z.string().min(1).max(200),
});
const getRouteAlertsInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  routeId: z.string().min(1).max(200),
  routeType: routeTypeSchema.nullish(),
  source: z.string().min(1).max(64).default("gtt"),
});

function getDb(ctx: Pick<Context, "db">) {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "DATABASE_URL is required for alerts queries",
    });
  }

  return ctx.db;
}

function normalizeTranslatedText(
  value: { translations: { language: string | null; text: string }[] } | null,
) {
  return {
    translations: value?.translations ?? [],
  };
}

function pickTranslatedText(
  value: { translations: { language: string | null; text: string }[] } | null,
) {
  return (
    value?.translations.find((translation) => translation.language === "it")
      ?.text ??
    value?.translations.find((translation) => translation.language === "it-IT")
      ?.text ??
    value?.translations.find((translation) => translation.language === null)
      ?.text ??
    value?.translations[0]?.text ??
    ""
  );
}

function serializeTimestamp(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}

function normalizeRouteType(
  routeType: z.infer<typeof routeTypeSchema>,
): number | null {
  if (routeType === "tram") {
    return 0;
  }

  if (routeType === "metro") {
    return 1;
  }

  if (routeType === "rail") {
    return 2;
  }

  if (routeType === "bus") {
    return 3;
  }

  return null;
}

function serializeAlert(alert: Awaited<ReturnType<typeof getActiveRealtimeAlerts>>[number]) {
  return {
    activePeriods: alert.activePeriods,
    cause: alert.cause,
    description: pickTranslatedText(alert.descriptionText),
    descriptionText: normalizeTranslatedText(alert.descriptionText),
    effect: alert.effect,
    feedEntityId: alert.feedEntityId,
    firstSeenAt: serializeTimestamp(alert.firstSeenAt),
    headerText: normalizeTranslatedText(alert.headerText),
    id: alert.id,
    lastSeenAt: serializeTimestamp(alert.lastSeenAt),
    severityLevel: alert.severityLevel,
    source: alert.source,
    title: pickTranslatedText(alert.headerText),
    url: normalizeTranslatedText(alert.url),
  };
}

export const alertsRouter = router({
  getActive: rateLimitedProcedure("alerts")
    .input(getActiveAlertsInput)
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const alerts = await getActiveRealtimeAlerts({
        db,
        limit: input.limit,
        source: input.source,
      });

      return {
        alerts: alerts.map(serializeAlert),
      };
    }),
  getForRoute: rateLimitedProcedure("alerts")
    .input(getRouteAlertsInput)
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const alerts = await getActiveRealtimeAlertsForRoute({
        db,
        limit: input.limit,
        routeId: input.routeId,
        routeType: input.routeType ? normalizeRouteType(input.routeType) : null,
        source: input.source,
      });

      return {
        alerts: alerts.map(serializeAlert),
      };
    }),
  getForStop: rateLimitedProcedure("alerts")
    .input(getStopAlertsInput)
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const alerts = await getActiveRealtimeAlertsForStop({
        db,
        limit: input.limit,
        source: input.source,
        stopIds: [input.stopId, input.stopCode]
          .filter((stopId): stopId is string => Boolean(stopId)),
      });

      return {
        alerts: alerts.map(serializeAlert),
      };
    }),
});
