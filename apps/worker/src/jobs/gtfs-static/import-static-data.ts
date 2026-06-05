import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import type { PostgresJsTransactionSql } from "@prossimo-app/db";
import type { GtfsStaticTextEntry } from "@prossimo-app/gtfs";
import {
  appSettings,
  createDbClient,
  createPostgresJsClient,
  createPostgresJsDatabase,
  eq,
  getPostgresJsTransactionSql,
  gtfsFeedVersions,
  sql,
} from "@prossimo-app/db";

import { generateDerivedTables } from "./derived-tables.js";

const COMPACT_IMPORT_MODE =
  "compact_derived_v5_copy_swap_realtime_stop_times_shapes";
const ROUTE_SERVICE_WINDOW_DAYS = 90;
const ACTIVE_GTFS_FEED_VERSION_SETTING_KEY = "active_gtfs_feed_version_id";
const GTFS_STATIC_STAGE_PREFIX = "gtfs_static_stage";
type ImportGtfsStaticTextFile = Extract<
  GtfsStaticTextEntry["name"],
  | "calendar.txt"
  | "calendar_dates.txt"
  | "routes.txt"
  | "shapes.txt"
  | "stops.txt"
  | "stop_times.txt"
  | "trips.txt"
>;

interface RawGtfsImportCounts {
  calendarDates: number;
  calendars: number;
  routes: number;
  shapes: number;
  stopTimes: number;
  stops: number;
  trips: number;
}

interface ImportedGtfsCounts extends RawGtfsImportCounts {
  routeServiceDays: number;
  routeStops: number;
  serviceEndDate: string | null;
  serviceStartDate: string | null;
  stopRoutes: number;
}

interface GtfsImportCleanupResult {
  deletedFeedVersions: number;
}

const STAGE_COLUMNS_BY_FILE = {
  "calendar.txt": [
    "service_id",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "start_date",
    "end_date",
  ],
  "calendar_dates.txt": ["service_id", "date", "exception_type"],
  "routes.txt": [
    "route_id",
    "agency_id",
    "route_short_name",
    "route_long_name",
    "route_desc",
    "route_type",
    "route_url",
    "route_color",
    "route_text_color",
  ],
  "shapes.txt": [
    "shape_id",
    "shape_pt_lat",
    "shape_pt_lon",
    "shape_pt_sequence",
    "shape_dist_traveled",
  ],
  "stops.txt": [
    "stop_id",
    "stop_code",
    "stop_name",
    "stop_desc",
    "stop_lat",
    "stop_lon",
    "zone_id",
    "stop_url",
    "location_type",
    "parent_station",
    "wheelchair_boarding",
  ],
  "stop_times.txt": [
    "trip_id",
    "arrival_time",
    "departure_time",
    "stop_id",
    "stop_sequence",
    "stop_headsign",
    "pickup_type",
    "drop_off_type",
    "shape_dist_traveled",
    "timepoint",
  ],
  "trips.txt": [
    "route_id",
    "service_id",
    "trip_id",
    "trip_headsign",
    "trip_short_name",
    "direction_id",
    "block_id",
    "shape_id",
    "wheelchair_accessible",
    "bikes_allowed",
  ],
} satisfies Record<ImportGtfsStaticTextFile, readonly string[]>;

const STAGE_TABLE_BY_FILE = {
  "calendar.txt": `${GTFS_STATIC_STAGE_PREFIX}_calendars`,
  "calendar_dates.txt": `${GTFS_STATIC_STAGE_PREFIX}_calendar_dates`,
  "routes.txt": `${GTFS_STATIC_STAGE_PREFIX}_routes`,
  "shapes.txt": "shapes_import",
  "stops.txt": `${GTFS_STATIC_STAGE_PREFIX}_stops`,
  "stop_times.txt": "stop_times_import",
  "trips.txt": `${GTFS_STATIC_STAGE_PREFIX}_trips`,
} satisfies Record<ImportGtfsStaticTextFile, string>;

function hasCompactImportMetadata(metadata: unknown) {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "importMode" in metadata &&
    metadata.importMode === COMPACT_IMPORT_MODE
  );
}

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to import GTFS routes");
  }

  return databaseUrl;
}

