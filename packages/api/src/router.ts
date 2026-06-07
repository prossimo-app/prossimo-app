import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { alertsRouter } from "./routers/alerts.js";
import { appRouter as appProcedureRouter } from "./routers/app.js";
import { healthRouter } from "./routers/health.js";
import { newsRouter } from "./routers/news.js";
import { realtimeRouter } from "./routers/realtime.js";
import { scheduledJobsRouter } from "./routers/scheduled-jobs.js";
import { transitRouter } from "./routers/transit.js";
import { createCallerFactory, router } from "./trpc.js";

export const appRouter = router({
  alerts: alertsRouter,
  app: appProcedureRouter,
  health: healthRouter,
  news: newsRouter,
  realtime: realtimeRouter,
  scheduledJobs: scheduledJobsRouter,
  transit: transitRouter,
});

export const createCaller = createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;
export type AppCaller = ReturnType<typeof createCaller>;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
