import { createServer } from "node:http";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";

import {
  appRouter,
  createContext,
  startRealtimeTopicUpdateSubscriber,
} from "@prossimo-app/api";

const DEFAULT_PORT = 1337;
const DEFAULT_HOST = "0.0.0.0";
const WS_PATH = "/trpc";

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

const port = parsePort(process.env.WS_PORT);
const host = process.env.HOST ?? DEFAULT_HOST;
const server = createServer();
const wss = new WebSocketServer({
  path: WS_PATH,
  server,
});

startRealtimeTopicUpdateSubscriber();

const handler = applyWSSHandler({
  createContext,
  keepAlive: {
    enabled: true,
    pingMs: 30_000,
    pongWaitMs: 5_000,
  },
  onError({ error, path }) {
    console.error(`tRPC WSS error on ${path ?? "<unknown>"}`, error);
  },
  router: appRouter,
  wss,
});

function shutdown(signalName: NodeJS.Signals) {
  console.log(`Received ${signalName}; stopping websocket server`);
  handler.broadcastReconnectNotification();
  wss.close(() => {
    server.close();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

server.listen(port, host, () => {
  console.log(`WebSocket server listening at ws://${host}:${port}${WS_PATH}`);
});
