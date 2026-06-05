import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getQueryRows, sql } from "@prossimo-app/db";

import type { Context } from "../context.js";
import { rateLimitedProcedure, router } from "../trpc.js";
import { getItalianTimeSnapshot } from "../utils/italian-time.js";

const getStopsInput = z.object({
  feedVersionId: z.string().uuid(),
});
const getRouteShapesInput = z.object({
  feedVersionId: z.string().uuid(),
  routeId: z.string().min(1),
});
const getRoutesInput = z.object({
  cursor: z.number().int().min(0).default(0),
  feedVersionId: z.string().uuid(),
  limit: z.number().int().min(1).max(30).default(30),
  query: z.string().trim().default(""),
  type: z
    .enum(["bus", "metro", "rail", "tram", "unknown"])
    .optional()
    .nullable(),
});
const getPlannedUpcomingTripsInput = z.object({
  stopId: z.string().min(1),
});

type RouteType = "tram" | "bus" | "metro" | "rail" | "unknown";

export interface NearbyRoute {
  routeId: string;
  shortName: string;
  type: RouteType;
  color: string | null;
}

interface StopRow {
  feedVersionId: string;
  stopId: string;
  stopCode: string | null;
  stopDesc: string | null;
  stopName: string;
  lat: number;
  lon: number;
  routes: NearbyRoute[] | null;
}

interface PlannedUpcomingTripRow {
  arrivalSeconds: number;
  color: string | null;
  departureSeconds: number | null;
  directionId: number;
  feedVersionId: string;
  routeId: string;
  routeShortName: string;
  routeType: RouteType;
  serviceDate: string;
  stopCode: string | null;
  stopDesc: string | null;
  stopId: string;
  stopName: string;
  tripHeadsign: string | null;
  tripId: string;
  tripCount: number;
}

interface RouteShapeRow {
  shapeId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  }[];
}

interface RouteRow {
  color: string | null;
  longName: string | null;
  routeId: string;
  shortName: string;
  textColor: string | null;
  type: RouteType;
}

export interface NearbyArrivalPreview {
  routeId: string;
  routeShortName: string;
  destination: string | null;
  arrivalInSeconds: number | null;
  source: "realtime" | "scheduled";
  freshness: "live" | "stale" | "scheduled" | "unknown";
}

export interface TransitStop {
  feedVersionId: string;
  stopId: string;
  stopCode: string | null;
  stopDesc: string | null;
  stopName: string;
  lat: number;
  lon: number;
  routes: NearbyRoute[];
  nextArrivalsPreview: NearbyArrivalPreview[];
}

export interface TransitRouteShape {
  shapeId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  }[];
}

export interface TransitRoute {
  color: string | null;
  longName: string | null;
  routeId: string;
  shortName: string;
  textColor: string | null;
  type: RouteType;
}

export interface PlannedUpcomingTrip {
  arrivalInSeconds: number;
  arrivalSeconds: number;
  color: string | null;
  departureSeconds: number | null;
  directionId: number;
  routeId: string;
  routeShortName: string;
  routeType: RouteType;
  serviceDate: string;
  tripHeadsign: string | null;
  tripId: string;
  tripCount: number;
}

function getDb(ctx: Pick<Context, "db">) {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "DATABASE_URL is required for transit queries",
    });
  }

  return ctx.db;
}

function normalizeRoutes(routes: NearbyRoute[] | null): NearbyRoute[] {
  return (routes ?? []).map((route) => ({
    routeId: route.routeId,
    shortName: route.shortName,
    type: route.type,
    color: route.color,
  }));
}

