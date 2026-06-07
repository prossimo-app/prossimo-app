import type {
  ArrivalGroup,
  DisplayArrival,
  PlannedUpcomingTripsOutput,
  RealtimeTopicOutput,
  RouteVehiclesPayload,
  RouteType,
  StopArrivalsPayload,
  Translate,
} from "./types";
import type { SelectedStop } from "~/components/home-map";

const pastArrivalGraceSeconds = 60;

export function createDisplayArrivals({
  currentTimeMs,
  plannedTripsData,
  realtimePayload,
  selectedStop,
}: {
  currentTimeMs: number;
  plannedTripsData: PlannedUpcomingTripsOutput | undefined;
  realtimePayload: StopArrivalsPayload | null;
  selectedStop: SelectedStop | null;
}): DisplayArrival[] {
  if (!plannedTripsData) {
    return [];
  }

  const serverTimeMs = Date.parse(plannedTripsData.serverTime.iso);
  const elapsedSeconds = Number.isFinite(serverTimeMs)
    ? Math.max(0, Math.floor((currentTimeMs - serverTimeMs) / 1_000))
    : 0;
  const currentDaySeconds =
    plannedTripsData.serverTime.daySeconds + elapsedSeconds;
  const plannedTrips = plannedTripsData.plannedUpcomingTrips;
  const plannedTripsByNormalizedTripId = new Map(
    plannedTrips.map((arrival) => [
      normalizeRealtimeTripId(arrival.tripId),
      arrival,
    ]),
  );
  const routeColorsById = new Map(
    plannedTrips.map((arrival) => [arrival.routeId, arrival.color]),
  );

  for (const route of selectedStop?.routes ?? []) {
    routeColorsById.set(route.routeId, route.color);
  }

  const realtimeArrivals = (realtimePayload?.arrivals ?? [])
    .map<DisplayArrival | null>((arrival) => {
      const tripId = arrival.tripId;
      const normalizedTripId = tripId ? normalizeRealtimeTripId(tripId) : null;
      const plannedTrip = normalizedTripId
        ? plannedTripsByNormalizedTripId.get(normalizedTripId)
        : undefined;
      const realtimeSeconds = getRealtimeArrivalInSeconds(
        arrival,
        currentTimeMs,
      );
      const scheduledArrivalSeconds =
        arrival.scheduledArrivalSeconds ??
        arrival.scheduledDepartureSeconds ??
        plannedTrip?.arrivalSeconds ??
        null;
      const scheduledSecondsUntilArrival =
        scheduledArrivalSeconds === null
          ? null
          : scheduledArrivalSeconds - currentDaySeconds;

      if (realtimeSeconds === null && scheduledArrivalSeconds === null) {
        return null;
      }

      if (
        realtimeSeconds !== null
          ? realtimeSeconds < -pastArrivalGraceSeconds
          : (scheduledSecondsUntilArrival ?? 0) < -pastArrivalGraceSeconds
      ) {
        return null;
      }

      const routeId = arrival.routeId ?? plannedTrip?.routeId ?? "unknown";
      const arrivalSeconds =
        scheduledArrivalSeconds ?? plannedTrip?.arrivalSeconds ?? 0;

      return {
        arrivalInSeconds: realtimeSeconds ?? scheduledSecondsUntilArrival ?? 0,
        arrivalSeconds,
        color:
          plannedTrip?.color ??
          arrival.routeColor ??
          routeColorsById.get(routeId) ??
          null,
        departureSeconds:
          arrival.scheduledDepartureSeconds ??
          plannedTrip?.departureSeconds ??
          null,
        directionId: plannedTrip?.directionId ?? 0,
        isRealtime: true,
        routeId,
        routeShortName:
          arrival.routeShortName ?? plannedTrip?.routeShortName ?? routeId,
        routeType: plannedTrip?.routeType ?? arrival.routeType,
        serviceDate:
          plannedTrip?.serviceDate ?? plannedTripsData.serverTime.date,
        tripCount: plannedTrip?.tripCount ?? 0,
        tripHeadsign:
          plannedTrip?.tripHeadsign ??
          arrival.directionName ??
          arrival.vehicleId,
        tripId:
          tripId ?? `${routeId}:${arrival.stopSequence ?? arrivalSeconds}`,
        vehicleId: arrival.vehicleId,
        vehiclePosition: arrival.vehiclePosition,
      };
    })
    .filter((arrival): arrival is DisplayArrival => Boolean(arrival));
  const realtimeTripIds = new Set(
    realtimeArrivals.map((arrival) => normalizeRealtimeTripId(arrival.tripId)),
  );
  const staticArrivals = plannedTrips
    .filter(
      (arrival) =>
        !realtimeTripIds.has(normalizeRealtimeTripId(arrival.tripId)) &&
        arrival.arrivalSeconds >= currentDaySeconds - pastArrivalGraceSeconds,
    )
    .map<DisplayArrival>((arrival) => ({
      ...arrival,
      arrivalInSeconds: Math.max(0, arrival.arrivalSeconds - currentDaySeconds),
      isRealtime: false,
      vehicleId: null,
      vehiclePosition: null,
    }));

  return [...realtimeArrivals, ...staticArrivals];
}

