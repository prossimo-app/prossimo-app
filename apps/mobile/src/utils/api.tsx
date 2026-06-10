import { QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  createWSClient,
  httpBatchLink,
  loggerLink,
  splitLink,
  wsLink,
} from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter, RouterInputs, RouterOutputs } from "@prossimo-app/api";
import { i18n } from "@prossimo-app/localization";

import { getBaseUrl, getWebSocketBaseUrl } from "./base-url";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const wsClient = createWSClient({
  keepAlive: {
    enabled: true,
    intervalMs: 30_000,
    pongTimeoutMs: 5_000,
  },
  lazy: {
    closeMs: 5_000,
    enabled: true,
  },
  url: `${getWebSocketBaseUrl()}/trpc`,
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
      colorMode: "ansi",
    }),
    splitLink({
      condition: (op) => op.type === "subscription",
      false: httpBatchLink({
        transformer: superjson,
        url: `${getBaseUrl()}/trpc`,
        headers() {
          const headers = new Map<string, string>();

          headers.set("x-trpc-source", "expo-react");

          if (i18n.language) {
            headers.set("x-language", i18n.language);
          }

          return headers;
        },
      }),
      true: wsLink({
        client: wsClient,
        transformer: superjson,
      }),
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

export type { RouterInputs, RouterOutputs };
