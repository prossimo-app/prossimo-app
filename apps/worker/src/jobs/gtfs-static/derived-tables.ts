import { sql } from "@prossimo-app/db";

interface DbExecutor {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
}

export async function generateDerivedTables(
  tx: DbExecutor,
  feedVersionId: string,
  serviceWindowDays: number,
) {
  await tx.execute(sql`
    INSERT INTO stop_routes (
      feed_version_id,
      stop_id,
      route_id,
      route_short_name,
      route_type,
      direction_id,
      trip_count
    )
    SELECT
      stop_times.feed_version_id,
      stop_times.stop_id,
      trips.route_id,
      routes.route_short_name,
      routes.route_type,
      COALESCE(trips.direction_id, -1) AS direction_id,
      COUNT(DISTINCT trips.trip_id)::integer AS trip_count
    FROM stop_times
    INNER JOIN trips
      ON trips.feed_version_id = stop_times.feed_version_id
      AND trips.trip_id = stop_times.trip_id
    INNER JOIN routes
      ON routes.feed_version_id = trips.feed_version_id
      AND routes.route_id = trips.route_id
    WHERE stop_times.feed_version_id = ${feedVersionId}
    GROUP BY
      stop_times.feed_version_id,
      stop_times.stop_id,
      trips.route_id,
      routes.route_short_name,
      routes.route_type,
      COALESCE(trips.direction_id, -1)
  `);

  await tx.execute(sql`
    WITH trip_stop_counts AS (
      SELECT
        trips.feed_version_id,
        trips.route_id,
        COALESCE(trips.direction_id, -1) AS direction_id,
        trips.trip_id,
        COUNT(*) AS stop_count
      FROM trips
      INNER JOIN stop_times
        ON stop_times.feed_version_id = trips.feed_version_id
        AND stop_times.trip_id = trips.trip_id
      WHERE trips.feed_version_id = ${feedVersionId}
      GROUP BY
        trips.feed_version_id,
        trips.route_id,
        COALESCE(trips.direction_id, -1),
        trips.trip_id
    ),
    representative_trips AS (
      SELECT
        feed_version_id,
        route_id,
        direction_id,
        trip_id
      FROM (
        SELECT
          trip_stop_counts.*,
          ROW_NUMBER() OVER (
            PARTITION BY feed_version_id, route_id, direction_id
            ORDER BY stop_count DESC, trip_id
          ) AS row_number
        FROM trip_stop_counts
      ) ranked_trips
      WHERE row_number = 1
    ),
    representative_stops AS (
      SELECT DISTINCT ON (
        stop_times.feed_version_id,
        representative_trips.route_id,
        representative_trips.direction_id,
        stop_times.stop_sequence
      )
        stop_times.feed_version_id,
        representative_trips.route_id,
        representative_trips.direction_id,
        stop_times.stop_id,
        stop_times.stop_sequence,
        representative_trips.trip_id AS representative_trip_id
      FROM representative_trips
      INNER JOIN stop_times
        ON stop_times.feed_version_id = representative_trips.feed_version_id
        AND stop_times.trip_id = representative_trips.trip_id
      ORDER BY
        stop_times.feed_version_id,
        representative_trips.route_id,
        representative_trips.direction_id,
        stop_times.stop_sequence,
        stop_times.stop_id
    )
    INSERT INTO route_stops (
      feed_version_id,
      route_id,
      direction_id,
      stop_id,
      stop_sequence,
      representative_trip_id
    )
    SELECT
      feed_version_id,
      route_id,
      direction_id,
      stop_id,
      stop_sequence,
      representative_trip_id
    FROM representative_stops
  `);

  await tx.execute(sql`
    WITH service_window AS (
      SELECT
        (current_timestamp AT TIME ZONE 'Europe/Rome')::date AS start_date,
        (
          (current_timestamp AT TIME ZONE 'Europe/Rome')::date
          + (${serviceWindowDays}::integer - 1)
        ) AS end_date
    ),
    calendar_services AS (
      SELECT
        calendars.feed_version_id,
        calendars.service_id,
        generated_dates.service_date::date AS service_date
      FROM calendars
      CROSS JOIN service_window
      CROSS JOIN LATERAL generate_series(
        GREATEST(calendars.start_date, service_window.start_date),
        LEAST(calendars.end_date, service_window.end_date),
        interval '1 day'
      ) AS generated_dates(service_date)
      WHERE calendars.feed_version_id = ${feedVersionId}
      AND CASE EXTRACT(ISODOW FROM generated_dates.service_date::date)::integer
        WHEN 1 THEN calendars.monday
        WHEN 2 THEN calendars.tuesday
        WHEN 3 THEN calendars.wednesday
        WHEN 4 THEN calendars.thursday
        WHEN 5 THEN calendars.friday
        WHEN 6 THEN calendars.saturday
        WHEN 7 THEN calendars.sunday
        ELSE false
      END
    ),
    added_services AS (
      SELECT
        calendar_dates.feed_version_id,
        calendar_dates.service_id,
        calendar_dates.date AS service_date
      FROM calendar_dates
      CROSS JOIN service_window
      WHERE calendar_dates.feed_version_id = ${feedVersionId}
      AND calendar_dates.exception_type = 1
      AND calendar_dates.date BETWEEN service_window.start_date
        AND service_window.end_date
    ),
    removed_services AS (
      SELECT
        calendar_dates.feed_version_id,
        calendar_dates.service_id,
        calendar_dates.date AS service_date
      FROM calendar_dates
      CROSS JOIN service_window
      WHERE calendar_dates.feed_version_id = ${feedVersionId}
      AND calendar_dates.exception_type = 2
      AND calendar_dates.date BETWEEN service_window.start_date
        AND service_window.end_date
    ),
    active_services AS (
      SELECT * FROM calendar_services
      UNION
      SELECT * FROM added_services
      EXCEPT
      SELECT * FROM removed_services
    )
    INSERT INTO route_service_days (
      feed_version_id,
      service_date,
      route_id,
      route_short_name,
      route_type,
      first_departure_seconds,
      last_arrival_seconds,
      trip_count,
      service_ids
    )
    SELECT
      active_services.feed_version_id,
      active_services.service_date,
      trips.route_id,
      routes.route_short_name,
      routes.route_type,
      MIN(stop_times.departure_seconds) FILTER (
        WHERE stop_times.departure_seconds IS NOT NULL
      ) AS first_departure_seconds,
      MAX(stop_times.arrival_seconds) FILTER (
        WHERE stop_times.arrival_seconds IS NOT NULL
      ) AS last_arrival_seconds,
      COUNT(DISTINCT trips.trip_id)::integer AS trip_count,
      ARRAY_AGG(
        DISTINCT trips.service_id
        ORDER BY trips.service_id
      ) AS service_ids
    FROM active_services
    INNER JOIN trips
      ON trips.feed_version_id = active_services.feed_version_id
      AND trips.service_id = active_services.service_id
    INNER JOIN routes
      ON routes.feed_version_id = trips.feed_version_id
      AND routes.route_id = trips.route_id
    INNER JOIN stop_times
      ON stop_times.feed_version_id = trips.feed_version_id
      AND stop_times.trip_id = trips.trip_id
    GROUP BY
      active_services.feed_version_id,
      active_services.service_date,
      trips.route_id,
      routes.route_short_name,
      routes.route_type
  `);
}
