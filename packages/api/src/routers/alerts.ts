import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getActiveRealtimeAlerts } from "@prossimo-app/db";

import type { Context } from "../context.js";
import { rateLimitedProcedure, router } from "../trpc.js";

const getActiveAlertsInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
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
        alerts: alerts.map((alert) => ({
          activePeriods: alert.activePeriods,
          cause: alert.cause,
          description: pickTranslatedText(alert.descriptionText),
          descriptionText: normalizeTranslatedText(alert.descriptionText),
          effect: alert.effect,
          feedEntityId: alert.feedEntityId,
          firstSeenAt: alert.firstSeenAt.toISOString(),
          headerText: normalizeTranslatedText(alert.headerText),
          id: alert.id,
          lastSeenAt: alert.lastSeenAt.toISOString(),
          severityLevel: alert.severityLevel,
          source: alert.source,
          title: pickTranslatedText(alert.headerText),
          url: normalizeTranslatedText(alert.url),
        })),
      };
    }),
});
