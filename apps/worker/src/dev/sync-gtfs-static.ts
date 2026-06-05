import { syncGtfsStaticJob } from "../jobs/sync-gtfs-static.js";

const abortController = new AbortController();

function shutdown(signalName: NodeJS.Signals) {
  console.log(`Received ${signalName}; stopping GTFS static sync`);
  abortController.abort();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  await syncGtfsStaticJob.run({ signal: abortController.signal });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
