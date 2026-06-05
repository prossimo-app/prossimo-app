import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createScheduledJobRun,
  finishScheduledJobRun,
  recordSkippedScheduledJobRun,
} from "@prossimo-app/db";

import type { Context } from "../context.js";
import { protectedRateLimitedProcedure, router } from "../trpc.js";

const jsonPayloadSchema = z.unknown().optional();

function getDb(ctx: Pick<Context, "db">) {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "DATABASE_URL is required for scheduled job logging",
    });
  }

  return ctx.db;
}

export const scheduledJobsRouter = router({
  createRun: protectedRateLimitedProcedure("scheduledJobCreateRun")
    .input(
      z.object({
        environment: z.string().min(1).max(64),
        input: jsonPayloadSchema,
        jobName: z.string().min(1).max(200),
        schedule: jsonPayloadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const run = await createScheduledJobRun(db, input);

      if (!run) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create scheduled job run",
        });
      }

      return run;
    }),
  finishRun: protectedRateLimitedProcedure("scheduledJobFinishRun")
    .input(
      z.object({
        durationMs: z.number().int().nonnegative(),
        error: z.string().optional(),
        id: z.string().uuid(),
        output: jsonPayloadSchema,
        result: z.string().max(500).optional(),
        status: z.enum(["success", "failure"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb(ctx);

      await finishScheduledJobRun(db, input);

      return { id: input.id };
    }),
  recordSkippedRun: protectedRateLimitedProcedure(
    "scheduledJobRecordSkippedRun",
  )
    .input(
      z.object({
        durationMs: z.number().int().nonnegative().default(0),
        environment: z.string().min(1).max(64),
        input: jsonPayloadSchema,
        jobName: z.string().min(1).max(200),
        result: z.string().max(500).optional(),
        schedule: jsonPayloadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const run = await recordSkippedScheduledJobRun(db, input);

      if (!run) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record skipped scheduled job run",
        });
      }

      return run;
    }),
});
