import { parseGtfsTextEntry } from "@prossimo-app/gtfs";
import type { GtfsRow, GtfsStaticTextEntry } from "@prossimo-app/gtfs";

import {
  REQUIRED_AGENCY_COLUMNS,
  REQUIRED_CALENDAR_COLUMNS,
  REQUIRED_CALENDAR_DATE_COLUMNS,
  REQUIRED_ROUTE_COLUMNS,
  REQUIRED_SHAPE_COLUMNS,
  REQUIRED_STOP_COLUMNS,
  REQUIRED_STOP_TIME_COLUMNS,
  REQUIRED_TRIP_COLUMNS,
  ROUTE_TYPES,
} from "./constants.js";
import type {
  ParsedAgency,
  ParsedCalendar,
  ParsedCalendarDate,
  ParsedRoute,
  ParsedShape,
  ParsedStop,
  ParsedStopTime,
  ParsedTrip,
} from "./types.js";

function getOptionalText(row: GtfsRow, key: string) {
  const value = row[key]?.trim();

  return value && value.length > 0 ? value : null;
}

function getMissingColumns(
  rows: readonly GtfsRow[],
  requiredColumns: readonly string[],
) {
  const columns = new Set(rows.flatMap((row) => Object.keys(row)));

  return requiredColumns.filter((column) => !columns.has(column));
}