export const transitRouter = router({
  getRoutes: rateLimitedProcedure("routes")
    .input(getRoutesInput)
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const normalizedQuery = input.query.toLowerCase();
      const result = await db.execute(sql<RouteRow>`
        WITH configured_feed AS (
          SELECT value::uuid AS feed_version_id
          FROM app_settings
          WHERE key = 'active_gtfs_feed_version_id'
            AND value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ORDER BY updated_at DESC
          LIMIT 1
        ),
        active_feed AS (
          SELECT gtfs_feed_versions.id
          FROM gtfs_feed_versions
          WHERE gtfs_feed_versions.id = ${input.feedVersionId}::uuid
            AND (
              gtfs_feed_versions.id = (
                SELECT feed_version_id FROM configured_feed LIMIT 1
              )
              OR (
                NOT EXISTS (SELECT 1 FROM configured_feed)
                AND gtfs_feed_versions.activated_at IS NOT NULL
              )
            )
            AND gtfs_feed_versions.status = 'imported'
        ),
        route_rows AS (
          SELECT
            routes.route_id AS "routeId",
            COALESCE(routes.route_short_name, routes.route_id) AS "shortName",
            routes.route_long_name AS "longName",
            CASE routes.route_type
              WHEN 0 THEN 'tram'
              WHEN 1 THEN 'metro'
              WHEN 2 THEN 'rail'
              WHEN 3 THEN 'bus'
              ELSE 'unknown'
            END AS "type",
            routes.route_color AS "color",
            routes.route_text_color AS "textColor"
          FROM routes
          INNER JOIN active_feed
            ON active_feed.id = routes.feed_version_id
          WHERE
            ${normalizedQuery} = ''
            OR lower(COALESCE(routes.route_short_name, '')) LIKE ${`%${normalizedQuery}%`}
            OR lower(COALESCE(routes.route_long_name, '')) LIKE ${`%${normalizedQuery}%`}
            OR lower(routes.route_id) LIKE ${`%${normalizedQuery}%`}
        )
        SELECT *
        FROM route_rows
        WHERE ${input.type ?? null}::text IS NULL
          OR "type" = ${input.type ?? null}
        ORDER BY lower("shortName"), "shortName", "routeId"
        LIMIT ${input.limit + 1}
        OFFSET ${input.cursor}
      `);
      const rows = getQueryRows<RouteRow>(result);
      const routes = rows.slice(0, input.limit).map<TransitRoute>((row) => ({
        color: row.color,
        longName: row.longName,
        routeId: row.routeId,
        shortName: row.shortName,
        textColor: row.textColor,
        type: row.type,
      }));
      const nextCursor =
        rows.length > input.limit ? input.cursor + input.limit : null;

      return {
        feedVersionId: input.feedVersionId,
        nextCursor,
        routes,
      };
    }),
  getRouteShapes: rateLimitedProcedure("routeShapes")
    .input(getRouteShapesInput)
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const result = await db.execute(sql<RouteShapeRow>`
        WITH configured_feed AS (
          SELECT value::uuid AS feed_version_id
          FROM app_settings
          WHERE key = 'active_gtfs_feed_version_id'
            AND value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ORDER BY updated_at DESC
          LIMIT 1
        ),
        active_feed AS (
          SELECT gtfs_feed_versions.id
          FROM gtfs_feed_versions
          WHERE gtfs_feed_versions.id = ${input.feedVersionId}::uuid
            AND (
              gtfs_feed_versions.id = (
                SELECT feed_version_id FROM configured_feed LIMIT 1
              )
              OR (
                NOT EXISTS (SELECT 1 FROM configured_feed)
                AND gtfs_feed_versions.activated_at IS NOT NULL
              )
            )
            AND gtfs_feed_versions.status = 'imported'
        ),
        route_shape_ids AS (
          SELECT DISTINCT trips.shape_id
          FROM trips
          INNER JOIN active_feed
            ON active_feed.id = trips.feed_version_id
          WHERE trips.route_id = ${input.routeId}
            AND trips.shape_id IS NOT NULL
        )
        SELECT
          shapes.shape_id AS "shapeId",
          jsonb_agg(
            jsonb_build_object(
              'latitude', shapes.shape_pt_lat,
              'longitude', shapes.shape_pt_lon
            )
            ORDER BY shapes.shape_pt_sequence
          ) AS "coordinates"
        FROM shapes
        INNER JOIN active_feed
          ON active_feed.id = shapes.feed_version_id
        INNER JOIN route_shape_ids
          ON route_shape_ids.shape_id = shapes.shape_id
        GROUP BY shapes.shape_id
        HAVING COUNT(*) > 1
        ORDER BY shapes.shape_id
      `);
      const rows = getQueryRows<RouteShapeRow>(result);

      return {
        feedVersionId: input.feedVersionId,
        routeId: input.routeId,
        shapes: rows.map<TransitRouteShape>((row) => ({
          shapeId: row.shapeId,
          coordinates: row.coordinates,
        })),
      };
    }),
  getPlannedUpcomingTrips: rateLimitedProcedure("plannedUpcomingTrips")
    .input(getPlannedUpcomingTripsInput)
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const italianTime = getItalianTimeSnapshot();
      const result = await db.execute(sql<PlannedUpcomingTripRow>`
        WITH configured_feed AS (
          SELECT value::uuid AS feed_version_id
          FROM app_settings
          WHERE key = 'active_gtfs_feed_version_id'
            AND value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ORDER BY updated_at DESC
          LIMIT 1
        ),
        active_feed AS (
          SELECT gtfs_feed_versions.id
          FROM gtfs_feed_versions
          WHERE gtfs_feed_versions.id = (
            SELECT feed_version_id FROM configured_feed LIMIT 1
          )
            AND gtfs_feed_versions.status = 'imported'
          UNION ALL
          SELECT gtfs_feed_versions.id
          FROM gtfs_feed_versions
          WHERE NOT EXISTS (SELECT 1 FROM configured_feed)
            AND gtfs_feed_versions.status = 'imported'
            AND gtfs_feed_versions.activated_at IS NOT NULL
          ORDER BY id
          LIMIT 1
        ),
        selected_stop AS (
          SELECT
            stops.feed_version_id,
            stops.stop_id,
            stops.stop_code,
            stops.stop_desc,
            stops.stop_name
          FROM stops
          INNER JOIN active_feed
            ON active_feed.id = stops.feed_version_id
          WHERE stops.stop_id = ${input.stopId}
          LIMIT 1
        ),
        active_services AS (
          SELECT calendars.service_id
          FROM calendars
          WHERE calendars.feed_version_id = (SELECT feed_version_id FROM selected_stop)
            AND calendars.start_date <= ${italianTime.date}::date
            AND calendars.end_date >= ${italianTime.date}::date
            AND CASE EXTRACT(ISODOW FROM ${italianTime.date}::date)::integer
              WHEN 1 THEN calendars.monday
              WHEN 2 THEN calendars.tuesday
              WHEN 3 THEN calendars.wednesday
              WHEN 4 THEN calendars.thursday
              WHEN 5 THEN calendars.friday
              WHEN 6 THEN calendars.saturday
              WHEN 7 THEN calendars.sunday
              ELSE false
            END
          EXCEPT
          SELECT calendar_dates.service_id
          FROM calendar_dates
          WHERE calendar_dates.feed_version_id = (SELECT feed_version_id FROM selected_stop)
            AND calendar_dates.date = ${italianTime.date}::date
            AND calendar_dates.exception_type = 2
          UNION
          SELECT calendar_dates.service_id
          FROM calendar_dates
          WHERE calendar_dates.feed_version_id = (SELECT feed_version_id FROM selected_stop)
            AND calendar_dates.date = ${italianTime.date}::date
            AND calendar_dates.exception_type = 1
        ),
        upcoming_stop_times AS (
          SELECT
            stop_times.feed_version_id,
            stop_times.stop_id,
            trips.route_id,
            COALESCE(trips.direction_id, 0) AS direction_id,
            stop_times.trip_id,
            trips.trip_headsign,
            stop_times.arrival_seconds,
            stop_times.departure_seconds
          FROM stop_times
          INNER JOIN selected_stop
            ON selected_stop.feed_version_id = stop_times.feed_version_id
            AND selected_stop.stop_id = stop_times.stop_id
          INNER JOIN trips
            ON trips.feed_version_id = stop_times.feed_version_id
            AND trips.trip_id = stop_times.trip_id
          INNER JOIN active_services
            ON active_services.service_id = trips.service_id
          WHERE COALESCE(
              stop_times.arrival_seconds,
              stop_times.departure_seconds
            ) IS NOT NULL
            AND COALESCE(
              stop_times.arrival_seconds,
              stop_times.departure_seconds
            ) >= ${italianTime.daySeconds}
          ORDER BY
            COALESCE(
              stop_times.arrival_seconds,
              stop_times.departure_seconds
            ),
            trips.route_id,
            stop_times.trip_id
          LIMIT 60
        )
        SELECT
          selected_stop.feed_version_id AS "feedVersionId",
          selected_stop.stop_id AS "stopId",
          selected_stop.stop_code AS "stopCode",
          selected_stop.stop_desc AS "stopDesc",
          selected_stop.stop_name AS "stopName",
          upcoming_stop_times.route_id AS "routeId",
          COALESCE(
            routes.route_short_name,
            stop_routes.route_short_name,
            upcoming_stop_times.route_id
          ) AS "routeShortName",
          CASE COALESCE(routes.route_type, stop_routes.route_type)
            WHEN 0 THEN 'tram'
            WHEN 1 THEN 'metro'
            WHEN 2 THEN 'rail'
            WHEN 3 THEN 'bus'
            ELSE 'unknown'
          END AS "routeType",
          routes.route_color AS "color",
          upcoming_stop_times.direction_id AS "directionId",
          upcoming_stop_times.trip_id AS "tripId",
          ${italianTime.date}::date AS "serviceDate",
          upcoming_stop_times.trip_headsign AS "tripHeadsign",
          COALESCE(
            upcoming_stop_times.arrival_seconds,
            upcoming_stop_times.departure_seconds
          ) AS "arrivalSeconds",
          upcoming_stop_times.departure_seconds AS "departureSeconds",
          COALESCE(stop_routes.trip_count, 0) AS "tripCount"
        FROM selected_stop
        INNER JOIN upcoming_stop_times
          ON upcoming_stop_times.feed_version_id = selected_stop.feed_version_id
          AND upcoming_stop_times.stop_id = selected_stop.stop_id
        LEFT JOIN stop_routes
          ON stop_routes.feed_version_id = upcoming_stop_times.feed_version_id
          AND stop_routes.stop_id = upcoming_stop_times.stop_id
          AND stop_routes.route_id = upcoming_stop_times.route_id
          AND stop_routes.direction_id = upcoming_stop_times.direction_id
        LEFT JOIN routes
          ON routes.feed_version_id = upcoming_stop_times.feed_version_id
          AND routes.route_id = upcoming_stop_times.route_id
        ORDER BY
          "arrivalSeconds",
          "routeShortName",
          upcoming_stop_times.route_id,
          upcoming_stop_times.trip_id
      `);
      const rows = getQueryRows<PlannedUpcomingTripRow>(result);
      const firstRow = rows[0];

      return {
        plannedUpcomingTrips: rows.map<PlannedUpcomingTrip>((row) => ({
          arrivalInSeconds: row.arrivalSeconds - italianTime.daySeconds,
          arrivalSeconds: row.arrivalSeconds,
          color: row.color,
          departureSeconds: row.departureSeconds,
          directionId: row.directionId,
          routeId: row.routeId,
          routeShortName: row.routeShortName,
          routeType: row.routeType,
          serviceDate: row.serviceDate,
          tripHeadsign: row.tripHeadsign,
          tripId: row.tripId,
          tripCount: row.tripCount,
        })),
        serverTime: italianTime,
        stop: firstRow
          ? {
              feedVersionId: firstRow.feedVersionId,
              stopCode: firstRow.stopCode,
              stopDesc: firstRow.stopDesc,
              stopId: firstRow.stopId,
              stopName: firstRow.stopName,
            }
          : null,
      };
    }),
  getStops: rateLimitedProcedure("stops")
    .input(getStopsInput)
    .query(async ({ ctx, input }) => {
      const db = getDb(ctx);
      const result = await db.execute(sql<StopRow>`
        WITH configured_feed AS (
          SELECT value::uuid AS feed_version_id
          FROM app_settings
          WHERE key = 'active_gtfs_feed_version_id'
            AND value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ORDER BY updated_at DESC
          LIMIT 1
        ),
        active_feed AS (
          SELECT gtfs_feed_versions.id
          FROM gtfs_feed_versions
          WHERE gtfs_feed_versions.id = ${input.feedVersionId}::uuid
            AND (
              gtfs_feed_versions.id = (
                SELECT feed_version_id FROM configured_feed LIMIT 1
              )
              OR (
                NOT EXISTS (SELECT 1 FROM configured_feed)
                AND gtfs_feed_versions.activated_at IS NOT NULL
              )
            )
            AND gtfs_feed_versions.status = 'imported'
        ),
        active_stops AS (
          SELECT
            stops.feed_version_id,
            stops.stop_id,
            stops.stop_code,
            stops.stop_desc,
            stops.stop_name,
            stops.stop_lat,
            stops.stop_lon
          FROM stops
          INNER JOIN active_feed
            ON active_feed.id = stops.feed_version_id
          ORDER BY stops.stop_name, stops.stop_id
        ),
        route_rows AS (
          SELECT DISTINCT ON (
            stop_routes.feed_version_id,
            stop_routes.stop_id,
            stop_routes.route_id
          )
            stop_routes.feed_version_id,
            stop_routes.stop_id,
            stop_routes.route_id,
            COALESCE(
              routes.route_short_name,
              stop_routes.route_short_name,
              stop_routes.route_id
            ) AS short_name,
            CASE COALESCE(routes.route_type, stop_routes.route_type)
              WHEN 0 THEN 'tram'
              WHEN 1 THEN 'metro'
              WHEN 2 THEN 'rail'
              WHEN 3 THEN 'bus'
              ELSE 'unknown'
            END AS route_type,
            routes.route_color
          FROM stop_routes
          INNER JOIN active_stops
            ON active_stops.feed_version_id = stop_routes.feed_version_id
            AND active_stops.stop_id = stop_routes.stop_id
          LEFT JOIN routes
            ON routes.feed_version_id = stop_routes.feed_version_id
            AND routes.route_id = stop_routes.route_id
          ORDER BY
            stop_routes.feed_version_id,
            stop_routes.stop_id,
            stop_routes.route_id,
            stop_routes.trip_count DESC
        ),
        routes_by_stop AS (
          SELECT
            route_rows.feed_version_id,
            route_rows.stop_id,
            jsonb_agg(
              jsonb_build_object(
                'routeId', route_rows.route_id,
                'shortName', route_rows.short_name,
                'type', route_rows.route_type,
                'color', route_rows.route_color
              )
              ORDER BY route_rows.short_name, route_rows.route_id
            ) AS routes
          FROM route_rows
          GROUP BY route_rows.feed_version_id, route_rows.stop_id
        )
        SELECT
          active_stops.feed_version_id AS "feedVersionId",
          active_stops.stop_id AS "stopId",
          active_stops.stop_code AS "stopCode",
          active_stops.stop_desc AS "stopDesc",
          active_stops.stop_name AS "stopName",
          active_stops.stop_lat AS "lat",
          active_stops.stop_lon AS "lon",
          COALESCE(routes_by_stop.routes, '[]'::jsonb) AS "routes"
        FROM active_stops
        LEFT JOIN routes_by_stop
          ON routes_by_stop.feed_version_id = active_stops.feed_version_id
          AND routes_by_stop.stop_id = active_stops.stop_id
        ORDER BY active_stops.stop_name, active_stops.stop_id
      `);

      const rows = getQueryRows<StopRow>(result);

      return {
        feedVersionId: input.feedVersionId,
        stops: rows.map<TransitStop>((row) => ({
          feedVersionId: row.feedVersionId,
          stopId: row.stopId,
          stopCode: row.stopCode,
          stopDesc: row.stopDesc,
          stopName: row.stopName,
          lat: row.lat,
          lon: row.lon,
          routes: normalizeRoutes(row.routes),
          nextArrivalsPreview: [],
        })),
      };
    }),
});
