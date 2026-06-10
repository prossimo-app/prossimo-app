import { randomUUID } from "node:crypto";
import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

import type { DbClient } from "@prossimo-app/db";
import { createDbClient } from "@prossimo-app/db";

import {
  createTranslator,
  normalizeLanguage,
  parseAcceptLanguage,
} from "./i18n.js";

let dbClient: DbClient | null | undefined;
let db: DbClient["db"] | null | undefined;

export interface CreateInnerContextOptions {
  authToken?: string | null;
  clientIp?: string | null;
  country?: string | null;
  language?: string | null;
  requestId?: string;
  userAgent?: string | null;
}

function getDbClient() {
  if (db !== undefined) {
    return db;
  }

  const databaseUrl = process.env.DATABASE_URL;

  dbClient = databaseUrl ? createDbClient(databaseUrl) : null;
  db = dbClient?.db ?? null;

  return db;
}

function getBearerToken(authorization: string | null | undefined) {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getClientIp(req: CreateHTTPContextOptions["req"]) {
  const forwardedFor = getHeaderValue(req.headers["x-forwarded-for"]);

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    getHeaderValue(req.headers["x-real-ip"]) ?? req.socket.remoteAddress ?? null
  );
}

export function createInnerContext({
  authToken = null,
  clientIp = null,
  country = null,
  language = null,
  requestId = randomUUID(),
  userAgent = null,
}: CreateInnerContextOptions = {}) {
  const resolvedLanguage = normalizeLanguage(language);

  return {
    authToken,
    clientIp,
    country,
    db: getDbClient(),
    language: resolvedLanguage,
    requestId,
    t: createTranslator(resolvedLanguage),
    userAgent,
  };
}

function createContextFromHeaders({
  authorization,
  clientIp,
  country,
  language,
  userAgent,
}: {
  authorization?: string | null;
  clientIp?: string | null;
  country?: string | null;
  language?: string | null;
  userAgent?: string | null;
}) {
  return createInnerContext({
    authToken: getBearerToken(authorization),
    clientIp: clientIp?.split(",")[0]?.trim() ?? null,
    country: country ?? null,
    language: language ?? null,
    requestId: randomUUID(),
    userAgent: userAgent ?? null,
  });
}

export function createContext({ req }: CreateHTTPContextOptions) {
  const country =
    getHeaderValue(req.headers["x-vercel-ip-country"]) ??
    getHeaderValue(req.headers["cf-ipcountry"]);
  const userAgent = getHeaderValue(req.headers["user-agent"]);
  const language =
    getHeaderValue(req.headers["x-language"]) ??
    parseAcceptLanguage(getHeaderValue(req.headers["accept-language"]));

  return createContextFromHeaders({
    authorization: req.headers.authorization,
    clientIp: getClientIp(req),
    country,
    language,
    userAgent,
  });
}

export type Context = ReturnType<typeof createInnerContext>;
