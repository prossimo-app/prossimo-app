import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getRelevantStrikeNotices,
  getSeverityOneGlobalRealtimeNews,
} from "@prossimo-app/db";
import type {
  ActiveRealtimeAlertRow,
  StrikeNoticeRow,
} from "@prossimo-app/db";

import type { Context } from "../context.js";
import { rateLimitedProcedure, router } from "../trpc.js";

const getLatestNewsInput = z.object({
  globalNewsLimit: z.number().int().min(1).max(50).default(20),
  strikeLimit: z.number().int().min(1).max(50).default(20),
});

function getDb(ctx: Pick<Context, "db">) {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "DATABASE_URL is required for news queries",
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

function serializeTimestamp(value: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}

function serializeGlobalNews(alert: ActiveRealtimeAlertRow) {
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
    publishedAt: serializeTimestamp(alert.lastSeenAt),
    severityLevel: alert.severityLevel,
    source: alert.source,
    title: pickTranslatedText(alert.headerText),
    url: normalizeTranslatedText(alert.url),
  };
}

function serializeStrike(strike: StrikeNoticeRow) {
  return {
    description: strike.description,
    endsAt: serializeTimestamp(strike.endsAt),
    id: strike.id,
    link: strike.link,
    publishedAt: serializeTimestamp(strike.publishedAt),
    relevanceStatus: strike.relevanceStatus,
    source: strike.source,
    startsAt: serializeTimestamp(strike.startsAt),
    title: strike.title,
  };
}

export const newsRouter = router({
  getLatest: rateLimitedProcedure("news")
    .input(
      getLatestNewsInput.default({
        globalNewsLimit: 20,
        strikeLimit: 20,
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const [strikes, globalNews] = await Promise.all([
        getRelevantStrikeNotices({
          db,
          limit: input.strikeLimit,
          source: "mit_strike",
        }),
        getSeverityOneGlobalRealtimeNews({
          db,
          limit: input.globalNewsLimit,
          source: "gtt",
        }),
      ]);

      return {
        globalNews: globalNews.map(serializeGlobalNews),
        strikes: strikes.map(serializeStrike),
      };
    }),
});