function parseGtfsRows(entry: GtfsStaticTextEntry) {
  try {
    return parseGtfsTextEntry(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Failed to parse ${entry.name}: ${message}`);
  }
}

function getOptionalInteger(row: GtfsRow, key: string) {
  const value = row[key]?.trim();

  if (!value) {
    return null;
  }

  return /^-?\d+$/.test(value) ? Number.parseInt(value, 10) : null;
}

function getRequiredCoordinate(row: GtfsRow, key: string) {
  const value = row[key]?.trim();

  if (!value) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getOptionalNumber(row: GtfsRow, key: string) {
  const value = row[key]?.trim();

  if (!value) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function parseGtfsTimeSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const match = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(value);

  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds] = match;

  if (!hours || !minutes || !seconds) {
    return null;
  }

  return (
    Number.parseInt(hours, 10) * 60 * 60 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseInt(seconds, 10)
  );
}

function parseGtfsBoolean(row: GtfsRow, key: string) {
  const value = row[key]?.trim();

  if (value === "0") {
    return false;
  }

  if (value === "1") {
    return true;
  }

  return null;
}

function parseGtfsDate(row: GtfsRow, key: string) {
  const value = row[key]?.trim();

  if (!value || !/^\d{8}$/.test(value)) {
    return null;
  }

  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(4, 6), 10);
  const day = Number.parseInt(value.slice(6, 8), 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function parseAgencyRow(row: GtfsRow) {
  const agencyId = row.agency_id?.trim();
  const agencyName = row.agency_name?.trim();

  if (!agencyId || !agencyName) {
    return null;
  }

  return {
    agencyId,
    agencyLang: getOptionalText(row, "agency_lang"),
    agencyName,
    agencyPhone: getOptionalText(row, "agency_phone"),
    agencyTimezone: getOptionalText(row, "agency_timezone"),
    agencyUrl: getOptionalText(row, "agency_url"),
  } satisfies ParsedAgency;
}

export function parseAgencies(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_AGENCY_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedAgencies = new Map<string, ParsedAgency>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const agency = parseAgencyRow(row);

    if (!agency) {
      skippedRowCount += 1;
      continue;
    }

    parsedAgencies.set(agency.agencyId, agency);
  }

  return {
    agencies: [...parsedAgencies.values()],
    rowCount: rows.length,
    skippedRowCount,
  };
}

function parseCalendarRow(row: GtfsRow) {
  const serviceId = row.service_id?.trim();
  const monday = parseGtfsBoolean(row, "monday");
  const tuesday = parseGtfsBoolean(row, "tuesday");
  const wednesday = parseGtfsBoolean(row, "wednesday");
  const thursday = parseGtfsBoolean(row, "thursday");
  const friday = parseGtfsBoolean(row, "friday");
  const saturday = parseGtfsBoolean(row, "saturday");
  const sunday = parseGtfsBoolean(row, "sunday");
  const startDate = parseGtfsDate(row, "start_date");
  const endDate = parseGtfsDate(row, "end_date");

  if (
    !serviceId ||
    monday === null ||
    tuesday === null ||
    wednesday === null ||
    thursday === null ||
    friday === null ||
    saturday === null ||
    sunday === null ||
    !startDate ||
    !endDate
  ) {
    return null;
  }

  return {
    endDate,
    friday,
    monday,
    saturday,
    serviceId,
    startDate,
    sunday,
    thursday,
    tuesday,
    wednesday,
  } satisfies ParsedCalendar;
}

export function parseCalendars(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_CALENDAR_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedCalendars = new Map<string, ParsedCalendar>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const calendar = parseCalendarRow(row);

    if (!calendar) {
      skippedRowCount += 1;
      continue;
    }

    parsedCalendars.set(calendar.serviceId, calendar);
  }

  return {
    calendars: [...parsedCalendars.values()],
    rowCount: rows.length,
    skippedRowCount,
  };
}

function parseCalendarDateRow(row: GtfsRow) {
  const serviceId = row.service_id?.trim();
  const date = parseGtfsDate(row, "date");
  const exceptionType = getOptionalInteger(row, "exception_type");

  if (
    !serviceId ||
    !date ||
    (exceptionType !== 1 && exceptionType !== 2)
  ) {
    return null;
  }

  return {
    date,
    exceptionType,
    serviceId,
  } satisfies ParsedCalendarDate;
}

export function parseCalendarDates(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_CALENDAR_DATE_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedCalendarDates = new Map<string, ParsedCalendarDate>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const calendarDate = parseCalendarDateRow(row);

    if (!calendarDate) {
      skippedRowCount += 1;
      continue;
    }

    parsedCalendarDates.set(
      `${calendarDate.serviceId}\u0000${calendarDate.date}`,
      calendarDate,
    );
  }

  return {
    calendarDates: [...parsedCalendarDates.values()],
    rowCount: rows.length,
    skippedRowCount,
  };
}

function parseRouteRow(row: GtfsRow) {
  const routeId = row.route_id?.trim();
  const rawRouteType = row.route_type?.trim() ?? "";
  const routeType = /^\d+$/.test(rawRouteType)
    ? Number.parseInt(rawRouteType, 10)
    : Number.NaN;

  if (!routeId || !ROUTE_TYPES.has(routeType)) {
    return null;
  }

  return {
    agencyId: getOptionalText(row, "agency_id"),
    routeColor: getOptionalText(row, "route_color"),
    routeDesc: getOptionalText(row, "route_desc"),
    routeId,
    routeLongName: getOptionalText(row, "route_long_name"),
    routeShortName: getOptionalText(row, "route_short_name"),
    routeTextColor: getOptionalText(row, "route_text_color"),
    routeType,
    routeUrl: getOptionalText(row, "route_url"),
  } satisfies ParsedRoute;
}

function parseShapeRow(row: GtfsRow) {
  const shapeId = row.shape_id?.trim();
  const shapePtLat = getRequiredCoordinate(row, "shape_pt_lat");
  const shapePtLon = getRequiredCoordinate(row, "shape_pt_lon");
  const shapePtSequence = getOptionalInteger(row, "shape_pt_sequence");

  if (
    !shapeId ||
    shapePtLat === null ||
    shapePtLat < -90 ||
    shapePtLat > 90 ||
    shapePtLon === null ||
    shapePtLon < -180 ||
    shapePtLon > 180 ||
    shapePtSequence === null
  ) {
    return null;
  }

  return {
    shapeDistTraveled: getOptionalNumber(row, "shape_dist_traveled"),
    shapeId,
    shapePtLat,
    shapePtLon,
    shapePtSequence,
  } satisfies ParsedShape;
}

export function parseShapes(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_SHAPE_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedShapes = new Map<string, ParsedShape>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const shape = parseShapeRow(row);

    if (!shape) {
      skippedRowCount += 1;
      continue;
    }

    parsedShapes.set(`${shape.shapeId}\u0000${shape.shapePtSequence}`, shape);
  }

  return {
    rowCount: rows.length,
    shapes: [...parsedShapes.values()],
    skippedRowCount,
  };
}

export function parseRoutes(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_ROUTE_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedRoutes = new Map<string, ParsedRoute>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const route = parseRouteRow(row);

    if (!route) {
      skippedRowCount += 1;
      continue;
    }

    parsedRoutes.set(route.routeId, route);
  }

  return {
    routes: [...parsedRoutes.values()],
    rowCount: rows.length,
    skippedRowCount,
  };
}

function parseStopRow(row: GtfsRow) {
  const stopId = row.stop_id?.trim();
  const stopName = row.stop_name?.trim();
  const stopLat = getRequiredCoordinate(row, "stop_lat");
  const stopLon = getRequiredCoordinate(row, "stop_lon");

  if (
    !stopId ||
    !stopName ||
    stopLat === null ||
    stopLat < -90 ||
    stopLat > 90 ||
    stopLon === null ||
    stopLon < -180 ||
    stopLon > 180
  ) {
    return null;
  }

  return {
    locationType: getOptionalInteger(row, "location_type"),
    parentStation: getOptionalText(row, "parent_station"),
    stopCode: getOptionalText(row, "stop_code"),
    stopDesc: getOptionalText(row, "stop_desc"),
    stopId,
    stopLat,
    stopLon,
    stopName,
    stopUrl: getOptionalText(row, "stop_url"),
    wheelchairBoarding: getOptionalInteger(row, "wheelchair_boarding"),
    zoneId: getOptionalText(row, "zone_id"),
  } satisfies ParsedStop;
}

export function parseStops(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_STOP_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedStops = new Map<string, ParsedStop>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const stop = parseStopRow(row);

    if (!stop) {
      skippedRowCount += 1;
      continue;
    }

    parsedStops.set(stop.stopId, stop);
  }

  return {
    rowCount: rows.length,
    skippedRowCount,
    stops: [...parsedStops.values()],
  };
}

function parseStopTimeRow(row: GtfsRow) {
  const tripId = row.trip_id?.trim();
  const stopId = row.stop_id?.trim();
  const stopSequence = getOptionalInteger(row, "stop_sequence");

  if (!tripId || !stopId || stopSequence === null) {
    return null;
  }

  const arrivalTime = getOptionalText(row, "arrival_time");
  const departureTime = getOptionalText(row, "departure_time");

  return {
    arrivalSeconds: parseGtfsTimeSeconds(arrivalTime),
    arrivalTime,
    departureSeconds: parseGtfsTimeSeconds(departureTime),
    departureTime,
    dropOffType: getOptionalInteger(row, "drop_off_type"),
    pickupType: getOptionalInteger(row, "pickup_type"),
    shapeDistTraveled: getOptionalNumber(row, "shape_dist_traveled"),
    stopHeadsign: getOptionalText(row, "stop_headsign"),
    stopId,
    stopSequence,
    timepoint: getOptionalInteger(row, "timepoint"),
    tripId,
  } satisfies ParsedStopTime;
}

export function parseStopTimes(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_STOP_TIME_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedStopTimes = new Map<string, ParsedStopTime>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const stopTime = parseStopTimeRow(row);

    if (!stopTime) {
      skippedRowCount += 1;
      continue;
    }

    parsedStopTimes.set(
      `${stopTime.tripId}\u0000${stopTime.stopSequence}`,
      stopTime,
    );
  }

  return {
    rowCount: rows.length,
    skippedRowCount,
    stopTimes: [...parsedStopTimes.values()],
  };
}

function parseTripRow(row: GtfsRow) {
  const tripId = row.trip_id?.trim();
  const routeId = row.route_id?.trim();
  const serviceId = row.service_id?.trim();

  if (!tripId || !routeId || !serviceId) {
    return null;
  }

  return {
    bikesAllowed: getOptionalInteger(row, "bikes_allowed"),
    blockId: getOptionalText(row, "block_id"),
    directionId: getOptionalInteger(row, "direction_id"),
    routeId,
    serviceId,
    shapeId: getOptionalText(row, "shape_id"),
    tripHeadsign: getOptionalText(row, "trip_headsign"),
    tripId,
    tripShortName: getOptionalText(row, "trip_short_name"),
    wheelchairAccessible: getOptionalInteger(row, "wheelchair_accessible"),
  } satisfies ParsedTrip;
}

export function parseTrips(entry: GtfsStaticTextEntry) {
  const rows = parseGtfsRows(entry);
  const missingColumns = getMissingColumns(rows, REQUIRED_TRIP_COLUMNS);

  if (missingColumns.length > 0) {
    throw new Error(
      `${entry.name} is missing required column(s): ${missingColumns.join(", ")}`,
    );
  }

  const parsedTrips = new Map<string, ParsedTrip>();
  let skippedRowCount = 0;

  for (const row of rows) {
    const trip = parseTripRow(row);

    if (!trip) {
      skippedRowCount += 1;
      continue;
    }

    parsedTrips.set(trip.tripId, trip);
  }

  return {
    rowCount: rows.length,
    skippedRowCount,
    trips: [...parsedTrips.values()],
  };
}
