import { createHash } from "node:crypto";

import { readTextEntriesFromZip } from "./zip.js";

export const GTFS_STATIC_URL = "https://www.gtt.to.it/open_data/gtt_gtfs.zip";

export const GTFS_STATIC_TEXT_FILES = [
  "agency.txt",
  "routes.txt",
  "trips.txt",
  "stop_times.txt",
  "calendar.txt",
  "calendar_dates.txt",
  "stops.txt",
  "shapes.txt",
] as const;

export type GtfsStaticTextFile = (typeof GTFS_STATIC_TEXT_FILES)[number];

export interface GtfsStaticTextEntry {
  contents: string;
  name: GtfsStaticTextFile;
}

export interface GtfsStaticImportOptions {
  files?: readonly GtfsStaticTextFile[];
  signal?: AbortSignal;
  url?: string;
}

export async function downloadGtfsStaticZip({
  signal,
  url = GTFS_STATIC_URL,
}: Pick<GtfsStaticImportOptions, "signal" | "url"> = {}) {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to download GTFS static ZIP: ${response.status} ${response.statusText}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export function readGtfsStaticTextEntries(
  zipBuffer: Buffer,
  files: readonly GtfsStaticTextFile[] = GTFS_STATIC_TEXT_FILES,
) {
  const textEntries = readTextEntriesFromZip(
    zipBuffer,
    files,
  ) as GtfsStaticTextEntry[];
  const foundNames = new Set(textEntries.map((entry) => entry.name));

  for (const fileName of files) {
    if (!foundNames.has(fileName)) {
      throw new Error(`GTFS static ZIP did not contain ${fileName}`);
    }
  }

  return textEntries;
}

export function hashGtfsStaticZip(zipBuffer: Buffer) {
  return createHash("sha256").update(zipBuffer).digest("hex");
}

export async function importGtfsStaticTextEntries({
  files = GTFS_STATIC_TEXT_FILES,
  signal,
  url,
}: GtfsStaticImportOptions = {}) {
  const zipBuffer = await downloadGtfsStaticZip({ signal, url });
  const sha256Hash = hashGtfsStaticZip(zipBuffer);
  const textEntries = readGtfsStaticTextEntries(zipBuffer, files);

  return {
    sha256Hash,
    textEntries,
    zipByteLength: zipBuffer.byteLength,
  };
}
