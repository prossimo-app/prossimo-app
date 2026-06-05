import { jobs } from "./jobs/index.js";
import { startScheduler } from "./scheduler.js";

const abortController = new AbortController();

function shutdown(signalName: NodeJS.Signals) {
  console.log(`Received ${signalName}; stopping worker`);
  abortController.abort();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

if (jobs.length === 0) {
  console.log("Worker started with no scheduled jobs");
} else {
  console.log(`Worker started with ${jobs.length} scheduled job(s)`);
}

startScheduler(jobs, abortController.signal);
