import type { ImageRef } from "expo-image";
import type { CameraPosition, Coordinates } from "expo-maps";
import type { MutableRefObject, Ref } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { AppleMaps, GoogleMaps } from "expo-maps";
import { skipToken, useQuery } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { useTranslation } from "@prossimo-app/localization";

import type {
  RouteVehiclesPayload,
  SelectedTransitLine,
  TrackedTransitVehicle,
} from "~/components/home-bottom-drawer/types";
import type { RouterOutputs } from "~/utils/api";
import { useAppBootstrap } from "~/app-bootstrap/app-bootstrap-provider";
import {
  clampToTorino,
  isInsideTorino,
  torinoCenter,
} from "~/map/torino-bounds";
import { useSettings } from "~/settings/settings-provider";
import { trpc } from "~/utils/api";

const NEARBY_STOPS_CAMERA_MOVE_THRESHOLD_METERS = 250;
const NEARBY_STOPS_DEFAULT_ZOOM = 13;
const NEARBY_STOPS_VISIBLE_MAX_RADIUS_METERS = 5_000;
const NEARBY_STOPS_MIN_RADIUS_METERS = 500;
const NEARBY_STOPS_MAX_RADIUS_METERS = 50_000;
const NEARBY_STOPS_MAX_LIMIT = 100;
const NEARBY_STOPS_BOTTOM_COVERAGE_RATIO = 0.3;
const NEARBY_STOPS_SCREEN_Y = (1 - NEARBY_STOPS_BOTTOM_COVERAGE_RATIO) / 2;
const INITIAL_LOCATION_BOTTOM_COVERAGE_RATIO = 0.3;
const INITIAL_LOCATION_SCREEN_Y =
  (1 - INITIAL_LOCATION_BOTTOM_COVERAGE_RATIO) / 2;
const INITIAL_LOCATION_ZOOM = 15.5;
const SELECTED_STOP_MARKER_ZOOM = 17.5;
const SELECTED_STOP_MARKER_SCREEN_Y = 0.3;
const SELECTED_STOP_CAMERA_ANIMATION_DURATION_MS = 1_200;
const TRACKED_VEHICLE_MARKER_ZOOM = 14;
const TRACKED_VEHICLE_MARKER_SCREEN_Y = 0.3;
const ROUTE_DETAIL_BOTTOM_COVERAGE_RATIO = 0.25;
const ROUTE_DETAIL_CAMERA_PADDING_PX = 96;
const ROUTE_DETAIL_SCREEN_Y = (1 - ROUTE_DETAIL_BOTTOM_COVERAGE_RATIO) / 2;
const MARKER_TAP_MAP_CLICK_SUPPRESSION_MS = 250;
const STOP_MARKER_COLOR = "#2563eb";
const CLUSTER_MARKER_COLOR = "#0f766e";
const CLUSTER_MARKER_TEXT_COLOR = "#ffffff";
const VEHICLE_MARKER_DEFAULT_COLOR = "#111827";
const VEHICLE_MARKER_TEXT_COLOR = "#ffffff";
const VEHICLE_MARKER_SIZE = 46;
const ROUTE_SHAPE_LINE_WIDTH = 2.5;
const CLUSTER_SCREEN_RADIUS_PX = 44;
const CLUSTER_MARKER_SIZE = 44;
const CLUSTER_FOCUS_CAMERA_PADDING_PX = 72;
const CLUSTER_FOCUS_SCREEN_Y = 0.3;
const MIN_STOPS_FOR_CLUSTERING = 15;
const MIN_RADIUS_METERS_FOR_CLUSTERING = 1_000;
const MIN_CLUSTER_STOP_COUNT = 3;
const EARTH_RADIUS_METERS = 6_371_000;
const WEB_MERCATOR_METERS_PER_PIXEL_AT_EQUATOR = 156_543.03392;

type CachedStop = RouterOutputs["transit"]["getStops"]["stops"][number];
type NearbyStop = CachedStop & { distanceMeters: number };

interface CameraMoveEvent {
  bearing: number;
  coordinates: Coordinates;
  latitudeDelta?: number;
  longitudeDelta?: number;
  tilt: number;
  zoom: number;
}

interface MapCameraRef {
  setCameraPosition: (config: CameraPosition & { duration?: number }) => void;
}

interface NearbyStopsQueryViewport {
  coordinates: Coordinates;
  radiusMeters: number;
  zoom: number;
}

interface StopMarker {
  id: string;
  coordinates: Coordinates & { latitude: number; longitude: number };
  count: number;
  routes: NearbyStop["routes"];
  stopCode: string | null;
  stopDesc: string | null;
  stopId: string | null;
  stops: NearbyStop[];
  title: string;
}

export interface SelectedStop {
  coordinates: Coordinates & { latitude: number; longitude: number };
  routes: CachedStop["routes"];
  stopCode: string | null;
  stopDesc: string | null;
  stopId: string;
  stopName: string;
}

interface HomeMapProps {
  onLocationChange?: (location: Coordinates | null) => void;
  onRouteVehiclePress?: (
    vehicle: RouteVehiclesPayload["vehicles"][number],
  ) => void;
  onStopSelectionChange?: (stop: SelectedStop | null) => void;
  preserveSelectedStopOnLineDetail?: boolean;
  routeVehiclesPayload?: RouteVehiclesPayload | null;
  selectedLine?: SelectedTransitLine | null;
  selectedStop?: SelectedStop | null;
  trackedVehicle?: TrackedTransitVehicle | null;
}

