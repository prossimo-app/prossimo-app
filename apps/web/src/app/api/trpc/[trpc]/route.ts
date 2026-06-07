import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createFetchContext } from "@prossimo-app/api";

const TRPC_ENDPOINT = "/api/trpc";

function getAllowedOrigin(origin: string | null) {
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

function applyCorsHeaders(headers: Headers, request: Request) {
  const allowedOrigin = getAllowedOrigin(request.headers.get("origin"));

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Headers", "authorization,content-type");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function optionsHandler(request: Request) {
  const headers = new Headers();

  applyCorsHeaders(headers, request);

  return new Response(null, {
    headers,
    status: 204,
  });
}

async function handler(request: Request) {
  const response = await fetchRequestHandler({
    createContext: createFetchContext,
    endpoint: TRPC_ENDPOINT,
    onError({ error, path }) {
      console.error(`tRPC error on ${path ?? "<unknown>"}`, error);
    },
    req: request,
    router: appRouter,
  });

  const headers = new Headers(response.headers);

  applyCorsHeaders(headers, request);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export { handler as GET, optionsHandler as OPTIONS, handler as POST };
