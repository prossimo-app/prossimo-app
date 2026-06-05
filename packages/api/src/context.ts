import { randomUUID } from "node:crypto";
import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

import type { DbClient } from "@prossimo-app/db";
import { createDbClient } from "@prossimo-app/db";

let dbClient: DbClient | null | undefined;
let db: DbClient["db"] | null | undefined;

export interface CreateInnerContextOptions {
  authToken?: string | null;
  clientIp?: string | null;
  country?: string | null;
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

function getBearerToken(authorization: string | undefined) {
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
  requestId = randomUUID(),
  userAgent = null,
}: CreateInnerContextOptions = {}) {
  return {
    authToken,
    clientIp,
    country,
    db: getDbClient(),
    requestId,
    userAgent,
  };
}

export function createContext({ req }: CreateHTTPContextOptions) {
  const authToken = getBearerToken(req.headers.authorization);
  const country =
    getHeaderValue(req.headers["x-vercel-ip-country"]) ??
    getHeaderValue(req.headers["cf-ipcountry"]) ??
    null;
  const userAgent = getHeaderValue(req.headers["user-agent"]) ?? null;

  return createInnerContext({
    authToken,
    clientIp: getClientIp(req),
    country,
    requestId: randomUUID(),
    userAgent,
  });
}

export type Context = ReturnType<typeof createInnerContext>;