export function createArrivalGroups(
  arrivals: DisplayArrival[],
): ArrivalGroup[] {
  const groups = new Map<string, ArrivalGroup>();

  for (const arrival of arrivals) {
    const routeKey = arrival.routeId;
    const routeLabel = arrival.routeShortName;
    const group = groups.get(routeKey) ?? {
      arrivals: [],
      color: arrival.color,
      key: routeKey,
      label: routeLabel,
      routeType: arrival.routeType,
    };

    group.arrivals.push(arrival);
    groups.set(routeKey, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      arrivals: group.arrivals.sort(
        (left, right) =>
          left.arrivalInSeconds - right.arrivalInSeconds ||
          left.tripId.localeCompare(right.tripId),
      ),
    }))
    .sort(
      (left, right) =>
        getFirstArrivalSeconds(left) - getFirstArrivalSeconds(right) ||
        left.label.localeCompare(right.label),
    );
}

export function filterArrivalGroups(groups: ArrivalGroup[], query: string) {
  const normalizedQuery = normalizeLineSearchValue(query);

  if (!normalizedQuery) {
    return groups;
  }

  return groups.filter((group) => {
    const routeText = normalizeLineSearchValue(`${group.label} ${group.key}`);

    if (routeText.includes(normalizedQuery)) {
      return true;
    }

    return group.arrivals.some((arrival) =>
      normalizeLineSearchValue(
        `${arrival.routeShortName} ${arrival.routeId} ${arrival.tripHeadsign ?? ""}`,
      ).includes(normalizedQuery),
    );
  });
}

