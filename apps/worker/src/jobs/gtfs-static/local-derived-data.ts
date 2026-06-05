import type {
  ParsedCalendar,
  ParsedCalendarDate,
  ParsedRoute,
  ParsedStopTime,
  ParsedTrip,
} from "./types.js";

export interface DerivedStopRoute {
  directionId: number;
  routeId: string;
  routeShortName: string | null;
  routeType: number;
  stopId: string;
  tripCount: number;
}

export interface DerivedRouteStop {
  directionId: number;
  representativeTripId: string;
  routeId: string;
  stopId: string;
  stopSequence: number;
}

export interface DerivedRouteServiceDay {
  firstDepartureSeconds: number | null;
  lastArrivalSeconds: number | null;
  routeId: string;
  routeShortName: string | null;
  routeType: number;
  serviceDate: string;
  serviceIds: string[];
  tripCount: number;
}

export interface DerivedGtfsStaticData {
  routeServiceDays: DerivedRouteServiceDay[];
  routeStops: DerivedRouteStop[];
  stopRoutes: DerivedStopRoute[];
}

interface TripStopSummary {
  firstDepartureSeconds: number | null;
  lastArrivalSeconds: number | null;
  stopCount: number;
}

interface RouteServiceDayAccumulator {
  firstDepartureSeconds: number | null;
  lastArrivalSeconds: number | null;
  route: ParsedRoute;
  serviceIds: Set<string>;
  tripIds: Set<string>;
}

const DEFAULT_SERVICE_WINDOW_DAYS = 90;
const SERVICE_TIME_ZONE = "Europe/Rome";

function getDirectionId(trip: ParsedTrip) {
  return trip.directionId ?? -1;
}

function addSecondsMinimum(current: number | null, value: number | null) {
  if (value === null) {
    return current;
  }

  return current === null ? value : Math.min(current, value);
}

function addSecondsMaximum(current: number | null, value: number | null) {
  if (value === null) {
    return current;
  }

  return current === null ? value : Math.max(current, value);
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));

  if (!year || !month || !day) {
    throw new Error(`Invalid GTFS service date: ${dateKey}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function getTodayDateKey() {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: SERVICE_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date());
  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;
  const day = dateParts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to resolve today in ${SERVICE_TIME_ZONE}`);
  }

  return `${year}-${month}-${day}`;
}

function getCalendarWeekdayEnabled(calendar: ParsedCalendar, isoDay: number) {
  switch (isoDay) {
    case 1:
      return calendar.monday;
    case 2:
      return calendar.tuesday;
    case 3:
      return calendar.wednesday;
    case 4:
      return calendar.thursday;
    case 5:
      return calendar.friday;
    case 6:
      return calendar.saturday;
    case 7:
      return calendar.sunday;
    default:
      return false;
  }
}

function getIsoDay(date: Date) {
  const utcDay = date.getUTCDay();

  return utcDay === 0 ? 7 : utcDay;
}

function buildActiveServicesByDate({
  calendarDates,
  calendars,
  serviceWindowDays,
}: {
  calendarDates: readonly ParsedCalendarDate[];
  calendars: readonly ParsedCalendar[];
  serviceWindowDays: number;
}) {
  const todayKey = getTodayDateKey();
  const today = parseDateKey(todayKey);
  const endDate = addDays(today, serviceWindowDays - 1);
  const endDateKey = formatDateKey(endDate);
  const activeServicesByDate = new Map<string, Set<string>>();

  for (const calendar of calendars) {
    const startDate = parseDateKey(
      calendar.startDate > todayKey ? calendar.startDate : todayKey,
    );
    const calendarEndKey =
      calendar.endDate < endDateKey ? calendar.endDate : endDateKey;
    const calendarEndDate = parseDateKey(calendarEndKey);

    for (
      let serviceDate = startDate;
      serviceDate <= calendarEndDate;
      serviceDate = addDays(serviceDate, 1)
    ) {
      if (!getCalendarWeekdayEnabled(calendar, getIsoDay(serviceDate))) {
        continue;
      }

      const serviceDateKey = formatDateKey(serviceDate);
      const activeServices =
        activeServicesByDate.get(serviceDateKey) ?? new Set<string>();

      activeServices.add(calendar.serviceId);
      activeServicesByDate.set(serviceDateKey, activeServices);
    }
  }

  for (const calendarDate of calendarDates) {
    if (calendarDate.date < todayKey || calendarDate.date > endDateKey) {
      continue;
    }

    const activeServices =
      activeServicesByDate.get(calendarDate.date) ?? new Set<string>();

    if (calendarDate.exceptionType === 1) {
      activeServices.add(calendarDate.serviceId);
    } else if (calendarDate.exceptionType === 2) {
      activeServices.delete(calendarDate.serviceId);
    }

    if (activeServices.size > 0) {
      activeServicesByDate.set(calendarDate.date, activeServices);
    } else {
      activeServicesByDate.delete(calendarDate.date);
    }
  }

  return activeServicesByDate;
}