export async function reserveGtfsFeedVersion({
  sha256Hash,
  sourceUrl,
  zipByteLength,
}: {
  sha256Hash: string;
  sourceUrl: string;
  zipByteLength: number;
}) {
  const dbClient = createDbClient(getDatabaseUrl(), { max: 1 });

  try {
    const [insertedFeedVersion] = await dbClient.db
      .insert(gtfsFeedVersions)
      .values({
        metadata: {
          zipByteLength,
        },
        sha256Hash,
        sourceUrl,
        status: "importing",
        zipByteLength,
      })
      .onConflictDoNothing({
        target: gtfsFeedVersions.sha256Hash,
      })
      .returning({
        id: gtfsFeedVersions.id,
        status: gtfsFeedVersions.status,
      });

    if (insertedFeedVersion) {
      return {
        feedVersionId: insertedFeedVersion.id,
        skipped: false,
        status: insertedFeedVersion.status,
      };
    }

    const [existingFeedVersion] = await dbClient.db
      .select({
        id: gtfsFeedVersions.id,
        metadata: gtfsFeedVersions.metadata,
        status: gtfsFeedVersions.status,
      })
      .from(gtfsFeedVersions)
      .where(eq(gtfsFeedVersions.sha256Hash, sha256Hash))
      .limit(1);

    if (!existingFeedVersion) {
      throw new Error("Failed to find existing GTFS feed version by hash");
    }

    const shouldSkip =
      existingFeedVersion.status === "imported" &&
      hasCompactImportMetadata(existingFeedVersion.metadata);

    if (!shouldSkip) {
      await dbClient.db
        .update(gtfsFeedVersions)
        .set({
          errorMessage: null,
          status: "importing",
        })
        .where(eq(gtfsFeedVersions.id, existingFeedVersion.id));
    }

    return {
      feedVersionId: existingFeedVersion.id,
      skipped: shouldSkip,
      status: shouldSkip ? existingFeedVersion.status : "importing",
    };
  } finally {
    await dbClient.close();
  }
}

