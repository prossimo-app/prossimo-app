import { eq } from "drizzle-orm";

import type { DbClient } from "./client.js";
import { scheduledJobRuns } from "./schema.js";

type Db = DbClient["db"];

export interface CreateScheduledJobRunValues {
  environment: string;
  input?: unknown;
  jobName: string;
  schedule?: unknown;
}

export interface FinishScheduledJobRunValues {
  durationMs: number;
  error?: string;
  id: string;
  output?: unknown;
  result?: string;
  status: "failure" | "success";
}

export interface RecordSkippedScheduledJobRunValues {
  durationMs: number;
  environment: string;
  input?: unknown;
  jobName: string;
  result?: string;
  schedule?: unknown;
}

export async function createScheduledJobRun(
  db: Db,
  values: CreateScheduledJobRunValues,
) {
  const [run] = await db
    .insert(scheduledJobRuns)
    .values({
      environment: values.environment,
      input: values.input,
      jobName: values.jobName,
      schedule: values.schedule,
      status: "running",
    })
    .returning({ id: scheduledJobRuns.id });

  return run ?? null;
}

export async function finishScheduledJobRun(
  db: Db,
  values: FinishScheduledJobRunValues,
) {
  await db
    .update(scheduledJobRuns)
    .set({
      durationMs: values.durationMs,
      error: values.error,
      finishedAt: new Date(),
      output: values.output,
      result: values.result,
      status: values.status,
    })
    .where(eq(scheduledJobRuns.id, values.id));
}

export async function recordSkippedScheduledJobRun(
  db: Db,
  values: RecordSkippedScheduledJobRunValues,
) {
  const [run] = await db
    .insert(scheduledJobRuns)
    .values({
      durationMs: values.durationMs,
      environment: values.environment,
      finishedAt: new Date(),
      input: values.input,
      jobName: values.jobName,
      result: values.result,
      schedule: values.schedule,
      status: "skipped",
    })
    .returning({ id: scheduledJobRuns.id });

  return run ?? null;
}