function buildTripStopIndexes(stopTimes: readonly ParsedStopTime[]) {
  const stopTimesByTripId = new Map<string, ParsedStopTime[]>();
  const tripStopSummaries = new Map<string, TripStopSummary>();

  for (const stopTime of stopTimes) {
    const tripStopTimes = stopTimesByTripId.get(stopTime.tripId) ?? [];

    tripStopTimes.push(stopTime);
    stopTimesByTripId.set(stopTime.tripId, tripStopTimes);

    const summary = tripStopSummaries.get(stopTime.tripId) ?? {
      firstDepartureSeconds: null,
      lastArrivalSeconds: null,
      stopCount: 0,
    };

    summary.firstDepartureSeconds = addSecondsMinimum(
      summary.firstDepartureSeconds,
      stopTime.departureSeconds,
    );
    summary.lastArrivalSeconds = addSecondsMaximum(
      summary.lastArrivalSeconds,
      stopTime.arrivalSeconds,
    );
    summary.stopCount += 1;
    tripStopSummaries.set(stopTime.tripId, summary);
  }

  for (const tripStopTimes of stopTimesByTripId.values()) {
    tripStopTimes.sort((left, right) => {
      const sequenceDelta = left.stopSequence - right.stopSequence;

      return sequenceDelta === 0
        ? left.stopId.localeCompare(right.stopId)
        : sequenceDelta;
    });
  }

  return {
    stopTimesByTripId,
    tripStopSummaries,
  };
}

function buildStopRoutes({
  routesById,
  stopTimes,
  tripsById,
}: {
  routesById: ReadonlyMap<string, ParsedRoute>;
  stopTimes: readonly ParsedStopTime[];
  tripsById: ReadonlyMap<string, ParsedTrip>;
}) {
  const tripIdsByStopRoute = new Map<string, Set<string>>();

  for (const stopTime of stopTimes) {
    const trip = tripsById.get(stopTime.tripId);

    if (!trip || !routesById.has(trip.routeId)) {
      continue;
    }

    const directionId = getDirectionId(trip);
    const key = `${stopTime.stopId}\u0000${trip.routeId}\u0000${directionId}`;
    const tripIds = tripIdsByStopRoute.get(key) ?? new Set<string>();

    tripIds.add(trip.tripId);
    tripIdsByStopRoute.set(key, tripIds);
  }

  return [...tripIdsByStopRoute.entries()]
    .map(([key, tripIds]) => {
      const [stopId, routeId, rawDirectionId] = key.split("\u0000");
      const route = routeId ? routesById.get(routeId) : undefined;

      if (!stopId || !routeId || !rawDirectionId || !route) {
        return null;
      }

      return {
        directionId: Number.parseInt(rawDirectionId, 10),
        routeId,
        routeShortName: route.routeShortName,
        routeType: route.routeType,
        stopId,
        tripCount: tripIds.size,
      } satisfies DerivedStopRoute;
    })
    .filter((stopRoute): stopRoute is DerivedStopRoute => stopRoute !== null)
    .sort((left, right) => {
      const stopDelta = left.stopId.localeCompare(right.stopId);

      if (stopDelta !== 0) {
        return stopDelta;
      }

      const routeDelta = left.routeId.localeCompare(right.routeId);

      return routeDelta === 0
        ? left.directionId - right.directionId
        : routeDelta;
    });
}

function buildRouteStops({
  stopTimesByTripId,
  tripStopSummaries,
  trips,
}: {
  stopTimesByTripId: ReadonlyMap<string, ParsedStopTime[]>;
  tripStopSummaries: ReadonlyMap<string, TripStopSummary>;
  trips: readonly ParsedTrip[];
}) {
  const representativeTripByRouteDirection = new Map<string, ParsedTrip>();

  for (const trip of trips) {
    const summary = tripStopSummaries.get(trip.tripId);

    if (!summary) {
      continue;
    }

    const directionId = getDirectionId(trip);
    const key = `${trip.routeId}\u0000${directionId}`;
    const currentTrip = representativeTripByRouteDirection.get(key);

    if (!currentTrip) {
      representativeTripByRouteDirection.set(key, trip);
      continue;
    }

    const currentSummary = tripStopSummaries.get(currentTrip.tripId);

    if (
      !currentSummary ||
      summary.stopCount > currentSummary.stopCount ||
      (summary.stopCount === currentSummary.stopCount &&
        trip.tripId.localeCompare(currentTrip.tripId) < 0)
    ) {
      representativeTripByRouteDirection.set(key, trip);
    }
  }

  const routeStops: DerivedRouteStop[] = [];

  for (const trip of representativeTripByRouteDirection.values()) {
    const tripStopTimes = stopTimesByTripId.get(trip.tripId) ?? [];
    const directionId = getDirectionId(trip);

    for (const stopTime of tripStopTimes) {
      routeStops.push({
        directionId,
        representativeTripId: trip.tripId,
        routeId: trip.routeId,
        stopId: stopTime.stopId,
        stopSequence: stopTime.stopSequence,
      });
    }
  }

  return routeStops.sort((left, right) => {
    const routeDelta = left.routeId.localeCompare(right.routeId);

    if (routeDelta !== 0) {
      return routeDelta;
    }

    const directionDelta = left.directionId - right.directionId;

    return directionDelta === 0
      ? left.stopSequence - right.stopSequence
      : directionDelta;
  });
}

