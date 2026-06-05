import type { ScheduledJob } from "../scheduler.js";
import {
  pollGttGtfsRealtimeAlertsJob,
  pollGttGtfsRealtimeTripUpdatesJob,
  pollGttGtfsRealtimeVehiclePositionsJob,
} from "./gtfs-realtime.js";
import { cleanupRealtimeTopicsJob } from "./cleanup-realtime-topics.js";
import { syncGtfsStaticJob } from "./sync-gtfs-static.js";

export const jobs: ScheduledJob[] = [
  syncGtfsStaticJob,
  pollGttGtfsRealtimeVehiclePositionsJob,
  pollGttGtfsRealtimeTripUpdatesJob,
  pollGttGtfsRealtimeAlertsJob,
  cleanupRealtimeTopicsJob,
];
