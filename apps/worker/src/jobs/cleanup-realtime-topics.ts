import {
  cleanupInactiveObservedTopics,
  getRealtimeRedisClient,
} from "@prossimo-app/api";

import type { ScheduledJob } from "../scheduler.js";

const LEGACY_RAW_GTFS_REALTIME_CACHE_KEYS = [
  "gtfs-rt:gtt:alerts:latest",
  "gtfs-rt:gtt:trip-updates:latest",
  "gtfs-rt:gtt:vehicle-positions:latest",
] as const;

async function deleteLegacyRawGtfsRealtimeCache() {
  const redis = getRealtimeRedisClient();

  if (!redis) {
    return { deletedLegacyRawKeys: 0 };
  }

  const deletedLegacyRawKeys = await redis.del(
    ...LEGACY_RAW_GTFS_REALTIME_CACHE_KEYS,
  );

  return { deletedLegacyRawKeys };
}

export const cleanupRealtimeTopicsJob: ScheduledJob = {
  name: "cleanup-realtime-topics",
  async run() {
    const [observedTopics, legacyRawCache] = await Promise.all([
      cleanupInactiveObservedTopics(),
      deleteLegacyRawGtfsRealtimeCache(),
    ]);

    return {
      ...observedTopics,
      ...legacyRawCache,
    };
  },
  runOnStart: true,
  schedule: {
    intervalMs: 60 * 1000,
    type: "interval",
  },
};