export function HomeMap({
  onLocationChange,
  onRouteVehiclePress,
  onStopSelectionChange,
  preserveSelectedStopOnLineDetail = false,
  routeVehiclesPayload = null,
  selectedLine = null,
  selectedStop = null,
  trackedVehicle = null,
}: HomeMapProps) {
  const { t } = useTranslation();
  const { appBootstrap } = useAppBootstrap();
  const {
    isLocationSharingEnabled,
    isMapLimitedToTorino,
    locationPermission,
    refreshLocationPermission,
    setIsMapLimitedToTorino,
  } = useSettings();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [nearbyStopsViewport, setNearbyStopsViewport] =
    useState<NearbyStopsQueryViewport>(() =>
      createNearbyStopsViewport({
        coordinates: torinoCenter,
        screenHeight: windowHeight,
        screenWidth: windowWidth,
        zoom: NEARBY_STOPS_DEFAULT_ZOOM,
      }),
    );
  const nearbyStopsViewportRef =
    useRef<NearbyStopsQueryViewport>(nearbyStopsViewport);
  const [clusterIconsByCount, setClusterIconsByCount] = useState(
    () => new Map<number, ImageRef>(),
  );
  const [vehicleIconsByKey, setVehicleIconsByKey] = useState(
    () => new Map<string, ImageRef>(),
  );
  const [selectedStopMarker, setSelectedStopMarker] =
    useState<StopMarker | null>(null);
  const appleMapRef = useRef<MapCameraRef | null>(null);
  const googleMapRef = useRef<MapCameraRef | null>(null);
  const currentCameraPositionRef = useRef<CameraPosition>({
    coordinates: torinoCenter,
    zoom: NEARBY_STOPS_DEFAULT_ZOOM,
  });
  const previousCameraPositionRef = useRef<CameraPosition | null>(null);
  const lineDetailCameraPositionRef = useRef<CameraPosition | null>(null);
  const previousSelectedLineRouteIdRef = useRef<string | null>(
    selectedLine?.routeId ?? null,
  );
  const trackedVehicleIdRef = useRef<string | null>(trackedVehicle?.id ?? null);
  const selectedStopCameraPositionRef = useRef<CameraPosition | null>(null);
  const selectedStopMarkerIdRef = useRef<string | null>(null);
  const ignoreMapClickUntilRef = useRef(0);
  const pendingMapDeselectTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const hasRequestedAskNextTimePermission = useRef(false);
  const isNativeLocationEnabled = isLocationSharingEnabled;
  const visibleLocation =
    isLocationSharingEnabled &&
    location &&
    (!isMapLimitedToTorino || isInsideTorino(location))
      ? location
      : null;
  const cameraPosition = useMemo(
    () =>
      getInitialCameraPosition({
        screenHeight: windowHeight,
        visibleLocation,
      }),
    [visibleLocation, windowHeight],
  );

  useEffect(() => {
    if (selectedStopMarkerIdRef.current) {
      return;
    }

    currentCameraPositionRef.current = cameraPosition;
  }, [cameraPosition]);

  useEffect(
    () => () => {
      clearPendingMapDeselect(pendingMapDeselectTimeoutRef);
    },
    [],
  );

  useEffect(() => {
    onLocationChange?.(location);
  }, [location, onLocationChange]);

  useEffect(() => {
    const mapRef =
      Platform.OS === "ios" ? appleMapRef.current : googleMapRef.current;
    const previousSelectedLineRouteId = previousSelectedLineRouteIdRef.current;
    previousSelectedLineRouteIdRef.current = selectedLine?.routeId ?? null;

    if (selectedLine && !previousSelectedLineRouteId) {
      lineDetailCameraPositionRef.current = currentCameraPositionRef.current;
    }

    if (trackedVehicle) {
      const previousTrackedVehicleId = trackedVehicleIdRef.current;
      trackedVehicleIdRef.current = trackedVehicle.id;
      const zoom =
        previousTrackedVehicleId === trackedVehicle.id &&
        currentCameraPositionRef.current.zoom !== undefined
          ? currentCameraPositionRef.current.zoom
          : TRACKED_VEHICLE_MARKER_ZOOM;
      const coordinates = getCameraCenterForMarkerScreenPosition(
        trackedVehicle.coordinates,
        {
          screenHeight: windowHeight,
          screenY: TRACKED_VEHICLE_MARKER_SCREEN_Y,
          zoom,
        },
      );
      const cameraPosition = {
        coordinates:
          isMapLimitedToTorino && !isInsideTorino(coordinates)
            ? clampToTorino(coordinates)
            : coordinates,
        duration: getCameraAnimationDuration(),
        zoom,
      };

      mapRef?.setCameraPosition(cameraPosition);
      currentCameraPositionRef.current = cameraPosition;
      updateNearbyStopsViewport(cameraPosition, {
        screenHeight: windowHeight,
        screenWidth: windowWidth,
        setViewport: setNearbyStopsViewport,
        viewportRef: nearbyStopsViewportRef,
      });
      return;
    }

    trackedVehicleIdRef.current = null;

    if (selectedLine) {
      return;
    }

    if (previousSelectedLineRouteId && lineDetailCameraPositionRef.current) {
      const restoredCameraPosition = lineDetailCameraPositionRef.current;
      lineDetailCameraPositionRef.current = null;

      if (!selectedStopMarkerIdRef.current) {
        mapRef?.setCameraPosition({
          ...restoredCameraPosition,
          duration: getCameraAnimationDuration(),
        });
        currentCameraPositionRef.current = restoredCameraPosition;

        if (
          hasValidCoordinates(restoredCameraPosition.coordinates) &&
          restoredCameraPosition.zoom !== undefined
        ) {
          updateNearbyStopsViewport(
            {
              coordinates: restoredCameraPosition.coordinates,
              zoom: restoredCameraPosition.zoom,
            },
            {
              screenHeight: windowHeight,
              screenWidth: windowWidth,
              setViewport: setNearbyStopsViewport,
              viewportRef: nearbyStopsViewportRef,
            },
          );
        }
      }
    }

    const selectedStopCameraPosition = selectedStopCameraPositionRef.current;

    if (
      selectedStop &&
      selectedStopMarkerIdRef.current &&
      selectedStopCameraPosition &&
      hasValidCoordinates(selectedStopCameraPosition.coordinates) &&
      selectedStopCameraPosition.zoom !== undefined
    ) {
      const restoredCameraPosition = {
        coordinates: selectedStopCameraPosition.coordinates,
        zoom: selectedStopCameraPosition.zoom,
      };

      mapRef?.setCameraPosition({
        ...selectedStopCameraPosition,
        duration: getCameraAnimationDuration(),
      });
      currentCameraPositionRef.current = selectedStopCameraPosition;
      updateNearbyStopsViewport(restoredCameraPosition, {
        screenHeight: windowHeight,
        screenWidth: windowWidth,
        setViewport: setNearbyStopsViewport,
        viewportRef: nearbyStopsViewportRef,
      });
    }
  }, [
    isMapLimitedToTorino,
    selectedLine,
    selectedStop,
    trackedVehicle,
    windowHeight,
    windowWidth,
  ]);

  useEffect(() => {
    if (selectedStop || !selectedStopMarkerIdRef.current) {
      return;
    }

    const mapRef =
      Platform.OS === "ios" ? appleMapRef.current : googleMapRef.current;

    restorePreviousCameraPosition(mapRef, {
      animationDuration: getCameraAnimationDuration(),
      currentCameraPositionRef,
      previousCameraPositionRef,
      screenHeight: windowHeight,
      screenWidth: windowWidth,
      selectedStopCameraPositionRef,
      selectedStopMarkerIdRef,
      setViewport: setNearbyStopsViewport,
      viewportRef: nearbyStopsViewportRef,
    });
    setSelectedStopMarker(null);
  }, [selectedStop, windowHeight, windowWidth]);

  useEffect(() => {
    if (
      !selectedStop ||
      selectedLine ||
      !hasValidCoordinates(selectedStop.coordinates) ||
      selectedStopMarkerIdRef.current === selectedStop.stopId
    ) {
      return;
    }

    const mapRef =
      Platform.OS === "ios" ? appleMapRef.current : googleMapRef.current;
    const stopMarker = createStopMarkerFromSelectedStop(selectedStop);

    if (!selectedStopMarkerIdRef.current) {
      previousCameraPositionRef.current = currentCameraPositionRef.current;
    }

    selectedStopMarkerIdRef.current = selectedStop.stopId;
    setSelectedStopMarker(stopMarker);

    const coordinates = getCameraCenterForMarkerScreenPosition(
      selectedStop.coordinates,
      {
        screenHeight: windowHeight,
        screenY: SELECTED_STOP_MARKER_SCREEN_Y,
        zoom: SELECTED_STOP_MARKER_ZOOM,
      },
    );
    const cameraPosition = {
      coordinates:
        isMapLimitedToTorino && !isInsideTorino(coordinates)
          ? clampToTorino(coordinates)
          : coordinates,
      duration: getCameraAnimationDuration(),
      zoom: SELECTED_STOP_MARKER_ZOOM,
    };

    mapRef?.setCameraPosition(cameraPosition);
    currentCameraPositionRef.current = cameraPosition;
    selectedStopCameraPositionRef.current = cameraPosition;
    updateNearbyStopsViewport(cameraPosition, {
      screenHeight: windowHeight,
      screenWidth: windowWidth,
      setViewport: setNearbyStopsViewport,
      viewportRef: nearbyStopsViewportRef,
    });
  }, [
    isMapLimitedToTorino,
    selectedLine,
    selectedStop,
    windowHeight,
    windowWidth,
  ]);

  const activeFeedVersionId = appBootstrap?.activeFeedVersionId;
  const isNearbyStopsQueryTooWide =
    nearbyStopsViewport.radiusMeters > NEARBY_STOPS_VISIBLE_MAX_RADIUS_METERS;
  const { data: cachedStopsData } = useQuery({
    ...trpc.transit.getStops.queryOptions(
      activeFeedVersionId ? { feedVersionId: activeFeedVersionId } : skipToken,
    ),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const routeShapesInput = useMemo(
    () =>
      activeFeedVersionId && selectedLine
        ? {
            feedVersionId: activeFeedVersionId,
            routeId: selectedLine.routeId,
          }
        : null,
    [activeFeedVersionId, selectedLine],
  );
  const { data: routeShapesData } = useQuery({
    ...trpc.transit.getRouteShapes.queryOptions(routeShapesInput ?? skipToken),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const shouldShowZoomWarning = isNearbyStopsQueryTooWide && !selectedLine;
  const mapOverlayMessage = trackedVehicle
    ? t("home.map.followingVehicle", { vehicle: trackedVehicle.id })
    : t("home.map.zoomWarning");
  const mapOverlay = (
    <NearbyStopsZoomWarning
      isVisible={Boolean(trackedVehicle) || shouldShowZoomWarning}
      message={mapOverlayMessage}
    />
  );
  const nearbyStops = useMemo(() => {
    if (isNearbyStopsQueryTooWide) {
      return [];
    }

    const cachedStops =
      cachedStopsData && cachedStopsData.feedVersionId === activeFeedVersionId
        ? cachedStopsData.stops
        : [];

    return getNearbyStopsForViewport(cachedStops, {
      limit: getNearbyStopsLimit(nearbyStopsViewport.radiusMeters),
      viewport: nearbyStopsViewport,
    });
  }, [
    activeFeedVersionId,
    cachedStopsData,
    isNearbyStopsQueryTooWide,
    nearbyStopsViewport,
  ]);
  const stopMarkers = useMemo(
    () =>
      createStopMarkers(nearbyStops, nearbyStopsViewport, {
        getClusterTitle: (count) => t("home.map.clusterTitle", { count }),
      }),
    [nearbyStops, nearbyStopsViewport, t],
  );
  const visibleStopMarkers = useMemo(
    () =>
      getVisibleStopMarkers(stopMarkers, selectedStopMarker, {
        isShowingLineDetail: Boolean(selectedLine),
        isTrackingVehicle: Boolean(trackedVehicle),
        preserveSelectedStopOnLineDetail,
      }),
    [
      preserveSelectedStopOnLineDetail,
      selectedLine,
      selectedStopMarker,
      stopMarkers,
      trackedVehicle,
    ],
  );
  const routeShapePolylines = useMemo(() => {
    if (
      !activeFeedVersionId ||
      !selectedLine ||
      routeShapesData?.feedVersionId !== activeFeedVersionId ||
      routeShapesData.routeId !== selectedLine.routeId
    ) {
      return [];
    }

    const color = normalizeMapRouteColor(selectedLine.color);

    return routeShapesData.shapes.map((shape) => ({
      color,
      coordinates: shape.coordinates,
      id: `route-shape:${selectedLine.routeId}:${shape.shapeId}`,
      width: ROUTE_SHAPE_LINE_WIDTH,
    }));
  }, [activeFeedVersionId, routeShapesData, selectedLine]);
  const routeVehicleMarkers = useMemo<TrackedTransitVehicle[]>(() => {
    if (
      !selectedLine ||
      routeVehiclesPayload?.routeId !== selectedLine.routeId
    ) {
      return [];
    }

    return routeVehiclesPayload.vehicles
      .filter(
        (vehicle) =>
          vehicle.id !== trackedVehicle?.id &&
          (!trackedVehicle?.tripId || vehicle.tripId !== trackedVehicle.tripId),
      )
      .map((vehicle) => ({
        bearing: vehicle.bearing,
        color: selectedLine.color,
        coordinates: {
          latitude: vehicle.lat,
          longitude: vehicle.lon,
        },
        id: vehicle.id,
        routeLabel: selectedLine.routeLabel,
        routeType: selectedLine.routeType,
        timestamp: vehicle.timestamp,
      }));
  }, [routeVehiclesPayload, selectedLine, trackedVehicle]);

  useEffect(() => {
    if (trackedVehicle || routeShapePolylines.length === 0) {
      return;
    }

    const routeCameraPosition = getCameraPositionForRouteShapePolylines(
      routeShapePolylines,
      {
        bottomCoverageRatio: ROUTE_DETAIL_BOTTOM_COVERAGE_RATIO,
        paddingPixels: ROUTE_DETAIL_CAMERA_PADDING_PX,
        screenHeight: windowHeight,
        screenWidth: windowWidth,
        screenY: ROUTE_DETAIL_SCREEN_Y,
      },
    );

    if (!routeCameraPosition) {
      return;
    }

    const mapRef =
      Platform.OS === "ios" ? appleMapRef.current : googleMapRef.current;
    const cameraPosition = {
      ...routeCameraPosition,
      duration: getCameraAnimationDuration(),
    };

    mapRef?.setCameraPosition(cameraPosition);
    currentCameraPositionRef.current = cameraPosition;
    updateNearbyStopsViewport(routeCameraPosition, {
      screenHeight: windowHeight,
      screenWidth: windowWidth,
      setViewport: setNearbyStopsViewport,
      viewportRef: nearbyStopsViewportRef,
    });
  }, [routeShapePolylines, trackedVehicle, windowHeight, windowWidth]);
  const clusterCounts = useMemo(
    () =>
      Array.from(
        new Set(
          visibleStopMarkers
            .filter((marker) => marker.count > 1)
            .map((marker) => marker.count),
        ),
      ),
    [visibleStopMarkers],
  );
  const appleMarkers = useMemo<AppleMaps.Marker[]>(() => {
    const markers: AppleMaps.Marker[] = visibleStopMarkers.map((marker) => ({
      coordinates: marker.coordinates,
      id: marker.id,
      monogram: marker.count > 1 ? String(marker.count) : undefined,
      systemImage: marker.count === 1 ? "mappin.circle.fill" : undefined,
      tintColor: marker.count > 1 ? CLUSTER_MARKER_COLOR : STOP_MARKER_COLOR,
      title: marker.title,
    }));

    for (const routeVehicle of routeVehicleMarkers) {
      markers.push({
        coordinates: routeVehicle.coordinates,
        id: getRouteVehicleMarkerId(routeVehicle),
        systemImage: getAppleVehicleSystemImage(routeVehicle.routeType),
        tintColor: normalizeMapRouteColor(routeVehicle.color),
        title: t("home.drawer.arrivals.line", {
          line: routeVehicle.routeLabel,
        }),
      });
    }

    if (trackedVehicle) {
      markers.push({
        coordinates: trackedVehicle.coordinates,
        id: getTrackedVehicleMarkerId(trackedVehicle),
        systemImage: getAppleVehicleSystemImage(trackedVehicle.routeType),
        tintColor: normalizeMapRouteColor(trackedVehicle.color),
        title: t("home.drawer.arrivals.line", {
          line: trackedVehicle.routeLabel,
        }),
      });
    }

    return markers;
  }, [routeVehicleMarkers, t, trackedVehicle, visibleStopMarkers]);
  const googleMarkers = useMemo<GoogleMaps.Marker[]>(() => {
    const markers: GoogleMaps.Marker[] = visibleStopMarkers.map((marker) => ({
      anchor: marker.count > 1 ? { x: 0.5, y: 0.5 } : undefined,
      coordinates: {
        latitude: marker.coordinates.latitude,
        longitude: marker.coordinates.longitude,
      },
      icon:
        marker.count > 1 ? clusterIconsByCount.get(marker.count) : undefined,
      id: marker.id,
      showCallout: true,
      snippet:
        marker.count > 1
          ? t("home.map.clusterTitle", { count: marker.count })
          : getStopMarkerSnippet(marker.routes),
      title: marker.title,
      zIndex: marker.count > 1 ? 2 : 1,
    }));

    for (const routeVehicle of routeVehicleMarkers) {
      markers.push({
        anchor: { x: 0.5, y: 0.5 },
        coordinates: routeVehicle.coordinates,
        icon: vehicleIconsByKey.get(getTrackedVehicleIconKey(routeVehicle)),
        id: getRouteVehicleMarkerId(routeVehicle),
        showCallout: true,
        snippet: undefined,
        title: t("home.drawer.arrivals.line", {
          line: routeVehicle.routeLabel,
        }),
        zIndex: 3,
      });
    }

    if (trackedVehicle) {
      markers.push({
        anchor: { x: 0.5, y: 0.5 },
        coordinates: trackedVehicle.coordinates,
        icon: vehicleIconsByKey.get(getTrackedVehicleIconKey(trackedVehicle)),
        id: getTrackedVehicleMarkerId(trackedVehicle),
        showCallout: true,
        snippet: undefined,
        title: t("home.drawer.arrivals.line", {
          line: trackedVehicle.routeLabel,
        }),
        zIndex: 4,
      });
    }

    return markers;
  }, [
    clusterIconsByCount,
    routeVehicleMarkers,
    t,
    trackedVehicle,
    vehicleIconsByKey,
    visibleStopMarkers,
  ]);
  const handleCameraMove = useCallback(
    (event: CameraMoveEvent, mapRef: MapCameraRef | null) => {
      currentCameraPositionRef.current = {
        coordinates: event.coordinates,
        zoom: event.zoom,
      };

      if (isMapLimitedToTorino && !isInsideTorino(event.coordinates)) {
        keepCameraInTorino(event, mapRef);
        return;
      }

      updateNearbyStopsViewport(event, {
        screenHeight: windowHeight,
        screenWidth: windowWidth,
        setViewport: setNearbyStopsViewport,
        viewportRef: nearbyStopsViewportRef,
      });
    },
    [isMapLimitedToTorino, windowHeight, windowWidth],
  );
  const handleAppleCameraMove = useCallback(
    (event: CameraMoveEvent) => {
      handleCameraMove(event, appleMapRef.current);
    },
    [handleCameraMove],
  );
  const handleGoogleCameraMove = useCallback(
    (event: CameraMoveEvent) => {
      handleCameraMove(event, googleMapRef.current);
    },
    [handleCameraMove],
  );
  const handleStopMarkerClick = useCallback(
    (
      marker: Pick<AppleMaps.Marker | GoogleMaps.Marker, "coordinates" | "id">,
      mapRef: MapCameraRef | null,
    ) => {
      ignoreMapClickUntilRef.current =
        Date.now() + MARKER_TAP_MAP_CLICK_SUPPRESSION_MS;
      clearPendingMapDeselect(pendingMapDeselectTimeoutRef);

      if (selectedLine) {
        const routeVehicleId = getRouteVehicleIdFromMarkerId(marker.id);
        const routeVehicle = routeVehiclesPayload?.vehicles.find(
          (vehicle) => vehicle.id === routeVehicleId,
        );

        if (routeVehicle) {
          onRouteVehiclePress?.(routeVehicle);
        }

        return;
      }

      const markerCoordinates = marker.coordinates;

      if (!marker.id || !hasValidCoordinates(markerCoordinates)) {
        return;
      }

      if (selectedStopMarkerIdRef.current === marker.id) {
        restorePreviousCameraPosition(mapRef, {
          animationDuration: getCameraAnimationDuration(),
          currentCameraPositionRef,
          onStopSelectionChange,
          previousCameraPositionRef,
          screenHeight: windowHeight,
          screenWidth: windowWidth,
          selectedStopCameraPositionRef,
          selectedStopMarkerIdRef,
          setViewport: setNearbyStopsViewport,
          viewportRef: nearbyStopsViewportRef,
        });
        setSelectedStopMarker(null);
        return;
      }

      const stopMarker = stopMarkers.find(
        (currentMarker) => currentMarker.id === marker.id,
      );

      if (!stopMarker) {
        return;
      }

      if (stopMarker.count > 1) {
        const cameraPosition = getCameraPositionForStops(stopMarker.stops, {
          screenHeight: windowHeight,
          screenY: CLUSTER_FOCUS_SCREEN_Y,
          screenWidth: windowWidth,
        });

        if (!cameraPosition) {
          return;
        }

        if (selectedStopMarkerIdRef.current) {
          selectedStopMarkerIdRef.current = null;
          selectedStopCameraPositionRef.current = null;
          previousCameraPositionRef.current = null;
          setSelectedStopMarker(null);
          onStopSelectionChange?.(null);
        }

        mapRef?.setCameraPosition({
          ...cameraPosition,
          duration: getCameraAnimationDuration(),
        });
        currentCameraPositionRef.current = cameraPosition;
        updateNearbyStopsViewport(cameraPosition, {
          screenHeight: windowHeight,
          screenWidth: windowWidth,
          setViewport: setNearbyStopsViewport,
          viewportRef: nearbyStopsViewportRef,
        });
        return;
      }

      if (!selectedStopMarkerIdRef.current) {
        previousCameraPositionRef.current = currentCameraPositionRef.current;
      }

      selectedStopMarkerIdRef.current = marker.id;
      setSelectedStopMarker(stopMarker);

      const coordinates = getCameraCenterForMarkerScreenPosition(
        markerCoordinates,
        {
          screenHeight: windowHeight,
          screenY: SELECTED_STOP_MARKER_SCREEN_Y,
          zoom: SELECTED_STOP_MARKER_ZOOM,
        },
      );
      const cameraPosition = {
        coordinates:
          isMapLimitedToTorino && !isInsideTorino(coordinates)
            ? clampToTorino(coordinates)
            : coordinates,
        duration: getCameraAnimationDuration(),
        zoom: SELECTED_STOP_MARKER_ZOOM,
      };

      mapRef?.setCameraPosition(cameraPosition);
      selectedStopCameraPositionRef.current = cameraPosition;
      onStopSelectionChange?.({
        coordinates: stopMarker.coordinates,
        routes: stopMarker.routes,
        stopCode: stopMarker.stopCode,
        stopDesc: stopMarker.stopDesc,
        stopId: stopMarker.stopId ?? marker.id,
        stopName: stopMarker.title,
      });
      updateNearbyStopsViewport(cameraPosition, {
        screenHeight: windowHeight,
        screenWidth: windowWidth,
        setViewport: setNearbyStopsViewport,
        viewportRef: nearbyStopsViewportRef,
      });
    },
    [
      isMapLimitedToTorino,
      onRouteVehiclePress,
      onStopSelectionChange,
      routeVehiclesPayload,
      selectedLine,
      stopMarkers,
      windowHeight,
      windowWidth,
    ],
  );
  const handleMapClick = useCallback(
    (mapRef: MapCameraRef | null) => {
      if (Date.now() < ignoreMapClickUntilRef.current) {
        return;
      }

      clearPendingMapDeselect(pendingMapDeselectTimeoutRef);

      if (selectedLine) {
        return;
      }

      pendingMapDeselectTimeoutRef.current = setTimeout(() => {
        restorePreviousCameraPosition(mapRef, {
          animationDuration: getCameraAnimationDuration(),
          currentCameraPositionRef,
          onStopSelectionChange,
          previousCameraPositionRef,
          screenHeight: windowHeight,
          screenWidth: windowWidth,
          selectedStopCameraPositionRef,
          selectedStopMarkerIdRef,
          setViewport: setNearbyStopsViewport,
          viewportRef: nearbyStopsViewportRef,
        });
        setSelectedStopMarker(null);
        pendingMapDeselectTimeoutRef.current = null;
      }, MARKER_TAP_MAP_CLICK_SUPPRESSION_MS);
    },
    [onStopSelectionChange, selectedLine, windowHeight, windowWidth],
  );
  const handleAppleMapClick = useCallback(() => {
    handleMapClick(appleMapRef.current);
  }, [handleMapClick]);
  const handleGoogleMapClick = useCallback(() => {
    handleMapClick(googleMapRef.current);
  }, [handleMapClick]);
  const handleAppleMarkerClick = useCallback(
    (marker: AppleMaps.Marker) => {
      handleStopMarkerClick(marker, appleMapRef.current);
    },
    [handleStopMarkerClick],
  );
  const handleGoogleMarkerClick = useCallback(
    (marker: GoogleMaps.Marker) => {
      handleStopMarkerClick(marker, googleMapRef.current);
    },
    [handleStopMarkerClick],
  );

  useEffect(() => {
    if (clusterCounts.length === 0) {
      return;
    }

    const missingCounts = clusterCounts.filter(
      (count) => !clusterIconsByCount.has(count),
    );

    if (missingCounts.length === 0) {
      return;
    }

    let isMounted = true;

    async function loadClusterIcons() {
      const icons = await Promise.all(
        missingCounts.map(async (count) => ({
          count,
          icon: await Image.loadAsync(
            {
              height: CLUSTER_MARKER_SIZE,
              uri: createClusterMarkerDataUri(count),
              width: CLUSTER_MARKER_SIZE,
            },
            {
              maxHeight: CLUSTER_MARKER_SIZE,
              maxWidth: CLUSTER_MARKER_SIZE,
            },
          ),
        })),
      );

      if (!isMounted) {
        return;
      }

      setClusterIconsByCount((currentIcons) => {
        const nextIcons = new Map(currentIcons);

        for (const { count, icon } of icons) {
          nextIcons.set(count, icon);
        }

        return nextIcons;
      });
    }

    void loadClusterIcons();

    return () => {
      isMounted = false;
    };
  }, [clusterCounts, clusterIconsByCount]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const vehicles = [
      ...routeVehicleMarkers,
      ...(trackedVehicle ? [trackedVehicle] : []),
    ];
    const missingVehicles = vehicles.filter(
      (vehicle) => !vehicleIconsByKey.has(getTrackedVehicleIconKey(vehicle)),
    );

    if (missingVehicles.length === 0) {
      return;
    }

    let isMounted = true;

    async function loadVehicleIcon() {
      const icons = await Promise.all(
        missingVehicles.map(async (vehicle) => ({
          icon: await Image.loadAsync(
            {
              height: VEHICLE_MARKER_SIZE,
              uri: createTransitVehicleMarkerDataUri(vehicle),
              width: VEHICLE_MARKER_SIZE,
            },
            {
              maxHeight: VEHICLE_MARKER_SIZE,
              maxWidth: VEHICLE_MARKER_SIZE,
            },
          ),
          key: getTrackedVehicleIconKey(vehicle),
        })),
      );

      if (!isMounted) {
        return;
      }

      setVehicleIconsByKey((currentIcons) => {
        const nextIcons = new Map(currentIcons);

        for (const { icon, key } of icons) {
          nextIcons.set(key, icon);
        }

        return nextIcons;
      });
    }

    void loadVehicleIcon();

    return () => {
      isMounted = false;
    };
  }, [routeVehicleMarkers, trackedVehicle, vehicleIconsByKey]);

  useEffect(() => {
    let isMounted = true;

    const permission = locationPermission;

    if (!permission) {
      return () => {
        isMounted = false;
      };
    }

    async function loadLocation(
      initialPermission: Location.LocationPermissionResponse,
    ) {
      let currentPermission: Location.LocationPermissionResponse =
        initialPermission;

      if (
        initialPermission.status === Location.PermissionStatus.UNDETERMINED &&
        !hasRequestedAskNextTimePermission.current
      ) {
        hasRequestedAskNextTimePermission.current = true;
        currentPermission = await Location.requestForegroundPermissionsAsync();
        await refreshLocationPermission();
      }

      if (currentPermission.status !== Location.PermissionStatus.GRANTED) {
        if (isMounted) {
          setLocation(null);
        }
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});

      if (!isMounted) {
        return;
      }

      const nextLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      if (isMapLimitedToTorino && !isInsideTorino(nextLocation)) {
        setLocation(nextLocation);
        updateNearbyStopsViewport(
          getInitialCameraPosition({
            screenHeight: windowHeight,
            visibleLocation: nextLocation,
          }),
          {
            screenHeight: windowHeight,
            screenWidth: windowWidth,
            setViewport: setNearbyStopsViewport,
            viewportRef: nearbyStopsViewportRef,
          },
        );
        await setIsMapLimitedToTorino(false);
        toast.warning(t("settings.mapLimit.toasts.turnedOffTitle"), {
          description: t("settings.mapLimit.toasts.outsideTurinDescription"),
        });
        return;
      }

      setLocation(nextLocation);
      updateNearbyStopsViewport(
        getInitialCameraPosition({
          screenHeight: windowHeight,
          visibleLocation: nextLocation,
        }),
        {
          screenHeight: windowHeight,
          screenWidth: windowWidth,
          setViewport: setNearbyStopsViewport,
          viewportRef: nearbyStopsViewportRef,
        },
      );
    }

    void loadLocation(permission);

    return () => {
      isMounted = false;
    };
  }, [
    isMapLimitedToTorino,
    locationPermission,
    refreshLocationPermission,
    setIsMapLimitedToTorino,
    t,
    windowHeight,
    windowWidth,
  ]);

  if (Platform.OS === "ios") {
    return (
      <View className="flex-1">
        <AppleMaps.View
          ref={appleMapRef as Ref<React.ElementRef<typeof AppleMaps.View>>}
          cameraPosition={cameraPosition}
          markers={appleMarkers}
          onCameraMove={handleAppleCameraMove}
          onMapClick={handleAppleMapClick}
          onMarkerClick={handleAppleMarkerClick}
          polylines={routeShapePolylines}
          properties={{
            elevation: AppleMaps.MapStyleElevation.FLAT,
            emphasis: "MUTED" as AppleMaps.MapProperties["emphasis"],
            isMyLocationEnabled: isNativeLocationEnabled,
            isTrafficEnabled: false,
            mapType: AppleMaps.MapType.STANDARD,
            pointsOfInterest: { including: [] },
            selectionEnabled: false,
          }}
          style={{ flex: 1 }}
          uiSettings={{
            compassEnabled: false,
            myLocationButtonEnabled: isNativeLocationEnabled,
            scaleBarEnabled: false,
            togglePitchEnabled: false,
          }}
        />
        {mapOverlay}
      </View>
    );
  }

  if (Platform.OS === "android") {
    return (
      <View className="flex-1">
        <GoogleMaps.View
          ref={googleMapRef as Ref<React.ElementRef<typeof GoogleMaps.View>>}
          cameraPosition={cameraPosition}
          markers={googleMarkers}
          onCameraMove={handleGoogleCameraMove}
          onMapClick={handleGoogleMapClick}
          onMarkerClick={handleGoogleMarkerClick}
          polylines={routeShapePolylines}
          properties={{
            isBuildingEnabled: false,
            isIndoorEnabled: false,
            isMyLocationEnabled: isNativeLocationEnabled,
            isTrafficEnabled: false,
            mapStyleOptions: {
              json: JSON.stringify([
                { featureType: "poi", stylers: [{ visibility: "off" }] },
                {
                  featureType: "transit.station",
                  stylers: [{ visibility: "off" }],
                },
              ]),
            },
            mapType: GoogleMaps.MapType.NORMAL,
            minZoomPreference:
              isMapLimitedToTorino && routeShapePolylines.length === 0
                ? 12
                : undefined,
            selectionEnabled: false,
          }}
          style={{ flex: 1 }}
          uiSettings={{
            compassEnabled: false,
            indoorLevelPickerEnabled: false,
            mapToolbarEnabled: false,
            myLocationButtonEnabled: isNativeLocationEnabled,
            rotationGesturesEnabled: false,
            scaleBarEnabled: false,
            tiltGesturesEnabled: false,
            togglePitchEnabled: false,
            zoomControlsEnabled: false,
          }}
        />
        {mapOverlay}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-muted-foreground text-center font-sans text-base">
        {t("home.map.unavailable")}
      </Text>
    </View>
  );
}

function NearbyStopsZoomWarning({
  isVisible,
  message,
}: {
  isVisible: boolean;
  message: string;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <View className="absolute top-32 right-4 left-4" pointerEvents="none">
      <Text className="text-foreground text-center font-sans text-sm font-medium">
        {message}
      </Text>
    </View>
  );
}

function getInitialCameraPosition({
  screenHeight,
  visibleLocation,
}: {
  screenHeight: number;
  visibleLocation: Coordinates | null;
}): CameraPosition & { coordinates: Coordinates; zoom: number } {
  if (!visibleLocation || !hasValidCoordinates(visibleLocation)) {
    return {
      coordinates: torinoCenter,
      zoom: NEARBY_STOPS_DEFAULT_ZOOM,
    };
  }

  return {
    coordinates: getCameraCenterForMarkerScreenPosition(visibleLocation, {
      screenHeight,
      screenY: INITIAL_LOCATION_SCREEN_Y,
      zoom: INITIAL_LOCATION_ZOOM,
    }),
    zoom: INITIAL_LOCATION_ZOOM,
  };
}

function clearPendingMapDeselect(
  pendingMapDeselectTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>,
) {
  const pendingMapDeselectTimeout = pendingMapDeselectTimeoutRef.current;

  if (!pendingMapDeselectTimeout) {
    return;
  }

  clearTimeout(pendingMapDeselectTimeout);
  pendingMapDeselectTimeoutRef.current = null;
}

function restorePreviousCameraPosition(
  mapRef: MapCameraRef | null,
  options: {
    animationDuration?: number;
    currentCameraPositionRef: MutableRefObject<CameraPosition>;
    onStopSelectionChange?: (stop: SelectedStop | null) => void;
    previousCameraPositionRef: MutableRefObject<CameraPosition | null>;
    screenHeight: number;
    screenWidth: number;
    selectedStopCameraPositionRef: MutableRefObject<CameraPosition | null>;
    selectedStopMarkerIdRef: MutableRefObject<string | null>;
    setViewport: (viewport: NearbyStopsQueryViewport) => void;
    viewportRef: MutableRefObject<NearbyStopsQueryViewport>;
  },
) {
  const previousCameraPosition = options.previousCameraPositionRef.current;

  if (!previousCameraPosition) {
    return;
  }

  mapRef?.setCameraPosition({
    ...previousCameraPosition,
    duration: options.animationDuration,
  });
  options.currentCameraPositionRef.current = previousCameraPosition;
  options.previousCameraPositionRef.current = null;
  options.selectedStopCameraPositionRef.current = null;
  options.selectedStopMarkerIdRef.current = null;
  options.onStopSelectionChange?.(null);

  if (
    hasValidCoordinates(previousCameraPosition.coordinates) &&
    previousCameraPosition.zoom !== undefined
  ) {
    updateNearbyStopsViewport(
      {
        coordinates: previousCameraPosition.coordinates,
        zoom: previousCameraPosition.zoom,
      },
      {
        screenHeight: options.screenHeight,
        screenWidth: options.screenWidth,
        setViewport: options.setViewport,
        viewportRef: options.viewportRef,
      },
    );
  }
}

function getCameraAnimationDuration() {
  if (Platform.OS !== "android") {
    return undefined;
  }

  return SELECTED_STOP_CAMERA_ANIMATION_DURATION_MS;
}

function keepCameraInTorino(
  event: CameraMoveEvent,
  mapRef: MapCameraRef | null,
) {
  if (isInsideTorino(event.coordinates)) {
    return;
  }

  mapRef?.setCameraPosition({
    coordinates: clampToTorino(event.coordinates),
    zoom: Math.max(event.zoom, 12),
  });
}

function updateNearbyStopsViewport(
  camera: Pick<
    CameraMoveEvent,
    "coordinates" | "latitudeDelta" | "longitudeDelta" | "zoom"
  >,
  options: {
    screenHeight: number;
    screenWidth: number;
    setViewport: (viewport: NearbyStopsQueryViewport) => void;
    viewportRef: MutableRefObject<NearbyStopsQueryViewport>;
  },
) {
  if (!hasValidCoordinates(camera.coordinates)) {
    return;
  }

  const nextViewport = createNearbyStopsViewport({
    ...camera,
    screenHeight: options.screenHeight,
    screenWidth: options.screenWidth,
  });
  const previousViewport = options.viewportRef.current;
  const previousCenter = previousViewport.coordinates;
  const radiusRatio =
    Math.max(nextViewport.radiusMeters, previousViewport.radiusMeters) /
    Math.min(nextViewport.radiusMeters, previousViewport.radiusMeters);
  const centerMoveThresholdMeters = Math.max(
    NEARBY_STOPS_CAMERA_MOVE_THRESHOLD_METERS,
    previousViewport.radiusMeters * 0.2,
  );

  if (
    hasValidCoordinates(previousCenter) &&
    hasValidCoordinates(nextViewport.coordinates) &&
    getDistanceMeters(previousCenter, nextViewport.coordinates) <
      centerMoveThresholdMeters &&
    radiusRatio < 1.25
  ) {
    return;
  }

  options.viewportRef.current = nextViewport;
  options.setViewport(nextViewport);
}

function hasValidCoordinates(
  coordinates: Coordinates | undefined,
): coordinates is Coordinates & { latitude: number; longitude: number } {
  return (
    coordinates?.latitude !== undefined &&
    coordinates.longitude !== undefined &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude)
  );
}

function getDistanceMeters(
  from: Coordinates & { latitude: number; longitude: number },
  to: Coordinates & { latitude: number; longitude: number },
) {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getStopMarkerSnippet(
  routes: {
    shortName: string;
  }[],
) {
  if (routes.length === 0) {
    return undefined;
  }

  return routes.map((route) => route.shortName).join(", ");
}

function getVisibleStopMarkers(
  stopMarkers: StopMarker[],
  selectedStopMarker: StopMarker | null,
  options: {
    isShowingLineDetail: boolean;
    isTrackingVehicle: boolean;
    preserveSelectedStopOnLineDetail: boolean;
  },
) {
  if (options.isShowingLineDetail) {
    return options.preserveSelectedStopOnLineDetail && selectedStopMarker
      ? [selectedStopMarker]
      : [];
  }

  if (!selectedStopMarker) {
    return stopMarkers;
  }

  if (options.isTrackingVehicle) {
    return [selectedStopMarker];
  }

  if (stopMarkers.some((marker) => marker.id === selectedStopMarker.id)) {
    return stopMarkers;
  }

  return [selectedStopMarker, ...stopMarkers];
}

function getCameraCenterForMarkerScreenPosition(
  markerCoordinates: Coordinates & { latitude: number; longitude: number },
  options: {
    screenHeight: number;
    screenY: number;
    zoom: number;
  },
): Coordinates & { latitude: number; longitude: number } {
  const markerOffsetFromCenterPixels =
    (0.5 - options.screenY) * options.screenHeight;
  const latitudeOffsetDegrees = metersToLatitudeDegrees(
    markerOffsetFromCenterPixels *
      getMetersPerPixel(markerCoordinates.latitude, options.zoom),
  );

  return {
    latitude: markerCoordinates.latitude - latitudeOffsetDegrees,
    longitude: markerCoordinates.longitude,
  };
}

function getCameraPositionForRouteShapePolylines(
  polylines: {
    coordinates: Coordinates[];
  }[],
  options: {
    bottomCoverageRatio: number;
    paddingPixels: number;
    screenHeight: number;
    screenWidth: number;
    screenY: number;
  },
): (CameraPosition & { coordinates: Coordinates; zoom: number }) | null {
  const bounds = getRouteShapeBounds(polylines);

  if (!bounds || options.screenHeight <= 0 || options.screenWidth <= 0) {
    return null;
  }

  const routeCenter = {
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
  };
  const verticalSpanMeters = getDistanceMeters(
    { latitude: bounds.minLatitude, longitude: routeCenter.longitude },
    { latitude: bounds.maxLatitude, longitude: routeCenter.longitude },
  );
  const horizontalSpanMeters = getDistanceMeters(
    { latitude: routeCenter.latitude, longitude: bounds.minLongitude },
    { latitude: routeCenter.latitude, longitude: bounds.maxLongitude },
  );
  const visibleHeight =
    options.screenHeight * (1 - options.bottomCoverageRatio);
  const availableVerticalPixels = Math.max(
    1,
    visibleHeight - options.paddingPixels * 2,
  );
  const availableHorizontalPixels = Math.max(
    1,
    options.screenWidth - options.paddingPixels * 2,
  );
  const requiredMetersPerPixel = Math.max(
    verticalSpanMeters / availableVerticalPixels,
    horizontalSpanMeters / availableHorizontalPixels,
    1,
  );
  const zoom = clampZoom(
    Math.log2(
      (Math.cos(toRadians(routeCenter.latitude)) *
        WEB_MERCATOR_METERS_PER_PIXEL_AT_EQUATOR) /
        requiredMetersPerPixel,
    ),
  );

  return {
    coordinates: getCameraCenterForMarkerScreenPosition(routeCenter, {
      screenHeight: options.screenHeight,
      screenY: options.screenY,
      zoom,
    }),
    zoom,
  };
}

function getCameraPositionForStops(
  stops: NearbyStop[],
  options: {
    screenHeight: number;
    screenY: number;
    screenWidth: number;
  },
): (CameraPosition & { coordinates: Coordinates; zoom: number }) | null {
  const coordinates = stops
    .map((stop) => ({ latitude: stop.lat, longitude: stop.lon }))
    .filter(hasValidCoordinates);

  return getCameraPositionForCoordinates(coordinates, {
    paddingPixels: CLUSTER_FOCUS_CAMERA_PADDING_PX,
    screenHeight: options.screenHeight,
    screenY: options.screenY,
    screenWidth: options.screenWidth,
  });
}

function getCameraPositionForCoordinates(
  coordinates: (Coordinates & { latitude: number; longitude: number })[],
  options: {
    paddingPixels: number;
    screenHeight: number;
    screenY: number;
    screenWidth: number;
  },
): (CameraPosition & { coordinates: Coordinates; zoom: number }) | null {
  const bounds = getCoordinateBounds(coordinates);

  if (!bounds || options.screenHeight <= 0 || options.screenWidth <= 0) {
    return null;
  }

  const center = {
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
  };
  const verticalSpanMeters = getDistanceMeters(
    { latitude: bounds.minLatitude, longitude: center.longitude },
    { latitude: bounds.maxLatitude, longitude: center.longitude },
  );
  const horizontalSpanMeters = getDistanceMeters(
    { latitude: center.latitude, longitude: bounds.minLongitude },
    { latitude: center.latitude, longitude: bounds.maxLongitude },
  );
  const anchorVerticalRatio = Math.min(options.screenY, 1 - options.screenY);
  const availableVerticalPixels = Math.max(
    1,
    options.screenHeight * anchorVerticalRatio * 2 - options.paddingPixels * 2,
  );
  const availableHorizontalPixels = Math.max(
    1,
    options.screenWidth - options.paddingPixels * 2,
  );
  const requiredMetersPerPixel = Math.max(
    verticalSpanMeters / availableVerticalPixels,
    horizontalSpanMeters / availableHorizontalPixels,
    1,
  );
  const zoom = clampZoom(
    Math.log2(
      (Math.cos(toRadians(center.latitude)) *
        WEB_MERCATOR_METERS_PER_PIXEL_AT_EQUATOR) /
        requiredMetersPerPixel,
    ),
  );

  return {
    coordinates: getCameraCenterForMarkerScreenPosition(center, {
      screenHeight: options.screenHeight,
      screenY: options.screenY,
      zoom,
    }),
    zoom,
  };
}

function getRouteShapeBounds(
  polylines: {
    coordinates: Coordinates[];
  }[],
) {
  return getCoordinateBounds(
    polylines.flatMap((polyline) =>
      polyline.coordinates.filter(hasValidCoordinates),
    ),
  );
}

function getCoordinateBounds(
  coordinatesList: (Coordinates & { latitude: number; longitude: number })[],
) {
  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;

  for (const coordinates of coordinatesList) {
    minLatitude = Math.min(minLatitude, coordinates.latitude);
    maxLatitude = Math.max(maxLatitude, coordinates.latitude);
    minLongitude = Math.min(minLongitude, coordinates.longitude);
    maxLongitude = Math.max(maxLongitude, coordinates.longitude);
  }

  if (
    !Number.isFinite(minLatitude) ||
    !Number.isFinite(maxLatitude) ||
    !Number.isFinite(minLongitude) ||
    !Number.isFinite(maxLongitude)
  ) {
    return null;
  }

  return {
    maxLatitude,
    maxLongitude,
    minLatitude,
    minLongitude,
  };
}

function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) {
    return NEARBY_STOPS_DEFAULT_ZOOM;
  }

  return Math.min(Math.max(zoom, 3), SELECTED_STOP_MARKER_ZOOM);
}

function metersToLatitudeDegrees(meters: number) {
  return (meters / EARTH_RADIUS_METERS) * (180 / Math.PI);
}

function createNearbyStopsViewport(
  camera: Pick<
    CameraMoveEvent,
    "coordinates" | "latitudeDelta" | "longitudeDelta" | "zoom"
  > & {
    screenHeight: number;
    screenWidth: number;
  },
): NearbyStopsQueryViewport {
  return {
    coordinates: getNearbyStopsViewportCenter(camera),
    radiusMeters: getNearbyStopsRadiusMeters(camera),
    zoom: camera.zoom,
  };
}

function getNearbyStopsViewportCenter(
  camera: Pick<CameraMoveEvent, "coordinates" | "zoom"> & {
    screenHeight: number;
  },
): Coordinates {
  if (!hasValidCoordinates(camera.coordinates)) {
    return camera.coordinates;
  }

  const latitudeOffsetDegrees = metersToLatitudeDegrees(
    getNearbyStopsCenterOffsetPixels(camera.screenHeight) *
      getMetersPerPixel(camera.coordinates.latitude, camera.zoom),
  );

  return {
    latitude: camera.coordinates.latitude + latitudeOffsetDegrees,
    longitude: camera.coordinates.longitude,
  };
}

function getNearbyStopsRadiusMeters(
  camera: Pick<
    CameraMoveEvent,
    "coordinates" | "latitudeDelta" | "longitudeDelta" | "zoom"
  > & {
    screenHeight: number;
    screenWidth: number;
  },
) {
  if (
    hasValidCoordinates(camera.coordinates) &&
    camera.latitudeDelta !== undefined &&
    camera.longitudeDelta !== undefined &&
    camera.latitudeDelta > 0 &&
    camera.longitudeDelta > 0
  ) {
    const center = getNearbyStopsViewportCenter(camera);

    if (!hasValidCoordinates(center)) {
      return getFallbackNearbyStopsRadiusMeters(camera);
    }

    const corners = [
      {
        latitude: camera.coordinates.latitude + camera.latitudeDelta / 2,
        longitude: camera.coordinates.longitude - camera.longitudeDelta / 2,
      },
      {
        latitude: camera.coordinates.latitude + camera.latitudeDelta / 2,
        longitude: camera.coordinates.longitude + camera.longitudeDelta / 2,
      },
      {
        latitude: camera.coordinates.latitude - camera.latitudeDelta / 2,
        longitude: camera.coordinates.longitude - camera.longitudeDelta / 2,
      },
      {
        latitude: camera.coordinates.latitude - camera.latitudeDelta / 2,
        longitude: camera.coordinates.longitude + camera.longitudeDelta / 2,
      },
    ];

    return clampRadius(
      Math.ceil(
        Math.max(...corners.map((corner) => getDistanceMeters(center, corner))),
      ),
    );
  }

  return getFallbackNearbyStopsRadiusMeters(camera);
}

function getFallbackNearbyStopsRadiusMeters(
  camera: Pick<CameraMoveEvent, "coordinates" | "zoom"> & {
    screenHeight: number;
    screenWidth: number;
  },
) {
  const latitude = camera.coordinates.latitude ?? torinoCenter.latitude;
  const screenDistancePixels = Math.hypot(
    Math.max(1, camera.screenWidth) / 2,
    Math.max(
      getNearbyStopsCenterYPixels(camera.screenHeight),
      Math.max(1, camera.screenHeight) -
        getNearbyStopsCenterYPixels(camera.screenHeight),
    ),
  );

  return clampRadius(
    Math.ceil(getMetersPerPixel(latitude, camera.zoom) * screenDistancePixels),
  );
}

function getNearbyStopsCenterYPixels(screenHeight: number) {
  return Math.max(1, screenHeight) * NEARBY_STOPS_SCREEN_Y;
}

function getNearbyStopsCenterOffsetPixels(screenHeight: number) {
  return (0.5 - NEARBY_STOPS_SCREEN_Y) * Math.max(1, screenHeight);
}

function clampRadius(radiusMeters: number) {
  return Math.min(
    Math.max(radiusMeters, NEARBY_STOPS_MIN_RADIUS_METERS),
    NEARBY_STOPS_MAX_RADIUS_METERS,
  );
}

function getNearbyStopsLimit(radiusMeters: number) {
  if (radiusMeters <= 1_000) {
    return 60;
  }

  return NEARBY_STOPS_MAX_LIMIT;
}

function getNearbyStopsForViewport(
  stops: CachedStop[],
  options: {
    limit: number;
    viewport: NearbyStopsQueryViewport;
  },
): NearbyStop[] {
  if (!hasValidCoordinates(options.viewport.coordinates)) {
    return [];
  }

  const viewportCenter = options.viewport.coordinates;

  return stops
    .flatMap((stop) => {
      if (!hasValidCoordinates({ latitude: stop.lat, longitude: stop.lon })) {
        return [];
      }

      const distanceMeters = Math.round(
        getDistanceMeters(viewportCenter, {
          latitude: stop.lat,
          longitude: stop.lon,
        }),
      );

      if (distanceMeters > options.viewport.radiusMeters) {
        return [];
      }

      return [{ ...stop, distanceMeters }];
    })
    .sort(
      (left, right) =>
        left.distanceMeters - right.distanceMeters ||
        left.stopName.localeCompare(right.stopName) ||
        left.stopId.localeCompare(right.stopId),
    )
    .slice(0, options.limit);
}

function createStopMarkers(
  stops: NearbyStop[],
  viewport: NearbyStopsQueryViewport,
  options: {
    getClusterTitle: (count: number) => string;
  },
): StopMarker[] {
  const validStops = stops.filter((stop) =>
    hasValidCoordinates({ latitude: stop.lat, longitude: stop.lon }),
  );

  if (
    viewport.zoom >= 17.25 ||
    viewport.radiusMeters <= MIN_RADIUS_METERS_FOR_CLUSTERING ||
    validStops.length < MIN_STOPS_FOR_CLUSTERING
  ) {
    return validStops.map(createSingleStopMarker);
  }

  const clusters: {
    latitudeTotal: number;
    longitudeTotal: number;
    stops: NearbyStop[];
  }[] = [];

  for (const stop of validStops) {
    const coordinates = {
      latitude: stop.lat,
      longitude: stop.lon,
    };
    const matchingCluster = clusters.find((cluster) => {
      const clusterCoordinates = getClusterCoordinates(cluster);
      const thresholdMeters = getClusterThresholdMeters(
        clusterCoordinates.latitude,
        viewport.zoom,
      );

      return (
        getDistanceMeters(clusterCoordinates, coordinates) <= thresholdMeters
      );
    });

    if (matchingCluster) {
      matchingCluster.latitudeTotal += stop.lat;
      matchingCluster.longitudeTotal += stop.lon;
      matchingCluster.stops.push(stop);
      continue;
    }

    clusters.push({
      latitudeTotal: stop.lat,
      longitudeTotal: stop.lon,
      stops: [stop],
    });
  }

  return clusters.flatMap((cluster) => {
    if (cluster.stops.length < MIN_CLUSTER_STOP_COUNT) {
      return cluster.stops.map(createSingleStopMarker);
    }

    const coordinates = getClusterCoordinates(cluster);

    return [
      {
        coordinates,
        count: cluster.stops.length,
        id: `cluster:${coordinates.latitude.toFixed(5)}:${coordinates.longitude.toFixed(5)}:${cluster.stops.length}`,
        routes: [],
        stopCode: null,
        stopDesc: null,
        stopId: null,
        stops: cluster.stops,
        title: options.getClusterTitle(cluster.stops.length),
      },
    ];
  });
}

function createSingleStopMarker(stop: NearbyStop): StopMarker {
  return {
    coordinates: {
      latitude: stop.lat,
      longitude: stop.lon,
    },
    count: 1,
    id: stop.stopId,
    routes: stop.routes,
    stopCode: stop.stopCode,
    stopDesc: stop.stopDesc,
    stopId: stop.stopId,
    stops: [stop],
    title: stop.stopName,
  };
}

function createStopMarkerFromSelectedStop(stop: SelectedStop): StopMarker {
  return {
    coordinates: stop.coordinates,
    count: 1,
    id: stop.stopId,
    routes: stop.routes,
    stopCode: stop.stopCode,
    stopDesc: stop.stopDesc,
    stopId: stop.stopId,
    stops: [],
    title: stop.stopName,
  };
}

function getClusterCoordinates(cluster: {
  latitudeTotal: number;
  longitudeTotal: number;
  stops: NearbyStop[];
}): Coordinates & { latitude: number; longitude: number } {
  return {
    latitude: cluster.latitudeTotal / cluster.stops.length,
    longitude: cluster.longitudeTotal / cluster.stops.length,
  };
}

function getClusterThresholdMeters(latitude: number, zoom: number) {
  return Math.min(
    Math.max(getMetersPerPixel(latitude, zoom) * CLUSTER_SCREEN_RADIUS_PX, 30),
    1_500,
  );
}

function getMetersPerPixel(latitude: number, zoom: number) {
  return (
    (Math.cos(toRadians(latitude)) * WEB_MERCATOR_METERS_PER_PIXEL_AT_EQUATOR) /
    2 ** zoom
  );
}

function createClusterMarkerDataUri(count: number) {
  const text = String(count);
  const fontSize = text.length <= 2 ? 18 : text.length === 3 ? 15 : 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CLUSTER_MARKER_SIZE}" height="${CLUSTER_MARKER_SIZE}" viewBox="0 0 ${CLUSTER_MARKER_SIZE} ${CLUSTER_MARKER_SIZE}"><circle cx="22" cy="22" r="20" fill="${CLUSTER_MARKER_COLOR}"/><circle cx="22" cy="22" r="20" fill="none" stroke="${CLUSTER_MARKER_TEXT_COLOR}" stroke-width="3"/><text x="22" y="22" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${CLUSTER_MARKER_TEXT_COLOR}">${text}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getTrackedVehicleMarkerId(vehicle: TrackedTransitVehicle) {
  return `vehicle:${vehicle.id}`;
}

function getRouteVehicleMarkerId(vehicle: TrackedTransitVehicle) {
  return `route-vehicle:${vehicle.id}`;
}

function getRouteVehicleIdFromMarkerId(markerId: string | undefined) {
  const prefix = "route-vehicle:";

  return markerId?.startsWith(prefix) ? markerId.slice(prefix.length) : null;
}

function getTrackedVehicleIconKey(vehicle: TrackedTransitVehicle) {
  return `${vehicle.routeType}:${normalizeMapRouteColor(vehicle.color)}`;
}

function getAppleVehicleSystemImage(
  routeType: TrackedTransitVehicle["routeType"],
) {
  if (routeType === "bus") {
    return "bus.fill";
  }

  if (routeType === "tram") {
    return "tram.fill";
  }

  if (routeType === "metro" || routeType === "rail") {
    return "train.side.front.car";
  }

  return "questionmark.circle.fill";
}

function getVehicleMarkerLabel(routeType: TrackedTransitVehicle["routeType"]) {
  if (routeType === "bus") {
    return "B";
  }

  if (routeType === "tram") {
    return "T";
  }

  if (routeType === "metro") {
    return "M";
  }

  if (routeType === "rail") {
    return "R";
  }

  return "?";
}

function createTransitVehicleMarkerDataUri(vehicle: TrackedTransitVehicle) {
  const color = normalizeMapRouteColor(vehicle.color);
  const label = getVehicleMarkerLabel(vehicle.routeType);
  const center = VEHICLE_MARKER_SIZE / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${VEHICLE_MARKER_SIZE}" height="${VEHICLE_MARKER_SIZE}" viewBox="0 0 ${VEHICLE_MARKER_SIZE} ${VEHICLE_MARKER_SIZE}"><circle cx="${center}" cy="${center}" r="20" fill="${color}"/><circle cx="${center}" cy="${center}" r="20" fill="none" stroke="${VEHICLE_MARKER_TEXT_COLOR}" stroke-width="3"/><text x="${center}" y="${center}" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${VEHICLE_MARKER_TEXT_COLOR}">${label}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeMapRouteColor(color: string | null) {
  if (!color || !/^[0-9a-f]{6}$/i.test(color)) {
    return VEHICLE_MARKER_DEFAULT_COLOR;
  }

  return `#${color}`;
}