export function formatArrivalMinutes(
  secondsUntilArrival: number,
  isRealtime: boolean,
  t: Translate,
) {
  const minutes = Math.max(0, Math.ceil(secondsUntilArrival / 60));
  const suffix = isRealtime ? "*" : "";

  if (minutes === 0) {
    return `${t("home.drawer.arrivals.due")}${suffix}`;
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${t("home.drawer.arrivals.hours", { count: hours })}${suffix}`;
    }

    return `${t("home.drawer.arrivals.hoursMinutes", {
      hours,
      minutes: remainingMinutes,
    })}${suffix}`;
  }

  return `${t("home.drawer.arrivals.minutes", { count: minutes })}${suffix}`;
}

export function getArrivalDetail(arrival: DisplayArrival, t: Translate) {
  if (arrival.tripHeadsign) {
    return t("home.drawer.arrivals.toward", {
      destination: arrival.tripHeadsign,
    });
  }

  return t("home.drawer.arrivals.scheduled");
}

export function getLastUpdatedDisplay(updatedAt: string | null, t: Translate) {
  if (!updatedAt) {
    return null;
  }

  const updatedAtMs = Date.parse(updatedAt);

  if (!Number.isFinite(updatedAtMs)) {
    return null;
  }

  return {
    animationValue: Math.floor(updatedAtMs / 1_000),
    label: t("home.drawer.arrivals.updatedAt", {
      time: new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(updatedAtMs)),
    }),
  };
}

export function normalizeRouteColor(color: string | null) {
  if (!color || !/^[0-9a-f]{6}$/i.test(color)) {
    return "#2563eb";
  }

  return `#${color}`;
}

export function parseStopArrivalsPayload(
  data: RealtimeTopicOutput,
): StopArrivalsPayload | null {
  if (!data || typeof data !== "object" || !("payload" in data)) {
    return null;
  }

  const payload = data.payload;

  if (!isRecord(payload) || !Array.isArray(payload.arrivals)) {
    return null;
  }

  const stopId = typeof payload.stopId === "string" ? payload.stopId : null;

  if (!stopId) {
    return null;
  }

  return {
    arrivals: payload.arrivals
      .map(parseStopArrival)
      .filter((arrival): arrival is StopArrivalsPayload["arrivals"][number] =>
        Boolean(arrival),
      ),
    fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : "",
    stopId,
  };
}

export function parseRouteVehiclesPayload(
  data: RealtimeTopicOutput,
): RouteVehiclesPayload | null {
  if (!data || typeof data !== "object" || !("payload" in data)) {
    return null;
  }

  const payload = data.payload;

  if (!isRecord(payload) || !Array.isArray(payload.vehicles)) {
    return null;
  }

  const routeId = typeof payload.routeId === "string" ? payload.routeId : null;

  if (!routeId) {
    return null;
  }

  return {
    fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : "",
    routeId,
    vehicles: payload.vehicles
      .map(parseRouteVehicle)
      .filter((vehicle): vehicle is RouteVehiclesPayload["vehicles"][number] =>
        Boolean(vehicle),
      ),
  };
}

function normalizeLineSearchValue(value: string) {
  return value.trim().toLocaleLowerCase("it-IT");
}

function getFirstArrivalSeconds(group: ArrivalGroup) {
  return group.arrivals[0]?.arrivalInSeconds ?? Number.MAX_SAFE_INTEGER;
}

function getRealtimeArrivalInSeconds(
  arrival: StopArrivalsPayload["arrivals"][number],
  currentTimeMs: number,
) {
  const realtimeEpochSeconds = arrival.arrivalTime ?? arrival.departureTime;

  if (realtimeEpochSeconds === null) {
    return null;
  }

  return Math.ceil(realtimeEpochSeconds - currentTimeMs / 1_000);
}

function normalizeRealtimeTripId(tripId: string) {
  return tripId.replace(/[A-Za-z]+$/, "");
}

function parseStopArrival(
  value: unknown,
): StopArrivalsPayload["arrivals"][number] | null {
  if (!isRecord(value) || typeof value.stopId !== "string") {
    return null;
  }

  return {
    arrivalTime: getNullableNumber(value.arrivalTime),
    delaySeconds: getNullableNumber(value.delaySeconds),
    departureTime: getNullableNumber(value.departureTime),
    directionName: getNullableString(value.directionName),
    routeId: getNullableString(value.routeId),
    routeColor: getNullableString(value.routeColor),
    routeLongName: getNullableString(value.routeLongName),
    routeShortName: getNullableString(value.routeShortName),
    routeType: getRouteType(value.routeType),
    routeTypeId: getNullableNumber(value.routeTypeId),
    scheduledArrivalSeconds: getNullableNumber(value.scheduledArrivalSeconds),
    scheduledDepartureSeconds: getNullableNumber(
      value.scheduledDepartureSeconds,
    ),
    stopId: value.stopId,
    stopSequence: getNullableNumber(value.stopSequence),
    tripId: getNullableString(value.tripId),
    vehicleId: getNullableString(value.vehicleId),
    vehiclePosition: parseVehiclePosition(value.vehiclePosition),
  };
}

function parseRouteVehicle(
  value: unknown,
): RouteVehiclesPayload["vehicles"][number] | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const lat = value.lat;
  const lon = value.lon;

  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  return {
    bearing: getNullableNumber(value.bearing),
    currentStopSequence: getNullableNumber(value.currentStopSequence),
    id: value.id,
    label: getNullableString(value.label),
    lat,
    lon,
    routeId: getNullableString(value.routeId),
    speed: getNullableNumber(value.speed),
    stopId: getNullableString(value.stopId),
    timestamp: getNullableNumber(value.timestamp),
    tripId: getNullableString(value.tripId),
    vehicleId: getNullableString(value.vehicleId),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseVehiclePosition(
  value: unknown,
): StopArrivalsPayload["arrivals"][number]["vehiclePosition"] {
  if (!isRecord(value)) {
    return null;
  }

  const lat = value.lat;
  const lon = value.lon;

  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  return {
    bearing: getNullableNumber(value.bearing),
    lat,
    lon,
    speed: getNullableNumber(value.speed),
  };
}

function getRouteType(value: unknown): RouteType {
  return value === "bus" ||
    value === "metro" ||
    value === "rail" ||
    value === "tram" ||
    value === "unknown"
    ? value
    : "unknown";
}
