import type { IncomingMessage, ServerResponse } from "node:http";
import { createHTTPServer } from "@trpc/server/adapters/standalone";

import { appRouter, createContext } from "@prossimo-app/api";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "0.0.0.0";
const TRPC_BASE_PATH = "/trpc";

function parsePort(value: string | undefined) {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

function getAllowedOrigin(origin: string | undefined) {
  const configuredOrigins = process.env.API_CORS_ORIGIN?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin || !configuredOrigins?.length) {
    return "*";
  }

  return configuredOrigins.includes("*") || configuredOrigins.includes(origin)
    ? origin
    : null;
}

function corsMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const allowedOrigin = getAllowedOrigin(req.headers.origin);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,content-type,x-language",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  next();
}

const port = parsePort(process.env.PORT);
const host = process.env.HOST ?? DEFAULT_HOST;

const server = createHTTPServer({
  basePath: `${TRPC_BASE_PATH}/`,
  createContext,
  middleware: corsMiddleware,
  onError({ error, path }) {
    console.error(`tRPC error on ${path ?? "<unknown>"}`, error);
  },
  router: appRouter,
});

server.listen(port, host, () => {
  console.log(
    `API server listening at http://${host}:${port}${TRPC_BASE_PATH}`,
  );
});
