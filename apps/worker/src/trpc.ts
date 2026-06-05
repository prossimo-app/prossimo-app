import { randomUUID } from "node:crypto";

import type { AppCaller } from "@prossimo-app/api";
import { createCaller, createInnerContext } from "@prossimo-app/api";

export function createWorkerCaller(): AppCaller {
  return createCaller(createInnerContext({
    authToken: process.env.WORKER_API_TOKEN ?? "worker",
    requestId: randomUUID(),
  }));
}
