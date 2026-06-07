import type { ScheduledJob } from "../scheduler.js";
import { cleanupRealtimeTopicsJob } from "./cleanup-realtime-topics.js";
import {
  pollGttGtfsRealtimeAlertsJob,
  pollGttGtfsRealtimeVehiclePositionsJob,
} from "./gtfs-realtime.js";
import { ingestMitStrikeFeedJob } from "./mit-strikes.js";
import { syncGtfsStaticJob } from "./sync-gtfs-static.js";

export const jobs: ScheduledJob[] = [
  syncGtfsStaticJob,
  ingestMitStrikeFeedJob,
  pollGttGtfsRealtimeVehiclePositionsJob,
  pollGttGtfsRealtimeAlertsJob,
  cleanupRealtimeTopicsJob,
];
