import {
  downloadGtfsStaticZip,
  GTFS_STATIC_TEXT_FILES,
  GTFS_STATIC_URL,
  hashGtfsStaticZip,
  readGtfsStaticTextEntries,
} from "@prossimo-app/gtfs";

import type { ScheduledJob } from "../scheduler.js";
import {
  importGtfsStaticData,
  markGtfsFeedVersionFailed,
  reserveGtfsFeedVersion,
} from "./gtfs-static/import-static-data.js";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const syncGtfsStaticJob: ScheduledJob = {
  input: {
    files: GTFS_STATIC_TEXT_FILES,
    url: GTFS_STATIC_URL,
  },
  name: "sync-gtfs-static",
  schedule: {
    hour: 3,
    minute: 0,
    type: "daily",
  },
  async run({ signal }) {
    const url = GTFS_STATIC_URL;
    const zipBuffer = await downloadGtfsStaticZip({
      signal,
      url,
    });
    const sha256Hash = hashGtfsStaticZip(zipBuffer);
    const zipByteLength = zipBuffer.byteLength;
    const feedVersion = await reserveGtfsFeedVersion({
      sha256Hash,
      sourceUrl: url,
      zipByteLength,
    });

    if (feedVersion.skipped) {
      return {
        feedVersionId: feedVersion.feedVersionId,
        sha256Hash,
        skipped: true,
        skipReason: "GTFS static ZIP hash already exists",
        status: feedVersion.status,
        zipByteLength,
      };
    }

    try {
      const textEntries = readGtfsStaticTextEntries(
        zipBuffer,
        GTFS_STATIC_TEXT_FILES,
      );
      const calendarEntry = textEntries.find(
        (entry) => entry.name === "calendar.txt",
      );
      const calendarDateEntry = textEntries.find(
        (entry) => entry.name === "calendar_dates.txt",
      );
      const routeEntry = textEntries.find(
        (entry) => entry.name === "routes.txt",
      );
      const shapeEntry = textEntries.find(
        (entry) => entry.name === "shapes.txt",
      );
      const stopEntry = textEntries.find((entry) => entry.name === "stops.txt");
      const stopTimeEntry = textEntries.find(
        (entry) => entry.name === "stop_times.txt",
      );
      const tripEntry = textEntries.find((entry) => entry.name === "trips.txt");

      if (!calendarEntry) {
        throw new Error("GTFS static ZIP did not contain calendar.txt");
      }

      if (!calendarDateEntry) {
        throw new Error("GTFS static ZIP did not contain calendar_dates.txt");
      }

      if (!routeEntry) {
        throw new Error("GTFS static ZIP did not contain routes.txt");
      }

      if (!shapeEntry) {
        throw new Error("GTFS static ZIP did not contain shapes.txt");
      }

      if (!stopEntry) {
        throw new Error("GTFS static ZIP did not contain stops.txt");
      }

      if (!stopTimeEntry) {
        throw new Error("GTFS static ZIP did not contain stop_times.txt");
      }

      if (!tripEntry) {
        throw new Error("GTFS static ZIP did not contain trips.txt");
      }

      const importResult = await importGtfsStaticData({
        calendarDateEntry,
        calendarEntry,
        feedVersionId: feedVersion.feedVersionId,
        routeEntry,
        shapeEntry,
        stopEntry,
        stopTimeEntry,
        tripEntry,
      });

      return {
        feedVersionId: feedVersion.feedVersionId,
        files: textEntries.map((entry) => ({
          byteLength: Buffer.byteLength(entry.contents),
          name: entry.name,
        })),
        import: importResult,
        sha256Hash,
        skipped: false,
        zipByteLength,
      };
    } catch (error) {
      await markGtfsFeedVersionFailed({
        errorMessage: getErrorMessage(error),
        feedVersionId: feedVersion.feedVersionId,
      });

      throw error;
    }
  },
};
