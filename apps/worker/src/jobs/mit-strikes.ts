import { createHash } from "node:crypto";

import {
  createDbClient,
  upsertStrikeNotice,
} from "@prossimo-app/db";
import type { DbClient, StrikeRelevanceStatus } from "@prossimo-app/db";

import type { ScheduledJob, WorkerContext } from "../scheduler.js";

const MIT_STRIKE_RSS_URL = "https://scioperi.mit.gov.it/mit2/public/scioperi/rss";
const MIT_STRIKE_SOURCE = "mit_strike";
const MIT_STRIKE_FETCH_TIMEOUT_MS = 15_000;

const DEFINITE_KEYWORDS = [
  "gtt",
  "gruppo torinese trasporti",
  "torino",
  "torinese",
];

const POSSIBLE_KEYWORDS = [
  "piemonte",
  "tpl",
  "trasporto pubblico locale",
  "autoferrotranvieri",
  "servizio urbano",
  "servizio suburbano",
  "metropolitana",
];

interface RssItem {
  description: string;
  guid: string;
  link: string;
  pubDate: string;
  rawXml: string;
  title: string;
}

let dbClient: DbClient | null | undefined;

function getDbClient() {
  if (dbClient !== undefined) {
    return dbClient;
  }

  dbClient = process.env.DATABASE_URL
    ? createDbClient(process.env.DATABASE_URL)
    : null;

  return dbClient;
}

function decodeXml(value: string) {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll(/&#(\d+);/g, (_match, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    )
    .replaceAll(/&#x([\da-f]+);/gi, (_match, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .trim();
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<\/p>/gi, "\n")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function getTagValue(xml: string, tagName: string) {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(
    xml,
  );

  return match ? decodeXml(match[1] ?? "") : "";
}

function parseRssItems(xml: string): RssItem[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return items.map((rawXml) => ({
    description: stripHtml(getTagValue(rawXml, "description")),
    guid: getTagValue(rawXml, "guid"),
    link: getTagValue(rawXml, "link"),
    pubDate: getTagValue(rawXml, "pubDate"),
    rawXml,
    title: stripHtml(getTagValue(rawXml, "title")),
  }));
}

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function includesKeyword(text: string, keyword: string) {
  const normalizedKeyword = normalizeForSearch(keyword);

  if (normalizedKeyword === "gtt" || normalizedKeyword === "tpl") {
    return new RegExp(`(^|\\W)${normalizedKeyword}(\\W|$)`, "i").test(text);
  }

  return text.includes(normalizedKeyword);
}

function classifyRelevance(item: RssItem): StrikeRelevanceStatus | null {
  const text = normalizeForSearch(`${item.title} ${item.description}`);

  if (DEFINITE_KEYWORDS.some((keyword) => includesKeyword(text, keyword))) {
    return "definite";
  }

  if (POSSIBLE_KEYWORDS.some((keyword) => includesKeyword(text, keyword))) {
    return "possible";
  }

  return null;
}

function parseDateValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsed = new Date(trimmedValue);

  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function parseItalianDate(value: string, endOfDay = false) {
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/u.exec(
    value,
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : endOfDay ? 23 : 0;
  const minute = match[5] ? Number(match[5]) : endOfDay ? 59 : 0;

  if (hour === 24) {
    return new Date(Date.UTC(year, month - 1, day + 1, 0, minute));
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function parseLabelledDate(text: string, labels: string[], endOfDay = false) {
  for (const label of labels) {
    const match = new RegExp(
      `${label}\\s*:?\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4}(?:\\s+\\d{1,2}[:.]\\d{2})?)`,
      "iu",
    ).exec(text);

    if (match?.[1]) {
      return parseItalianDate(match[1], endOfDay);
    }
  }

  return null;
}

function getStrikeDateRange(item: RssItem) {
  const text = `${item.title} ${item.description}`;
  const startsAt =
    parseLabelledDate(text, ["data inizio", "inizio"], false) ??
    parseItalianDate(text, false);
  const endsAt =
    parseLabelledDate(text, ["data fine", "fine"], true) ??
    (startsAt ? new Date(Date.UTC(
      startsAt.getUTCFullYear(),
      startsAt.getUTCMonth(),
      startsAt.getUTCDate(),
      23,
      59,
    )) : null);

  return { endsAt, startsAt };
}

function getStableSourceId(item: RssItem, sourceHash: string) {
  return item.guid || item.link || sourceHash;
}

async function fetchWithTimeout(url: string, signal: AbortSignal) {
  const timeoutAbortController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutAbortController.abort(
      new Error(`MIT strike RSS fetch timed out after ${MIT_STRIKE_FETCH_TIMEOUT_MS}ms`),
    );
  }, MIT_STRIKE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "user-agent": "@prossimo-app/worker MIT strike RSS poller",
      },
      signal: AbortSignal.any([signal, timeoutAbortController.signal]),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function ingestMitStrikeFeed({ signal }: WorkerContext) {
  const client = getDbClient();

  if (!client) {
    throw new Error("DATABASE_URL is required to ingest MIT strike notices");
  }

  const response = await fetchWithTimeout(MIT_STRIKE_RSS_URL, signal);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch MIT strike RSS feed: ${response.status} ${response.statusText}`,
    );
  }

  const xml = await response.text();
  const items = parseRssItems(xml);
  let definite = 0;
  let possible = 0;
  let skipped = 0;

  for (const item of items) {
    const relevanceStatus = classifyRelevance(item);

    if (!relevanceStatus) {
      skipped += 1;
      continue;
    }

    const rawPayload = {
      description: item.description,
      guid: item.guid,
      link: item.link,
      pubDate: item.pubDate,
      rawXml: item.rawXml,
      title: item.title,
    };
    const sourceHash = createHash("sha256")
      .update(JSON.stringify(rawPayload))
      .digest("hex");
    const { endsAt, startsAt } = getStrikeDateRange(item);

    await upsertStrikeNotice(client.db, {
      description: item.description || null,
      endsAt,
      link: item.link || null,
      publishedAt: parseDateValue(item.pubDate),
      rawPayload,
      relevanceStatus,
      source: MIT_STRIKE_SOURCE,
      sourceHash,
      sourceId: getStableSourceId(item, sourceHash),
      startsAt,
      title: item.title || "MIT strike notice",
    });

    if (relevanceStatus === "definite") {
      definite += 1;
    } else {
      possible += 1;
    }
  }

  return {
    definite,
    fetchedAt: new Date().toISOString(),
    items: items.length,
    possible,
    skipped,
    sourceUrl: MIT_STRIKE_RSS_URL,
  };
}

export const ingestMitStrikeFeedJob: ScheduledJob = {
  name: "ingest-mit-strike-feed",
  run: ingestMitStrikeFeed,
  runOnStart: true,
  schedule: {
    intervalMs: 60 * 60 * 1000,
    type: "interval",
  },
};
