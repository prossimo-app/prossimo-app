import type { SkFont, SkTypeface } from "@shopify/react-native-skia";
import type { ImageRef } from "expo-image";
import type { CameraPosition, Coordinates } from "expo-maps";
import type { MutableRefObject, Ref } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PixelRatio,
  Platform,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import {
  FontStyle,
  ImageFormat,
  PaintStyle,
  Skia,
} from "@shopify/react-native-skia";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { AppleMaps, GoogleMaps } from "expo-maps";
import { skipToken, useQuery } from "@tanstack/react-query";

import { useTranslation } from "@prossimo-app/localization";

import type {
  RouteVehiclesPayload,
  SelectedTransitLine,
  TrackedTransitVehicle,
} from "~/components/home-bottom-drawer/types";
import type { RouterOutputs } from "~/utils/api";
import { useAppBootstrap } from "~/app-bootstrap/app-bootstrap-provider";
import { isWithinTorinoServiceArea, torinoCenter } from "~/map/torino-bounds";
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
const STOP_LABEL_MIN_ZOOM = 14.5;
const STOP_LABEL_MARKER_WIDTH = 168;
const STOP_LABEL_MARKER_HEIGHT = 64;
const STOP_LABEL_PIN_CENTER_Y = 22;
const STOP_LABEL_BASELINE_Y = CLUSTER_MARKER_SIZE + 14;
const STOP_LABEL_MAX_CHARS = 24;
const STOP_LABEL_TEXT_COLOR = "#111827";
const STOP_LABEL_HALO_COLOR = "#ffffff";
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
  setCameraPosition: (
    config: CameraPosition & { duration?: number },
  ) => Promise<void> | void;
}

interface NearbyStopsQueryViewport {
  coordinates: Coordinates;
  radiusMeters: number;
  zoom: number;
}

interface StopMarkerIconRequest {
  count: number;
  key: string;
  label: string | null;
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
  const colorScheme = useColorScheme();
  const { appBootstrap } = useAppBootstrap();
  const {
    isLocationSharingEnabled,
    locationPermission,
    refreshLocationPermission,
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
  const [stopMarkerIconsByKey, setStopMarkerIconsByKey] = useState(
    () => new Map<string, ImageRef>(),
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
    isLocationSharingEnabled && location ? location : null;
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
        coordinates,
        duration: getCameraAnimationDuration(),
        zoom,
      };

      animateCamera(mapRef, cameraPosition);
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
        animateCamera(mapRef, {
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

      animateCamera(mapRef, {
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
  }, [selectedLine, selectedStop, trackedVehicle, windowHeight, windowWidth]);

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
      coordinates,
      duration: getCameraAnimationDuration(),
      zoom: SELECTED_STOP_MARKER_ZOOM,
    };

    animateCamera(mapRef, cameraPosition);
    currentCameraPositionRef.current = cameraPosition;
    selectedStopCameraPositionRef.current = cameraPosition;
    updateNearbyStopsViewport(cameraPosition, {
      screenHeight: windowHeight,
      screenWidth: windowWidth,
      setViewport: setNearbyStopsViewport,
      viewportRef: nearbyStopsViewportRef,
    });
  }, [selectedLine, selectedStop, windowHeight, windowWidth]);

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
          (!trackedVehicle?.tripId || vehicle.tripId !== trackedVehicle.tripId) &&
          isWithinTorinoServiceArea(vehicle.lat, vehicle.lon),
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