export async function markGtfsFeedVersionFailed({
  errorMessage,
  feedVersionId,
}: {
  errorMessage: string;
  feedVersionId: string;
}) {
  const dbClient = createDbClient(getDatabaseUrl(), { max: 1 });

  try {
    await dbClient.db
      .update(gtfsFeedVersions)
      .set({
        errorMessage,
        status: "failed",
      })
      .where(eq(gtfsFeedVersions.id, feedVersionId));
  } finally {
    await dbClient.close();
  }
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getIntegerCount(row: Record<string, unknown>, key: string) {
  const value = row[key];

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  throw new Error(`Expected integer count for ${key}`);
}

function getNullableString(row: Record<string, unknown>, key: string) {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  throw new Error(`Expected nullable string for ${key}`);
}

function requireCountRow(row: unknown) {
  if (!isRecord(row)) {
    throw new Error("Expected GTFS import count row");
  }

  return row;
}

function parseRawCounts(row: unknown): RawGtfsImportCounts {
  const countRow = requireCountRow(row);

  return {
    calendarDates: getIntegerCount(countRow, "calendar_dates"),
    calendars: getIntegerCount(countRow, "calendars"),
    routes: getIntegerCount(countRow, "routes"),
    shapes: getIntegerCount(countRow, "shapes"),
    stopTimes: getIntegerCount(countRow, "stop_times"),
    stops: getIntegerCount(countRow, "stops"),
    trips: getIntegerCount(countRow, "trips"),
  };
}

function parseImportedCounts(row: unknown): ImportedGtfsCounts {
  const countRow = requireCountRow(row);

  return {
    ...parseRawCounts(row),
    routeServiceDays: getIntegerCount(countRow, "route_service_days"),
    routeStops: getIntegerCount(countRow, "route_stops"),
    serviceEndDate: getNullableString(countRow, "service_end_date"),
    serviceStartDate: getNullableString(countRow, "service_start_date"),
    stopRoutes: getIntegerCount(countRow, "stop_routes"),
  };
}

function readCsvHeader(text: string) {
  const headers: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);

    if (inQuotes) {
      if (character === '"') {
        if (text.charAt(index + 1) === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      headers.push(field);
      field = "";
      continue;
    }

    if (character === "\n" || character === "\r") {
      headers.push(field);
      return headers.map((header, headerIndex) =>
        headerIndex === 0 ? header.replace(/^\uFEFF/, "") : header,
      );
    }

    field += character;
  }

  if (field.length > 0) {
    headers.push(field);
  }

  return headers.map((header, headerIndex) =>
    headerIndex === 0 ? header.replace(/^\uFEFF/, "") : header,
  );
}

function getStageColumns(entry: GtfsStaticTextEntry) {
  const knownColumns =
    STAGE_COLUMNS_BY_FILE[entry.name as ImportGtfsStaticTextFile];
  const headerColumns = readCsvHeader(entry.contents).map((header) =>
    header.trim(),
  );
  const columns = new Set([...knownColumns, ...headerColumns]);

  return {
    columns: [...columns].filter((column) => column.length > 0),
    headerColumns: headerColumns.filter((column) => column.length > 0),
  };
}

async function createStageTable(
  client: PostgresJsTransactionSql,
  entry: GtfsStaticTextEntry,
) {
  const tableName = STAGE_TABLE_BY_FILE[entry.name as ImportGtfsStaticTextFile];
  const { columns, headerColumns } = getStageColumns(entry);

  if (headerColumns.length === 0) {
    throw new Error(`${entry.name} did not contain a CSV header`);
  }

  if (entry.name === "shapes.txt") {
    await dropTableIfExists(client, "shapes_import");

    await client.unsafe(`
      CREATE UNLOGGED TABLE shapes_import (
        shape_id TEXT,
        shape_pt_lat TEXT,
        shape_pt_lon TEXT,
        shape_pt_sequence INTEGER,
        shape_dist_traveled TEXT
      )
    `);

    return {
      headerColumns,
      tableName,
    };
  }

  if (entry.name === "stop_times.txt") {
    await dropTableIfExists(client, "stop_times_import");

    await client.unsafe(`
      CREATE UNLOGGED TABLE stop_times_import (
        trip_id TEXT,
        arrival_time TEXT,
        departure_time TEXT,
        stop_id TEXT,
        stop_sequence INTEGER,
        stop_headsign TEXT,
        pickup_type TEXT,
        drop_off_type TEXT,
        shape_dist_traveled TEXT,
        timepoint TEXT
      )
    `);

    return {
      headerColumns,
      tableName,
    };
  }

  await client.unsafe(`
    CREATE TEMP TABLE ${quoteIdentifier(tableName)} (
      ${columns.map((column) => `${quoteIdentifier(column)} text`).join(",\n")}
    ) ON COMMIT DROP
  `);

  return {
    headerColumns,
    tableName,
  };
}

async function copyEntryIntoStageTable(
  client: PostgresJsTransactionSql,
  entry: GtfsStaticTextEntry,
) {
  const { headerColumns, tableName } = await createStageTable(client, entry);
  const columnSql = headerColumns.map(quoteIdentifier).join(", ");
  const copyStream = await client
    .unsafe(
      `COPY ${quoteIdentifier(tableName)} (${columnSql}) FROM STDIN WITH (FORMAT csv, HEADER true)`,
    )
    .writable();

  await finished(Readable.from([entry.contents]).pipe(copyStream));
}

async function dropTableIfExists(
  client: PostgresJsTransactionSql,
  tableName: string,
) {
  const tableRows = (await client`
    SELECT to_regclass(${`public.${tableName}`}) AS table_name
  `) as unknown as readonly unknown[];
  const [tableRow] = tableRows;

  if (!isRecord(tableRow) || tableRow.table_name === null) {
    return;
  }

  await client.unsafe(`DROP TABLE ${quoteIdentifier(tableName)}`);
}

async function dropGtfsImportIndexes(client: PostgresJsTransactionSql) {
  await client.unsafe(`
    ALTER TABLE calendar_dates
      DROP CONSTRAINT IF EXISTS calendar_dates_feed_version_id_service_id_date_pk;
    ALTER TABLE calendars
      DROP CONSTRAINT IF EXISTS calendars_feed_version_id_service_id_pk;
    ALTER TABLE route_service_days
      DROP CONSTRAINT IF EXISTS route_service_days_feed_version_id_service_date_route_id_pk;
    ALTER TABLE route_stops
      DROP CONSTRAINT IF EXISTS route_stops_feed_route_direction_sequence_pk;
    ALTER TABLE routes
      DROP CONSTRAINT IF EXISTS routes_feed_version_id_route_id_pk;
    ALTER TABLE shapes
      DROP CONSTRAINT IF EXISTS shapes_feed_version_id_shape_id_shape_pt_sequence_pk;
    ALTER TABLE stop_routes
      DROP CONSTRAINT IF EXISTS stop_routes_feed_version_id_stop_id_route_id_direction_id_pk;
    ALTER TABLE stop_times
      DROP CONSTRAINT IF EXISTS stop_times_feed_version_id_trip_id_stop_sequence_pk;
    ALTER TABLE stops
      DROP CONSTRAINT IF EXISTS stops_feed_version_id_stop_id_pk;
    ALTER TABLE trips
      DROP CONSTRAINT IF EXISTS trips_feed_version_id_trip_id_pk;

    DROP INDEX IF EXISTS idx_calendar_dates_feed_date;
    DROP INDEX IF EXISTS idx_route_service_days_date;
    DROP INDEX IF EXISTS idx_route_stops_route;
    DROP INDEX IF EXISTS idx_routes_feed_short_name;
    DROP INDEX IF EXISTS idx_shapes_feed_shape;
    DROP INDEX IF EXISTS idx_stop_routes_route;
    DROP INDEX IF EXISTS idx_stop_routes_stop;
    DROP INDEX IF EXISTS idx_stop_times_feed_stop;
    DROP INDEX IF EXISTS idx_stop_times_feed_trip;
    DROP INDEX IF EXISTS idx_stop_times_stop_departure;
    DROP INDEX IF EXISTS idx_stops_feed_code;
    DROP INDEX IF EXISTS idx_stops_location;
    DROP INDEX IF EXISTS idx_stops_name;
    DROP INDEX IF EXISTS idx_trips_feed_route;
    DROP INDEX IF EXISTS idx_trips_feed_service;
    DROP INDEX IF EXISTS idx_trips_feed_shape;
  `);
}

async function recreateGtfsImportIndexes(client: PostgresJsTransactionSql) {
  await client.unsafe(`
    ALTER TABLE calendar_dates
      ADD CONSTRAINT calendar_dates_feed_version_id_service_id_date_pk
      PRIMARY KEY (feed_version_id, service_id, date);
    ALTER TABLE calendars
      ADD CONSTRAINT calendars_feed_version_id_service_id_pk
      PRIMARY KEY (feed_version_id, service_id);
    ALTER TABLE routes
      ADD CONSTRAINT routes_feed_version_id_route_id_pk
      PRIMARY KEY (feed_version_id, route_id);
    ALTER TABLE shapes
      ADD CONSTRAINT shapes_feed_version_id_shape_id_shape_pt_sequence_pk
      PRIMARY KEY (feed_version_id, shape_id, shape_pt_sequence);
    ALTER TABLE stops
      ADD CONSTRAINT stops_feed_version_id_stop_id_pk
      PRIMARY KEY (feed_version_id, stop_id);
    ALTER TABLE trips
      ADD CONSTRAINT trips_feed_version_id_trip_id_pk
      PRIMARY KEY (feed_version_id, trip_id);
    ALTER TABLE stop_routes
      ADD CONSTRAINT stop_routes_feed_version_id_stop_id_route_id_direction_id_pk
      PRIMARY KEY (feed_version_id, stop_id, route_id, direction_id);
    ALTER TABLE route_stops
      ADD CONSTRAINT route_stops_feed_route_direction_sequence_pk
      PRIMARY KEY (feed_version_id, route_id, direction_id, stop_sequence);
    ALTER TABLE route_service_days
      ADD CONSTRAINT route_service_days_feed_version_id_service_date_route_id_pk
      PRIMARY KEY (feed_version_id, service_date, route_id);

    CREATE INDEX idx_calendar_dates_feed_date
      ON calendar_dates USING btree (feed_version_id, date);
    CREATE INDEX idx_routes_feed_short_name
      ON routes USING btree (feed_version_id, route_short_name);
    CREATE INDEX idx_shapes_feed_shape
      ON shapes USING btree (feed_version_id, shape_id);
    CREATE INDEX idx_stops_location
      ON stops USING gist (location);
    CREATE INDEX idx_stops_name
      ON stops USING gin (to_tsvector('simple', stop_name));
    CREATE INDEX idx_stops_feed_code
      ON stops USING btree (feed_version_id, stop_code);
    CREATE INDEX idx_trips_feed_route
      ON trips USING btree (feed_version_id, route_id);
    CREATE INDEX idx_trips_feed_service
      ON trips USING btree (feed_version_id, service_id);
    CREATE INDEX idx_trips_feed_shape
      ON trips USING btree (feed_version_id, shape_id);
    CREATE INDEX idx_stop_routes_stop
      ON stop_routes USING btree (feed_version_id, stop_id);
    CREATE INDEX idx_stop_routes_route
      ON stop_routes USING btree (feed_version_id, route_id);
    CREATE INDEX idx_route_stops_route
      ON route_stops USING btree (feed_version_id, route_id, direction_id);
    CREATE INDEX idx_route_service_days_date
      ON route_service_days USING btree (feed_version_id, service_date);
  `);
}

async function createAndSwapStopTimesTable(
  client: PostgresJsTransactionSql,
  feedVersionId: string,
  previousFeedVersionId: string | null,
) {
  await dropTableIfExists(client, "stop_times_new");

  await client`
    CREATE UNLOGGED TABLE stop_times_new AS
    SELECT
      feed_version_id,
      trip_id,
      arrival_time,
      departure_time,
      arrival_seconds,
      departure_seconds,
      stop_id,
      stop_sequence,
      stop_headsign,
      pickup_type,
      drop_off_type,
      shape_dist_traveled,
      timepoint
    FROM stop_times
    WHERE ${previousFeedVersionId}::uuid IS NOT NULL
      AND feed_version_id = ${previousFeedVersionId}::uuid

    UNION ALL

    SELECT DISTINCT ON (
      ${feedVersionId}::uuid,
      NULLIF(BTRIM(trip_id), ''),
      stop_sequence
    )
      ${feedVersionId}::uuid AS feed_version_id,
      NULLIF(BTRIM(trip_id), '') AS trip_id,
      NULLIF(BTRIM(arrival_time), '') AS arrival_time,
      NULLIF(BTRIM(departure_time), '') AS departure_time,
      CASE
        WHEN arrival_time ~ '^\\d+:[0-5]\\d:[0-5]\\d$'
          THEN (
            SPLIT_PART(arrival_time, ':', 1)::integer * 3600
            + SPLIT_PART(arrival_time, ':', 2)::integer * 60
            + SPLIT_PART(arrival_time, ':', 3)::integer
          )
        ELSE NULL
      END AS arrival_seconds,
      CASE
        WHEN departure_time ~ '^\\d+:[0-5]\\d:[0-5]\\d$'
          THEN (
            SPLIT_PART(departure_time, ':', 1)::integer * 3600
            + SPLIT_PART(departure_time, ':', 2)::integer * 60
            + SPLIT_PART(departure_time, ':', 3)::integer
          )
        ELSE NULL
      END AS departure_seconds,
      NULLIF(BTRIM(stop_id), '') AS stop_id,
      stop_sequence,
      NULLIF(BTRIM(stop_headsign), '') AS stop_headsign,
      CASE
        WHEN pickup_type ~ '^-?\\d+$' THEN pickup_type::integer
        ELSE NULL
      END AS pickup_type,
      CASE
        WHEN drop_off_type ~ '^-?\\d+$' THEN drop_off_type::integer
        ELSE NULL
      END AS drop_off_type,
      CASE
        WHEN shape_dist_traveled ~ '^-?(\\d+(\\.\\d*)?|\\.\\d+)$'
          THEN shape_dist_traveled::double precision
        ELSE NULL
      END AS shape_dist_traveled,
      CASE
        WHEN timepoint ~ '^-?\\d+$' THEN timepoint::integer
        ELSE NULL
      END AS timepoint
    FROM stop_times_import
    WHERE NULLIF(BTRIM(trip_id), '') IS NOT NULL
    AND NULLIF(BTRIM(stop_id), '') IS NOT NULL
    AND stop_sequence IS NOT NULL
  `;

  await client.unsafe(`
    ALTER TABLE stop_times_new
      ALTER COLUMN feed_version_id SET NOT NULL,
      ALTER COLUMN trip_id SET NOT NULL,
      ALTER COLUMN stop_id SET NOT NULL,
      ALTER COLUMN stop_sequence SET NOT NULL;

    ALTER TABLE stop_times_new
      ADD CONSTRAINT stop_times_feed_version_id_trip_id_stop_sequence_pk
      PRIMARY KEY (feed_version_id, trip_id, stop_sequence);

    CREATE INDEX idx_stop_times_feed_stop
      ON stop_times_new USING btree (feed_version_id, stop_id);
    CREATE INDEX idx_stop_times_feed_trip
      ON stop_times_new USING btree (feed_version_id, trip_id);
    CREATE INDEX idx_stop_times_stop_departure
      ON stop_times_new USING btree (feed_version_id, stop_id, departure_seconds);

    ANALYZE stop_times_new;
  `);

  await dropTableIfExists(client, "stop_times_old");

  await client.unsafe(`
    ALTER TABLE stop_times RENAME TO stop_times_old;
    ALTER TABLE stop_times_new RENAME TO stop_times;
  `);
}

async function analyzeGtfsImportTables(client: PostgresJsTransactionSql) {
  await client.unsafe(`
    ANALYZE calendar_dates;
    ANALYZE calendars;
    ANALYZE route_service_days;
    ANALYZE route_stops;
    ANALYZE routes;
    ANALYZE shapes;
    ANALYZE stop_routes;
    ANALYZE stop_times;
    ANALYZE stops;
    ANALYZE trips;
  `);
}

async function cleanupGtfsImportStageTables(client: PostgresJsTransactionSql) {
  await dropTableIfExists(client, "shapes_import");
  await dropTableIfExists(client, "stop_times_old");
  await dropTableIfExists(client, "stop_times_import");
}

async function getPreviousImportedGtfsFeedVersionId(
  client: PostgresJsTransactionSql,
  feedVersionId: string,
) {
  const rows = (await client`
    SELECT id::text AS id
    FROM gtfs_feed_versions
    WHERE id <> ${feedVersionId}::uuid
      AND status = 'imported'
      AND imported_at IS NOT NULL
    ORDER BY
      activated_at DESC NULLS LAST,
      imported_at DESC,
      downloaded_at DESC
    LIMIT 1
  `) as unknown as readonly unknown[];
  const [row] = rows;

  if (!isRecord(row)) {
    return null;
  }

  return getNullableString(row, "id");
}

async function deleteCurrentGtfsFeedData(
  client: PostgresJsTransactionSql,
  feedVersionId: string,
) {
  await client`
    DELETE FROM route_service_days WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM route_stops WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM stop_routes WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM agencies WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM calendar_dates WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM calendars WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM routes WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM shapes WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM stops WHERE feed_version_id = ${feedVersionId}::uuid
  `;
  await client`
    DELETE FROM trips WHERE feed_version_id = ${feedVersionId}::uuid
  `;
}

async function cleanupOldGtfsFeedVersions({
  client,
  feedVersionId,
  previousFeedVersionId,
}: {
  client: PostgresJsTransactionSql;
  feedVersionId: string;
  previousFeedVersionId: string | null;
}): Promise<GtfsImportCleanupResult> {
  const deletedRows = (await client`
    DELETE FROM gtfs_feed_versions
    WHERE id IN (
      SELECT id
      FROM gtfs_feed_versions
      WHERE status = 'imported'
        AND imported_at IS NOT NULL
        AND id <> ${feedVersionId}::uuid
        AND (
          ${previousFeedVersionId}::uuid IS NULL
          OR id <> ${previousFeedVersionId}::uuid
        )
    )
    RETURNING id
  `) as unknown as readonly unknown[];

  return {
    deletedFeedVersions: deletedRows.length,
  };
}

export async function importGtfsStaticData({
  calendarDateEntry,
  calendarEntry,
  feedVersionId,
  routeEntry,
  shapeEntry,
  stopEntry,
  stopTimeEntry,
  tripEntry,
}: {
  calendarDateEntry: GtfsStaticTextEntry;
  calendarEntry: GtfsStaticTextEntry;
  feedVersionId: string;
  routeEntry: GtfsStaticTextEntry;
  shapeEntry: GtfsStaticTextEntry;
  stopEntry: GtfsStaticTextEntry;
  stopTimeEntry: GtfsStaticTextEntry;
  tripEntry: GtfsStaticTextEntry;
}) {
  const importSql = createPostgresJsClient(getDatabaseUrl(), { max: 1 });
  const importDb = createPostgresJsDatabase(importSql);

  try {
    return await importDb.transaction(async (tx) => {
      const txSql = getPostgresJsTransactionSql(tx);
      const previousFeedVersionId = await getPreviousImportedGtfsFeedVersionId(
        txSql,
        feedVersionId,
      );
      const entries = [
        calendarEntry,
        calendarDateEntry,
        routeEntry,
        shapeEntry,
        stopEntry,
        tripEntry,
        stopTimeEntry,
      ];

      for (const entry of entries) {
        await copyEntryIntoStageTable(txSql, entry);
      }

      const rawCountRows = (await txSql`
    SELECT
      (SELECT COUNT(*)::integer FROM gtfs_static_stage_calendars) AS calendars,
      (SELECT COUNT(*)::integer FROM gtfs_static_stage_calendar_dates) AS calendar_dates,
      (SELECT COUNT(*)::integer FROM gtfs_static_stage_routes) AS routes,
      (SELECT COUNT(*)::integer FROM shapes_import) AS shapes,
      (SELECT COUNT(*)::integer FROM gtfs_static_stage_stops) AS stops,
      (SELECT COUNT(*)::integer FROM gtfs_static_stage_trips) AS trips,
      (SELECT COUNT(*)::integer FROM stop_times_import) AS stop_times
  `) as unknown as readonly unknown[];
      const rawCounts = parseRawCounts(rawCountRows[0]);

      await dropGtfsImportIndexes(txSql);

      await deleteCurrentGtfsFeedData(txSql, feedVersionId);

      await tx.execute(sql`
        INSERT INTO calendars (
          feed_version_id,
          service_id,
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          sunday,
          start_date,
          end_date
        )
        SELECT DISTINCT ON (NULLIF(BTRIM(service_id), ''))
          ${feedVersionId}::uuid,
          NULLIF(BTRIM(service_id), ''),
          monday = '1',
          tuesday = '1',
          wednesday = '1',
          thursday = '1',
          friday = '1',
          saturday = '1',
          sunday = '1',
          TO_DATE(start_date, 'YYYYMMDD'),
          TO_DATE(end_date, 'YYYYMMDD')
        FROM gtfs_static_stage_calendars
        WHERE NULLIF(BTRIM(service_id), '') IS NOT NULL
        AND monday IN ('0', '1')
        AND tuesday IN ('0', '1')
        AND wednesday IN ('0', '1')
        AND thursday IN ('0', '1')
        AND friday IN ('0', '1')
        AND saturday IN ('0', '1')
        AND sunday IN ('0', '1')
        AND start_date ~ '^\\d{8}$'
        AND end_date ~ '^\\d{8}$'
        AND TO_CHAR(TO_DATE(start_date, 'YYYYMMDD'), 'YYYYMMDD') = start_date
        AND TO_CHAR(TO_DATE(end_date, 'YYYYMMDD'), 'YYYYMMDD') = end_date
      `);

      await tx.execute(sql`
        INSERT INTO calendar_dates (
          feed_version_id,
          service_id,
          date,
          exception_type
        )
        SELECT DISTINCT ON (
          NULLIF(BTRIM(service_id), ''),
          TO_DATE(date, 'YYYYMMDD')
        )
          ${feedVersionId}::uuid,
          NULLIF(BTRIM(service_id), ''),
          TO_DATE(date, 'YYYYMMDD'),
          exception_type::integer
        FROM gtfs_static_stage_calendar_dates
        WHERE NULLIF(BTRIM(service_id), '') IS NOT NULL
        AND date ~ '^\\d{8}$'
        AND TO_CHAR(TO_DATE(date, 'YYYYMMDD'), 'YYYYMMDD') = date
        AND exception_type IN ('1', '2')
      `);

      await tx.execute(sql`
        INSERT INTO routes (
          feed_version_id,
          route_id,
          agency_id,
          route_short_name,
          route_long_name,
          route_desc,
          route_type,
          route_url,
          route_color,
          route_text_color
        )
        SELECT DISTINCT ON (NULLIF(BTRIM(route_id), ''))
          ${feedVersionId}::uuid,
          NULLIF(BTRIM(route_id), ''),
          NULLIF(BTRIM(agency_id), ''),
          NULLIF(BTRIM(route_short_name), ''),
          NULLIF(BTRIM(route_long_name), ''),
          NULLIF(BTRIM(route_desc), ''),
          route_type::integer,
          NULLIF(BTRIM(route_url), ''),
          NULLIF(BTRIM(route_color), ''),
          NULLIF(BTRIM(route_text_color), '')
        FROM gtfs_static_stage_routes
        WHERE NULLIF(BTRIM(route_id), '') IS NOT NULL
        AND route_type ~ '^\\d+$'
        AND route_type::integer IN (0, 1, 2, 3)
      `);

      await tx.execute(sql`
        INSERT INTO shapes (
          feed_version_id,
          shape_id,
          shape_pt_lat,
          shape_pt_lon,
          shape_pt_sequence,
          shape_dist_traveled
        )
        SELECT DISTINCT ON (
          NULLIF(BTRIM(shape_id), ''),
          shape_pt_sequence
        )
          ${feedVersionId}::uuid,
          NULLIF(BTRIM(shape_id), ''),
          shape_pt_lat::double precision,
          shape_pt_lon::double precision,
          shape_pt_sequence,
          CASE
            WHEN shape_dist_traveled ~ '^-?(\\d+(\\.\\d*)?|\\.\\d+)$'
              THEN shape_dist_traveled::double precision
            ELSE NULL
          END
        FROM shapes_import
        WHERE NULLIF(BTRIM(shape_id), '') IS NOT NULL
        AND shape_pt_lat ~ '^-?(\\d+(\\.\\d*)?|\\.\\d+)$'
        AND shape_pt_lon ~ '^-?(\\d+(\\.\\d*)?|\\.\\d+)$'
        AND shape_pt_lat::double precision BETWEEN -90 AND 90
        AND shape_pt_lon::double precision BETWEEN -180 AND 180
        AND shape_pt_sequence IS NOT NULL
      `);

      await tx.execute(sql`
        INSERT INTO stops (
          feed_version_id,
          stop_id,
          stop_code,
          stop_name,
          stop_desc,
          stop_lat,
          stop_lon,
          zone_id,
          stop_url,
          location_type,
          parent_station,
          wheelchair_boarding
        )
        SELECT DISTINCT ON (NULLIF(BTRIM(stop_id), ''))
          ${feedVersionId}::uuid,
          NULLIF(BTRIM(stop_id), ''),
          NULLIF(BTRIM(stop_code), ''),
          NULLIF(BTRIM(stop_name), ''),
          NULLIF(BTRIM(stop_desc), ''),
          stop_lat::double precision,
          stop_lon::double precision,
          NULLIF(BTRIM(zone_id), ''),
          NULLIF(BTRIM(stop_url), ''),
          CASE
            WHEN location_type ~ '^-?\\d+$' THEN location_type::integer
            ELSE NULL
          END,
          NULLIF(BTRIM(parent_station), ''),
          CASE
            WHEN wheelchair_boarding ~ '^-?\\d+$' THEN wheelchair_boarding::integer
            ELSE NULL
          END
        FROM gtfs_static_stage_stops
        WHERE NULLIF(BTRIM(stop_id), '') IS NOT NULL
        AND NULLIF(BTRIM(stop_name), '') IS NOT NULL
        AND stop_lat ~ '^-?(\\d+(\\.\\d*)?|\\.\\d+)$'
        AND stop_lon ~ '^-?(\\d+(\\.\\d*)?|\\.\\d+)$'
        AND stop_lat::double precision BETWEEN -90 AND 90
        AND stop_lon::double precision BETWEEN -180 AND 180
      `);

      await tx.execute(sql`
        INSERT INTO trips (
          feed_version_id,
          trip_id,
          route_id,
          service_id,
          trip_headsign,
          trip_short_name,
          direction_id,
          block_id,
          shape_id,
          wheelchair_accessible,
          bikes_allowed
        )
        SELECT DISTINCT ON (NULLIF(BTRIM(trip_id), ''))
          ${feedVersionId}::uuid,
          NULLIF(BTRIM(trip_id), ''),
          NULLIF(BTRIM(route_id), ''),
          NULLIF(BTRIM(service_id), ''),
          NULLIF(BTRIM(trip_headsign), ''),
          NULLIF(BTRIM(trip_short_name), ''),
          CASE
            WHEN direction_id ~ '^-?\\d+$' THEN direction_id::integer
            ELSE NULL
          END,
          NULLIF(BTRIM(block_id), ''),
          NULLIF(BTRIM(shape_id), ''),
          CASE
            WHEN wheelchair_accessible ~ '^-?\\d+$'
              THEN wheelchair_accessible::integer
            ELSE NULL
          END,
          CASE
            WHEN bikes_allowed ~ '^-?\\d+$' THEN bikes_allowed::integer
            ELSE NULL
          END
        FROM gtfs_static_stage_trips
        WHERE NULLIF(BTRIM(trip_id), '') IS NOT NULL
        AND NULLIF(BTRIM(route_id), '') IS NOT NULL
        AND NULLIF(BTRIM(service_id), '') IS NOT NULL
      `);

      await createAndSwapStopTimesTable(
        txSql,
        feedVersionId,
        previousFeedVersionId,
      );

      await generateDerivedTables(tx, feedVersionId, ROUTE_SERVICE_WINDOW_DAYS);

      const importedCountRows = (await txSql`
        SELECT
          (
            SELECT COUNT(*)::integer FROM calendars
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS calendars,
          (
            SELECT COUNT(*)::integer FROM calendar_dates
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS calendar_dates,
          (
            SELECT COUNT(*)::integer FROM routes
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS routes,
          (
            SELECT COUNT(*)::integer FROM shapes
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS shapes,
          (
            SELECT COUNT(*)::integer FROM stops
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS stops,
          (
            SELECT COUNT(*)::integer FROM trips
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS trips,
          (
            SELECT COUNT(*)::integer FROM stop_times
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS stop_times,
          (
            SELECT COUNT(*)::integer FROM stop_routes
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS stop_routes,
          (
            SELECT COUNT(*)::integer FROM route_stops
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS route_stops,
          (
            SELECT COUNT(*)::integer FROM route_service_days
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS route_service_days,
          (
            SELECT MIN(start_date)::text FROM calendars
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS service_start_date,
          (
            SELECT MAX(end_date)::text FROM calendars
            WHERE feed_version_id = ${feedVersionId}::uuid
          ) AS service_end_date
      `) as unknown as readonly unknown[];
      const importedCounts = parseImportedCounts(importedCountRows[0]);

      if (importedCounts.routes === 0) {
        throw new Error("GTFS import produced no routes");
      }

      if (importedCounts.stops === 0) {
        throw new Error("GTFS import produced no stops");
      }

      if (importedCounts.shapes === 0) {
        throw new Error("GTFS import produced no shapes");
      }

      if (importedCounts.stopRoutes === 0) {
        throw new Error("GTFS import produced no stop_routes rows");
      }

      if (importedCounts.routeStops === 0) {
        throw new Error("GTFS import produced no route_stops rows");
      }

      if (importedCounts.routeServiceDays === 0) {
        throw new Error("GTFS import produced no route_service_days rows");
      }

      await recreateGtfsImportIndexes(txSql);
      await analyzeGtfsImportTables(txSql);
      await cleanupGtfsImportStageTables(txSql);

      await tx
        .update(gtfsFeedVersions)
        .set({
          activatedAt: new Date(),
          errorMessage: null,
          importedAt: new Date(),
          metadata: {
            derivedCounts: {
              routeServiceDays: importedCounts.routeServiceDays,
              routeStops: importedCounts.routeStops,
              stopRoutes: importedCounts.stopRoutes,
            },
            importMode: COMPACT_IMPORT_MODE,
            rawImportedCounts: {
              shapes: importedCounts.shapes,
              stopTimes: importedCounts.stopTimes,
              trips: importedCounts.trips,
            },
            routeServiceWindowDays: ROUTE_SERVICE_WINDOW_DAYS,
          },
          routesCount: importedCounts.routes,
          serviceEndDate: importedCounts.serviceEndDate,
          serviceStartDate: importedCounts.serviceStartDate,
          shapesCount: importedCounts.shapes,
          status: "imported",
          stopTimesCount: importedCounts.stopTimes,
          stopsCount: importedCounts.stops,
          tripsCount: importedCounts.trips,
        })
        .where(eq(gtfsFeedVersions.id, feedVersionId));

      await tx
        .insert(appSettings)
        .values({
          key: ACTIVE_GTFS_FEED_VERSION_SETTING_KEY,
          updatedAt: new Date(),
          value: feedVersionId,
        })
        .onConflictDoUpdate({
          set: {
            updatedAt: new Date(),
            value: feedVersionId,
          },
          target: appSettings.key,
        });

      const cleanup = await cleanupOldGtfsFeedVersions({
        client: txSql,
        feedVersionId,
        previousFeedVersionId,
      });

      return {
        feedVersionId,
        cleanup,
        calendars: {
          importedCount: importedCounts.calendars,
          rowCount: rawCounts.calendars,
          skippedRowCount: rawCounts.calendars - importedCounts.calendars,
        },
        calendarDates: {
          importedCount: importedCounts.calendarDates,
          rowCount: rawCounts.calendarDates,
          skippedRowCount:
            rawCounts.calendarDates - importedCounts.calendarDates,
        },
        routeServiceDays: {
          importedCount: importedCounts.routeServiceDays,
        },
        routeStops: {
          importedCount: importedCounts.routeStops,
        },
        routes: {
          importedCount: importedCounts.routes,
          rowCount: rawCounts.routes,
          skippedRowCount: rawCounts.routes - importedCounts.routes,
        },
        shapes: {
          importedCount: importedCounts.shapes,
          rowCount: rawCounts.shapes,
          skippedRowCount: rawCounts.shapes - importedCounts.shapes,
        },
        stopRoutes: {
          importedCount: importedCounts.stopRoutes,
        },
        stops: {
          importedCount: importedCounts.stops,
          rowCount: rawCounts.stops,
          skippedRowCount: rawCounts.stops - importedCounts.stops,
        },
        trips: {
          importedCount: importedCounts.trips,
          rowCount: rawCounts.trips,
          skippedRowCount: rawCounts.trips - importedCounts.trips,
        },
        stopTimes: {
          importedCount: importedCounts.stopTimes,
          rowCount: rawCounts.stopTimes,
          skippedRowCount: rawCounts.stopTimes - importedCounts.stopTimes,
        },
      };
    });
  } finally {
    await importSql.end();
  }
}