function buildRouteServiceDays({
  calendarDates,
  calendars,
  routesById,
  serviceWindowDays,
  tripStopSummaries,
  tripsByServiceId,
}: {
  calendarDates: readonly ParsedCalendarDate[];
  calendars: readonly ParsedCalendar[];
  routesById: ReadonlyMap<string, ParsedRoute>;
  serviceWindowDays: number;
  tripStopSummaries: ReadonlyMap<string, TripStopSummary>;
  tripsByServiceId: ReadonlyMap<string, ParsedTrip[]>;
}) {
  const activeServicesByDate = buildActiveServicesByDate({
    calendarDates,
    calendars,
    serviceWindowDays,
  });
  const serviceDaysByDateRoute = new Map<string, RouteServiceDayAccumulator>();

  for (const [serviceDate, serviceIds] of activeServicesByDate.entries()) {
    for (const serviceId of serviceIds) {
      const trips = tripsByServiceId.get(serviceId) ?? [];

      for (const trip of trips) {
        const route = routesById.get(trip.routeId);
        const summary = tripStopSummaries.get(trip.tripId);

        if (!route || !summary) {
          continue;
        }

        const key = `${serviceDate}\u0000${trip.routeId}`;
        const accumulator = serviceDaysByDateRoute.get(key) ?? {
          firstDepartureSeconds: null,
          lastArrivalSeconds: null,
          route,
          serviceIds: new Set<string>(),
          tripIds: new Set<string>(),
        };

        accumulator.firstDepartureSeconds = addSecondsMinimum(
          accumulator.firstDepartureSeconds,
          summary.firstDepartureSeconds,
        );
        accumulator.lastArrivalSeconds = addSecondsMaximum(
          accumulator.lastArrivalSeconds,
          summary.lastArrivalSeconds,
        );
        accumulator.serviceIds.add(serviceId);
        accumulator.tripIds.add(trip.tripId);
        serviceDaysByDateRoute.set(key, accumulator);
      }
    }
  }

  return [...serviceDaysByDateRoute.entries()]
    .map(([key, accumulator]) => {
      const [serviceDate, routeId] = key.split("\u0000");

      if (!serviceDate || !routeId) {
        return null;
      }

      return {
        firstDepartureSeconds: accumulator.firstDepartureSeconds,
        lastArrivalSeconds: accumulator.lastArrivalSeconds,
        routeId,
        routeShortName: accumulator.route.routeShortName,
        routeType: accumulator.route.routeType,
        serviceDate,
        serviceIds: [...accumulator.serviceIds].sort(),
        tripCount: accumulator.tripIds.size,
      } satisfies DerivedRouteServiceDay;
    })
    .filter(
      (serviceDay): serviceDay is DerivedRouteServiceDay => serviceDay !== null,
    )
    .sort((left, right) => {
      const dateDelta = left.serviceDate.localeCompare(right.serviceDate);

      return dateDelta === 0
        ? left.routeId.localeCompare(right.routeId)
        : dateDelta;
    });
}

export function buildDerivedGtfsStaticData({
  calendarDates,
  calendars,
  routes,
  serviceWindowDays = DEFAULT_SERVICE_WINDOW_DAYS,
  stopTimes,
  trips,
}: {
  calendarDates: readonly ParsedCalendarDate[];
  calendars: readonly ParsedCalendar[];
  routes: readonly ParsedRoute[];
  serviceWindowDays?: number;
  stopTimes: readonly ParsedStopTime[];
  trips: readonly ParsedTrip[];
}) {
  const routesById = new Map(routes.map((route) => [route.routeId, route]));
  const tripsById = new Map(trips.map((trip) => [trip.tripId, trip]));
  const tripsByServiceId = new Map<string, ParsedTrip[]>();

  for (const trip of trips) {
    const serviceTrips = tripsByServiceId.get(trip.serviceId) ?? [];

    serviceTrips.push(trip);
    tripsByServiceId.set(trip.serviceId, serviceTrips);
  }

  const { stopTimesByTripId, tripStopSummaries } =
    buildTripStopIndexes(stopTimes);

  return {
    routeServiceDays: buildRouteServiceDays({
      calendarDates,
      calendars,
      routesById,
      serviceWindowDays,
      tripStopSummaries,
      tripsByServiceId,
    }),
    routeStops: buildRouteStops({
      stopTimesByTripId,
      tripStopSummaries,
      trips,
    }),
    stopRoutes: buildStopRoutes({
      routesById,
      stopTimes,
      tripsById,
    }),
  } satisfies DerivedGtfsStaticData;
}