    animateCamera(mapRef, cameraPosition);
    currentCameraPositionRef.current = cameraPosition;
    updateNearbyStopsViewport(routeCameraPosition, {
      screenHeight: windowHeight,
      screenWidth: windowWidth,
      setViewport: setNearbyStopsViewport,
      viewportRef: nearbyStopsViewportRef,
    });
  }, [routeShapePolylines, trackedVehicle, windowHeight, windowWidth]);
  const showStopLabels = nearbyStopsViewport.zoom >= STOP_LABEL_MIN_ZOOM;
  const stopMarkerIconRequests = useMemo<StopMarkerIconRequest[]>(() => {
    if (Platform.OS !== "android") {
      return [];
    }

    const requestsByKey = new Map<string, StopMarkerIconRequest>();

    for (const marker of visibleStopMarkers) {
      const { key, label } = getStopMarkerIconInfo(marker, showStopLabels);

      if (requestsByKey.has(key)) {
        continue;
      }

      requestsByKey.set(key, { count: marker.count, key, label });
    }

    return Array.from(requestsByKey.values());
  }, [showStopLabels, visibleStopMarkers]);
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
    // Only render a marker once its Skia icon has loaded. Rendering with an
    // undefined icon makes Google fall back to its default red pin, which would
    // flash before the real icon appears after a camera move.
    const markers: GoogleMaps.Marker[] = visibleStopMarkers.flatMap((marker) => {
      const { key, label } = getStopMarkerIconInfo(marker, showStopLabels);
      const icon = stopMarkerIconsByKey.get(key);

      if (!icon) {
        return [];
      }

      const hasLabel = label !== null;

      return [
        {
          anchor: hasLabel
            ? { x: 0.5, y: STOP_LABEL_PIN_CENTER_Y / STOP_LABEL_MARKER_HEIGHT }
            : { x: 0.5, y: 0.5 },
          coordinates: {
            latitude: marker.coordinates.latitude,
            longitude: marker.coordinates.longitude,
          },
          icon,
          id: marker.id,
          showCallout: true,
          snippet:
            marker.count > 1
              ? t("home.map.clusterTitle", { count: marker.count })
              : getStopMarkerSnippet(marker.routes),
          title: marker.title,
          zIndex: marker.count > 1 ? 2 : 1,
        },
      ];
    });

    for (const routeVehicle of routeVehicleMarkers) {
      const icon = vehicleIconsByKey.get(getTrackedVehicleIconKey(routeVehicle));

      if (!icon) {
        continue;
      }

      markers.push({
        anchor: { x: 0.5, y: 0.5 },
        coordinates: routeVehicle.coordinates,
        icon,
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
      const icon = vehicleIconsByKey.get(getTrackedVehicleIconKey(trackedVehicle));

      if (icon) {
        markers.push({
          anchor: { x: 0.5, y: 0.5 },
          coordinates: trackedVehicle.coordinates,
          icon,
          id: getTrackedVehicleMarkerId(trackedVehicle),
          showCallout: true,
          snippet: undefined,
          title: t("home.drawer.arrivals.line", {
            line: trackedVehicle.routeLabel,
          }),
          zIndex: 4,
        });
      }
    }

    return markers;
  }, [
    routeVehicleMarkers,
    showStopLabels,
    stopMarkerIconsByKey,
    t,
    trackedVehicle,
    vehicleIconsByKey,
    visibleStopMarkers,
  ]);
  const handleCameraMove = useCallback(
    (event: CameraMoveEvent) => {
      currentCameraPositionRef.current = {
        coordinates: event.coordinates,
        zoom: event.zoom,
      };

      updateNearbyStopsViewport(event, {
        screenHeight: windowHeight,
        screenWidth: windowWidth,
        setViewport: setNearbyStopsViewport,
        viewportRef: nearbyStopsViewportRef,
      });
    },
    [windowHeight, windowWidth],
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

        animateCamera(mapRef, {
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
        coordinates,
        duration: getCameraAnimationDuration(),
        zoom: SELECTED_STOP_MARKER_ZOOM,
      };

      animateCamera(mapRef, cameraPosition);
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
    if (stopMarkerIconRequests.length === 0) {
      return;
    }

    const missingRequests = stopMarkerIconRequests.filter(
      (request) => !stopMarkerIconsByKey.has(request.key),
    );

    if (missingRequests.length === 0) {
      return;
    }

    let isMounted = true;

    async function loadStopMarkerIcons() {
      // Rasterize each marker to a PNG with Skia, then hand the bitmap to
      // expo-image. expo-maps converts the icon Drawable with `toBitmap()`,
      // which requires a real raster bitmap — an SVG decodes to a vector
      // PictureDrawable (intrinsic size -1) and silently fails to render.
      // Use allSettled so one failure doesn't drop the whole batch; failed
      // keys simply retry on the next render that still needs them.
      const results = await Promise.allSettled(
        missingRequests.map(async (request) => {
          const image = createStopMarkerImage({
            count: request.count,
            label: request.label,
          });

          if (!image) {
            throw new Error("Skia surface unavailable");
          }

          return {
            icon: await Image.loadAsync(
              {
                height: image.height,
                uri: image.uri,
                width: image.width,
              },
              {
                maxHeight: image.height,
                maxWidth: image.width,
              },
            ),
            key: request.key,
          };
        }),
      );

      if (!isMounted) {
        return;
      }

      const icons = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );

      if (icons.length === 0) {
        return;
      }

      setStopMarkerIconsByKey((currentIcons) => {
        const nextIcons = new Map(currentIcons);

        for (const { icon, key } of icons) {
          nextIcons.set(key, icon);
        }

        return nextIcons;
      });
    }

    void loadStopMarkerIcons();

    return () => {
      isMounted = false;
    };
  }, [stopMarkerIconRequests, stopMarkerIconsByKey]);

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
      // Rasterize with Skia so expo-maps receives a real bitmap (see the stop
      // marker effect for why an SVG icon silently fails to render). Use
      // allSettled so one failure doesn't drop the whole batch; failed keys
      // simply retry on the next render that still needs them.
      const results = await Promise.allSettled(
        missingVehicles.map(async (vehicle) => {
          const image = createVehicleMarkerImage(vehicle);

          if (!image) {
            throw new Error("Skia surface unavailable");
          }

          return {
            icon: await Image.loadAsync(
              {
                height: image.height,
                uri: image.uri,
                width: image.width,
              },
              {
                maxHeight: image.height,
                maxWidth: image.width,
              },
            ),
            key: getTrackedVehicleIconKey(vehicle),
          };
        }),
      );

      if (!isMounted) {
        return;
      }

      const icons = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );

      if (icons.length === 0) {
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
    locationPermission,
    refreshLocationPermission,
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
          onCameraMove={handleCameraMove}
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
          colorScheme={
            colorScheme === "dark"
              ? GoogleMaps.MapColorScheme.DARK
              : GoogleMaps.MapColorScheme.LIGHT
          }
          markers={googleMarkers}
          onCameraMove={handleCameraMove}
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

  animateCamera(mapRef, {
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

function animateCamera(
  mapRef: MapCameraRef | null,
  config: CameraPosition & { duration?: number },
) {
  // On Android `setCameraPosition` returns a promise that rejects with a
  // CancellationException whenever the in-flight animation is superseded by a
  // newer one, interrupted by a gesture, or cancelled on unmount. These
  // interruptions are expected, so swallow the rejection instead of letting it
  // surface as an uncaught promise rejection.
  void Promise.resolve(mapRef?.setCameraPosition(config)).catch(() => {
    // Ignore cancelled camera animations.
  });
}

function getCameraAnimationDuration() {
  if (Platform.OS !== "android") {
    return undefined;
  }

  return SELECTED_STOP_CAMERA_ANIMATION_DURATION_MS;
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

function getStopMarkerIconInfo(
  marker: StopMarker,
  showStopLabels: boolean,
): { key: string; label: string | null } {
  if (marker.count > 1) {
    return { key: `cluster:${marker.count}`, label: null };
  }

  if (!showStopLabels) {
    return { key: "stop", label: null };
  }

  const label = truncateStopLabel(marker.title);

  if (!label) {
    return { key: "stop", label: null };
  }

  return { key: `stop:${label}`, label };
}

interface MarkerImage {
  height: number;
  uri: string;
  width: number;
}

// Cache the system typeface lookup. If it fails, `getMarkerFont` falls back to
// Skia's default font.
let markerTypeface: SkTypeface | null = null;
let isMarkerTypefaceResolved = false;

function getMarkerTypeface(): SkTypeface | null {
  if (!isMarkerTypefaceResolved) {
    isMarkerTypefaceResolved = true;
    markerTypeface = Skia.FontMgr.System().matchFamilyStyle(
      "sans-serif",
      FontStyle.Bold,
    );
  }

  return markerTypeface;
}

function getMarkerFont(size: number): SkFont {
  return Skia.Font(getMarkerTypeface() ?? undefined, size);
}

function getCenteredTextX(font: SkFont, text: string, centerX: number) {
  return centerX - font.getTextWidth(text) / 2;
}

function createStopMarkerImage({
  count,
  label,
}: {
  count: number;
  label: string | null;
}): MarkerImage | null {
  const isCluster = count > 1;
  const hasLabel = label !== null && label.length > 0;
  const logicalWidth = hasLabel ? STOP_LABEL_MARKER_WIDTH : CLUSTER_MARKER_SIZE;
  const logicalHeight = hasLabel
    ? STOP_LABEL_MARKER_HEIGHT
    : CLUSTER_MARKER_SIZE;
  const scale = Math.min(Math.max(PixelRatio.get(), 1), 3);
  const pixelWidth = Math.ceil(logicalWidth * scale);
  const pixelHeight = Math.ceil(logicalHeight * scale);
  const surface = Skia.Surface.Make(pixelWidth, pixelHeight);

  if (!surface) {
    return null;
  }

  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);

  const cx = logicalWidth / 2;
  const cy = STOP_LABEL_PIN_CENTER_Y;

  const fillPaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  fillPaint.setColor(
    Skia.Color(isCluster ? CLUSTER_MARKER_COLOR : STOP_MARKER_COLOR),
  );
  canvas.drawCircle(cx, cy, 20, fillPaint);

  const ringPaint = Skia.Paint();
  ringPaint.setAntiAlias(true);
  ringPaint.setStyle(PaintStyle.Stroke);
  ringPaint.setStrokeWidth(3);
  ringPaint.setColor(Skia.Color(CLUSTER_MARKER_TEXT_COLOR));
  canvas.drawCircle(cx, cy, 20, ringPaint);

  if (isCluster) {
    const text = String(count);
    const fontSize = text.length <= 2 ? 18 : text.length === 3 ? 15 : 12;
    const font = getMarkerFont(fontSize);
    const metrics = font.getMetrics();
    const textPaint = Skia.Paint();
    textPaint.setAntiAlias(true);
    textPaint.setColor(Skia.Color(CLUSTER_MARKER_TEXT_COLOR));
    canvas.drawText(
      text,
      getCenteredTextX(font, text, cx),
      cy - (metrics.ascent + metrics.descent) / 2,
      textPaint,
      font,
    );
  } else {
    const dotPaint = Skia.Paint();
    dotPaint.setAntiAlias(true);
    dotPaint.setColor(Skia.Color(CLUSTER_MARKER_TEXT_COLOR));
    canvas.drawCircle(cx, cy, 6, dotPaint);
  }

  if (hasLabel) {
    const font = getMarkerFont(13);
    const x = getCenteredTextX(font, label, cx);
    // Draw the label twice: a thick white stroke underneath acts as a halo so
    // the text stays legible over any map tile, with the fill drawn on top.
    const haloPaint = Skia.Paint();
    haloPaint.setAntiAlias(true);
    haloPaint.setStyle(PaintStyle.Stroke);
    haloPaint.setStrokeWidth(3);
    haloPaint.setColor(Skia.Color(STOP_LABEL_HALO_COLOR));
    canvas.drawText(label, x, STOP_LABEL_BASELINE_Y, haloPaint, font);

    const labelPaint = Skia.Paint();
    labelPaint.setAntiAlias(true);
    labelPaint.setColor(Skia.Color(STOP_LABEL_TEXT_COLOR));
    canvas.drawText(label, x, STOP_LABEL_BASELINE_Y, labelPaint, font);
  }

  return {
    height: pixelHeight,
    uri: `data:image/png;base64,${surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100)}`,
    width: pixelWidth,
  };
}

function truncateStopLabel(value: string) {
  const trimmed = value.trim();

  if (trimmed.length <= STOP_LABEL_MAX_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, STOP_LABEL_MAX_CHARS - 1).trimEnd()}…`;
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

function createVehicleMarkerImage(
  vehicle: TrackedTransitVehicle,
): MarkerImage | null {
  const color = normalizeMapRouteColor(vehicle.color);
  const label = getVehicleMarkerLabel(vehicle.routeType);
  const scale = Math.min(Math.max(PixelRatio.get(), 1), 3);
  const pixelSize = Math.ceil(VEHICLE_MARKER_SIZE * scale);
  const surface = Skia.Surface.Make(pixelSize, pixelSize);

  if (!surface) {
    return null;
  }

  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);

  const center = VEHICLE_MARKER_SIZE / 2;

  const fillPaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  fillPaint.setColor(Skia.Color(color));
  canvas.drawCircle(center, center, 20, fillPaint);

  const ringPaint = Skia.Paint();
  ringPaint.setAntiAlias(true);
  ringPaint.setStyle(PaintStyle.Stroke);
  ringPaint.setStrokeWidth(3);
  ringPaint.setColor(Skia.Color(VEHICLE_MARKER_TEXT_COLOR));
  canvas.drawCircle(center, center, 20, ringPaint);

  const font = getMarkerFont(18);
  const metrics = font.getMetrics();
  const textPaint = Skia.Paint();
  textPaint.setAntiAlias(true);
  textPaint.setColor(Skia.Color(VEHICLE_MARKER_TEXT_COLOR));
  canvas.drawText(
    label,
    getCenteredTextX(font, label, center),
    center - (metrics.ascent + metrics.descent) / 2,
    textPaint,
    font,
  );

  return {
    height: pixelSize,
    uri: `data:image/png;base64,${surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100)}`,
    width: pixelSize,
  };
}

function normalizeMapRouteColor(color: string | null) {
  if (!color || !/^[0-9a-f]{6}$/i.test(color)) {
    return VEHICLE_MARKER_DEFAULT_COLOR;
  }

  return `#${color}`;
}
