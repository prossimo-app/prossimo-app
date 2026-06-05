import type { RefObject } from "react";
import type {
  GestureResponderHandlers,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextInput,
} from "react-native";

import type { useTranslation } from "@prossimo-app/localization";

import type { RouterOutputs } from "~/utils/api";

export type Translate = ReturnType<typeof useTranslation>["t"];
export type DrawerStop = "collapsed" | "expanded" | "full";
export type CachedStop = RouterOutputs["transit"]["getStops"]["stops"][number];
export type DrawerNearbyStop = CachedStop & { distanceMeters: number };
export type PlannedUpcomingTripsOutput =
  RouterOutputs["transit"]["getPlannedUpcomingTrips"];
export type PlannedUpcomingTrip =
  PlannedUpcomingTripsOutput["plannedUpcomingTrips"][number];
export type RouteType = PlannedUpcomingTrip["routeType"];
export type RealtimeTopicOutput = RouterOutputs["realtime"]["getTopic"]["data"];

export type DisplayArrival = PlannedUpcomingTrip & {
  isRealtime: boolean;
  vehicleId: string | null;
  vehiclePosition: VehiclePosition | null;
};

export interface VehiclePosition {
  bearing: number | null;
  lat: number;
  lon: number;
  speed: number | null;
}

export interface TrackedTransitVehicle {
  color: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  id: string;
  routeLabel: string;
  routeType: RouteType;
}

export interface SelectedTransitLine {
  color: string | null;
  routeId: string;
  routeType: RouteType;
}

export interface LastUpdatedDisplay {
  animationValue: number;
  label: string;
}

export interface StopArrivalsPayload {
  arrivals: {
    arrivalTime: number | null;
    departureTime: number | null;
    delaySeconds: number | null;
    directionName: string | null;
    routeId: string | null;
    routeColor: string | null;
    routeLongName: string | null;
    routeShortName: string | null;
    routeType: RouteType;
    routeTypeId: number | null;
    scheduledArrivalSeconds: number | null;
    scheduledDepartureSeconds: number | null;
    stopId: string;
    stopSequence: number | null;
    tripId: string | null;
    vehicleId: string | null;
    vehiclePosition: VehiclePosition | null;
  }[];
  fetchedAt: string;
  stopId: string;
}

export interface ArrivalGroup {
  arrivals: DisplayArrival[];
  color: string | null;
  key: string;
  label: string;
  routeType: RouteType;
}

export interface DrawerDragHandleProps {
  panHandlers: GestureResponderHandlers;
}

export interface SelectedStopDrawerContentProps {
  arrivalGroups: ArrivalGroup[];
  isLoading: boolean;
  isLastUpdatedRefreshing: boolean;
  isRealtimeDataPending: boolean;
  isRealtimeDataStale: boolean;
  lastUpdatedAt: string | null;
  onArrivalScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onBack?: () => void;
  onLineDetailClose: () => void;
  onLineDetailDismiss: () => void;
  onLineDetailOpen: () => void;
  onSelectedLineChange: (line: SelectedTransitLine | null) => void;
  onTrackedVehicleChange: (vehicle: TrackedTransitVehicle | null) => void;
  onSearchBlur: () => void;
  onSearchFocus: () => void;
  panHandlers: GestureResponderHandlers;
  searchInputRef: RefObject<TextInput | null>;
  scrollBottomPadding: number;
  stopCode: string | null;
  stopName: string;
}
