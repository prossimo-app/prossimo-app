import { z } from "zod";

import { rateLimitedProcedure, router } from "../trpc.js";

export const healthRouter = router({
  check: rateLimitedProcedure("healthCheck").query(({ ctx }) => ({
    requestId: ctx.requestId,
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
  })),
  echo: rateLimitedProcedure("healthEcho")
    .input(
      z.object({
        message: z.string().min(1).max(500),
      }),
    )
    .query(({ ctx, input }) => ({
      message: input.message,
      requestId: ctx.requestId,
    })),
});
