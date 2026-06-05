import { createWorkerCaller } from "./trpc.js";

export interface WorkerContext {
  signal: AbortSignal;
}

export type JobSchedule =
  | {
      intervalMs: number;
      type: "interval";
    }
  | {
      hour: number;
      minute?: number;
      second?: number;
      type: "daily";
    };

export interface ScheduledJob {
  input?: unknown;
  name: string;
  run: (context: WorkerContext) => Promise<unknown>;
  runOnStart?: boolean;
  schedule: JobSchedule;
}

interface RunningJob {
  isRunning: boolean;
  timeout: NodeJS.Timeout | null;
}

function formatError(error: unknown) {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

function getWorkerEnvironment() {
  return (
    process.env.WORKER_ENV ??
    process.env.APP_ENV ??
    process.env.APP_VARIANT ??
    process.env.NODE_ENV ??
    "development"
  );
}

async function recordSkippedJob(job: ScheduledJob) {
  try {
    const caller = createWorkerCaller();

    await caller.scheduledJobs.recordSkippedRun({
      durationMs: 0,
      environment: getWorkerEnvironment(),
      input: job.input,
      jobName: job.name,
      result: "Job was already running",
      schedule: job.schedule,
    });
  } catch (error) {
    console.warn(
      `Failed to record skipped worker job "${job.name}"`,
      formatError(error),
    );
  }
}

async function createJobRun(job: ScheduledJob) {
  try {
    const caller = createWorkerCaller();

    return await caller.scheduledJobs.createRun({
      environment: getWorkerEnvironment(),
      input: job.input,
      jobName: job.name,
      schedule: job.schedule,
    });
  } catch (error) {
    console.warn(
      `Failed to create worker job run log for "${job.name}"`,
      formatError(error),
    );

    return null;
  }
}

async function finishJobRun(
  job: ScheduledJob,
  runId: string | null,
  values: {
    durationMs: number;
    error?: string;
    output?: unknown;
    result?: string;
    status: "failure" | "success";
  },
) {
  if (!runId) {
    return;
  }

  try {
    const caller = createWorkerCaller();

    await caller.scheduledJobs.finishRun({
      durationMs: values.durationMs,
      error: values.error,
      id: runId,
      output: values.output,
      result: values.result,
      status: values.status,
    });
  } catch (error) {
    console.warn(
      `Failed to finish worker job run log for "${job.name}"`,
      formatError(error),
    );
  }
}

function getNextDelayMs(schedule: JobSchedule) {
  if (schedule.type === "interval") {
    return schedule.intervalMs;
  }

  const minute = schedule.minute ?? 0;
  const second = schedule.second ?? 0;
  const now = new Date();
  const nextRunAt = new Date(now);

  nextRunAt.setHours(schedule.hour, minute, second, 0);

  if (nextRunAt <= now) {
    nextRunAt.setDate(nextRunAt.getDate() + 1);
  }

  return nextRunAt.getTime() - now.getTime();
}

function validateSchedule(job: ScheduledJob) {
  if (job.schedule.type === "interval") {
    if (job.schedule.intervalMs < 1) {
      throw new Error(`Worker job "${job.name}" must have a positive interval`);
    }

    return;
  }

  if (job.schedule.hour < 0 || job.schedule.hour > 23) {
    throw new Error(`Worker job "${job.name}" must use an hour from 0 to 23`);
  }

  if ((job.schedule.minute ?? 0) < 0 || (job.schedule.minute ?? 0) > 59) {
    throw new Error(`Worker job "${job.name}" must use a minute from 0 to 59`);
  }

  if ((job.schedule.second ?? 0) < 0 || (job.schedule.second ?? 0) > 59) {
    throw new Error(`Worker job "${job.name}" must use a second from 0 to 59`);
  }
}

export function startScheduler(jobs: ScheduledJob[], signal: AbortSignal) {
  const runningJobs = new Map<string, RunningJob>();

  function schedule(job: ScheduledJob, delayMs: number) {
    if (signal.aborted) {
      return;
    }

    const runningJob = runningJobs.get(job.name);

    if (!runningJob) {
      return;
    }

    runningJob.timeout = setTimeout(() => {
      void runJob(job);
    }, delayMs);
  }

  async function runJob(job: ScheduledJob) {
    const runningJob = runningJobs.get(job.name);

    if (!runningJob || signal.aborted) {
      return;
    }

    if (runningJob.isRunning) {
      console.warn(
        `Skipping worker job "${job.name}" because it is still running`,
      );
      void recordSkippedJob(job);
      schedule(job, getNextDelayMs(job.schedule));
      return;
    }

    runningJob.isRunning = true;
    const startedAt = Date.now();
    const run = await createJobRun(job);
    const runId = run?.id ?? null;

    try {
      console.log(`Starting worker job "${job.name}"`);
      const output = await job.run({ signal });
      const durationMs = Date.now() - startedAt;
      await finishJobRun(job, runId, {
        durationMs,
        output,
        result: "Job completed",
        status: "success",
      });
      console.log(`Finished worker job "${job.name}"`);
    } catch (error) {
      const formattedError = formatError(error);
      const durationMs = Date.now() - startedAt;
      await finishJobRun(job, runId, {
        durationMs,
        error: formattedError,
        result: "Job failed",
        status: "failure",
      });
      console.error(`Worker job "${job.name}" failed`, formattedError);
    } finally {
      runningJob.isRunning = false;
      schedule(job, getNextDelayMs(job.schedule));
    }
  }

  for (const job of jobs) {
    validateSchedule(job);

    runningJobs.set(job.name, {
      isRunning: false,
      timeout: null,
    });

    schedule(job, job.runOnStart ? 0 : getNextDelayMs(job.schedule));
  }

  signal.addEventListener(
    "abort",
    () => {
      for (const runningJob of runningJobs.values()) {
        if (runningJob.timeout) {
          clearTimeout(runningJob.timeout);
        }
      }
    },
    { once: true },
  );
}
