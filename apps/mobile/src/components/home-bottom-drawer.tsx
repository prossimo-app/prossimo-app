import type { Coordinates } from "expo-maps";
import type { RefObject } from "react";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  View as RNView,
  TextInput,
} from "react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { skipToken, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useTranslation } from "@prossimo-app/localization";

import type {
  CachedStop,
  DrawerNearbyStop,
  DrawerStop,
  RouteVehicle,
  RouteVehiclesPayload,
  SelectedTransitLine,
  StopArrivalsPayload,
  TrackedTransitVehicle,
} from "./home-bottom-drawer/types";
import type { SelectedStop } from "~/components/home-map";
import type { RouterOutputs } from "~/utils/api";
import { useAppBootstrap } from "~/app-bootstrap/app-bootstrap-provider";
import { useFavorites } from "~/favorites/favorites-provider";
import { getStrikeTiming, isVisibleStrikeNotice } from "~/news/strike-notices";
import { trpc, trpcClient } from "~/utils/api";
import { getFuzzyMatchScore } from "~/utils/fuzzy-search";
import {
  createArrivalGroups,
  createDisplayArrivals,
  parseStopArrivalsPayload,
} from "./home-bottom-drawer/arrival-model";
import { DefaultDrawerContent } from "./home-bottom-drawer/default-drawer-content";
import { SelectedStopDrawerContent } from "./home-bottom-drawer/selected-stop-drawer-content";

const minTopGap = 96;
const collapsedContentHeight = 250;
const expandedContentHeight = 620;
const drawerCornerRadius = 28;
const drawerHeaderGap = 20;
const topDragHandleBottomPadding = 12;
const nearbyStopRadiusMeters = 1_000;
const nearbyStopLimit = 8;
const searchStopLimit = 50;
const routePageSize = 30;
const earthRadiusMeters = 6_371_000;
const springConfig = {
  damping: 24,
  mass: 0.9,
  stiffness: 260,
};
const overdragResistance = 72;

function applyOverdragResistance(offset: number, collapsedOffset: number) {
  if (offset >= 0) {
    if (offset <= collapsedOffset) {
      return offset;
    }

    const dragDistance = offset - collapsedOffset;

    return (
      collapsedOffset +
      (dragDistance * overdragResistance) / (dragDistance + overdragResistance)
    );
  }

  const dragDistance = Math.abs(offset);

  return -(
    (dragDistance * overdragResistance) /
    (dragDistance + overdragResistance)
  );
}

function getNearestDrawerStop(
  offset: number,
  stops: { full: number; expanded: number; collapsed: number },
): DrawerStop {
  const entries = Object.entries(stops) as [DrawerStop, number][];

  return entries.reduce<DrawerStop>((nearestStop, [stop, stopOffset]) => {
    const nearestOffset = stops[nearestStop];

    return Math.abs(offset - stopOffset) < Math.abs(offset - nearestOffset)
      ? stop
      : nearestStop;
  }, "collapsed");
}

function getDrawerStopOffset(
  stop: DrawerStop,
  stops: { full: number; expanded: number; collapsed: number },
) {
  return stops[stop];
}

function getReleasedDrawerStop({
  currentStop,
  nextOffset,
  stops,
  velocityY,
}: {
  currentStop: DrawerStop;
  nextOffset: number;
  stops: { full: number; expanded: number; collapsed: number };
  velocityY: number;
}) {
  const velocityOffset =
    velocityY < -0.35
      ? nextOffset - 80
      : velocityY > 0.35
        ? nextOffset + 80
        : nextOffset;

  if (currentStop === "full" && (velocityY > 0.25 || nextOffset > 32)) {
    const collapsedThreshold = (stops.expanded + stops.collapsed) / 2;

    return velocityOffset >= collapsedThreshold ? "collapsed" : "expanded";
  }

  return getNearestDrawerStop(velocityOffset, stops);
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface ValidCoordinates {
  latitude: number;
  longitude: number;
}

type RoutesPage = RouterOutputs["transit"]["getRoutes"];

function noop() {
  return undefined;
}

interface HomeBottomDrawerProps {
  blurTarget?: RefObject<RNView | null>;
  isExpanded?: boolean;
  location?: Coordinates | null;
  onExpandedChange?: (isExpanded: boolean) => void;
  onFullHeightChange?: (isFullHeight: boolean) => void;
  onRouteVehiclePress?: (vehicle: RouteVehicle) => void;
  onSelectedLineChange?: (line: SelectedTransitLine | null) => void;
  onStopFollowingVehicle?: () => void;
  onStopSelect?: (stop: SelectedStop | null) => void;
  onTrackedVehicleChange?: (vehicle: TrackedTransitVehicle | null) => void;
  routeVehiclesPayload?: RouteVehiclesPayload | null;
  selectedStop?: SelectedStop | null;
  trackedVehicle?: TrackedTransitVehicle | null;
}

export function HomeBottomDrawer({
  blurTarget,
  isExpanded: controlledIsExpanded,
  location = null,
  onExpandedChange,
  onFullHeightChange,
  onRouteVehiclePress,
  onSelectedLineChange,
  onStopFollowingVehicle,
  onStopSelect,
  onTrackedVehicleChange,
  routeVehiclesPayload = null,
  selectedStop = null,
  trackedVehicle = null,
}: HomeBottomDrawerProps) {
  const { t } = useTranslation();
  const { appBootstrap } = useAppBootstrap();
  const { bottom, top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const collapsedHeight = collapsedContentHeight + bottom;
  const expandedHeight = Math.max(
    Math.min(height - top - minTopGap, expandedContentHeight),
    collapsedHeight,
  );
  const fullHeight = Math.max(height, expandedHeight);
  const drawerStops = useMemo(
    () => ({
      full: 0,
      expanded: Math.max(fullHeight - expandedHeight, 0),
      collapsed: Math.max(fullHeight - collapsedHeight, 0),
    }),
    [collapsedHeight, expandedHeight, fullHeight],
  );
  const initialDrawerStop: DrawerStop = controlledIsExpanded
    ? "expanded"
    : "collapsed";
  const [drawerStop, setDrawerStopState] =
    useState<DrawerStop>(initialDrawerStop);
  const [isArrivalScrollAtTop, setIsArrivalScrollAtTop] = useState(true);
  const [translateY] = useState(
    () =>
      new Animated.Value(getDrawerStopOffset(initialDrawerStop, drawerStops)),
  );
  const searchFocusStartStopRef = useRef<DrawerStop | null>(null);
  const shouldRestoreSearchFocusStopRef = useRef(true);
  const lineDetailStartStopRef = useRef<DrawerStop | null>(null);
  const defaultStopDetailStartStopRef = useRef<DrawerStop | null>(null);
  const favoritesStartStopRef = useRef<DrawerStop | null>(null);
  const defaultStopDetailHadSelectedStopRef = useRef(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const selectedStopId = selectedStop?.stopId ?? null;
  const previousSelectedStopIdRef = useRef<string | null>(selectedStopId);
  const [defaultStopDetailStopId, setDefaultStopDetailStopId] = useState<
    string | null
  >(null);
  const activeDrawerStop =
    controlledIsExpanded === false ? "collapsed" : drawerStop;
  const selectedStopRealtimeId = selectedStop?.stopCode ?? null;
  const isWatchingSelectedStop = Boolean(selectedStopRealtimeId);
  const isFullHeight = activeDrawerStop === "full";
  const isContentScrollEnabled = activeDrawerStop !== "collapsed";
  const topDragHandleHeight = (isFullHeight ? top : 0) + 52;
  const targetOffset = getDrawerStopOffset(activeDrawerStop, drawerStops);
  const scrollBottomPadding = targetOffset + overdragResistance + bottom + 32;
  const cornerRadius = translateY.interpolate({
    inputRange: [drawerStops.full, drawerStops.expanded],
    outputRange: [0, drawerCornerRadius],
    extrapolate: "clamp",
  });
  const plannedTripsInput = useMemo(
    () =>
      selectedStop
        ? {
            stopId: selectedStop.stopId,
          }
        : null,
    [selectedStop],
  );
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [stopSearchQuery, setStopSearchQuery] = useState("");
  const [realtimePayload, setRealtimePayload] =
    useState<StopArrivalsPayload | null>(null);
  const activeFeedVersionId = appBootstrap?.activeFeedVersionId;
  const { data: cachedStopsData } = useQuery({
    ...trpc.transit.getStops.queryOptions(
      activeFeedVersionId ? { feedVersionId: activeFeedVersionId } : skipToken,
    ),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const cachedStops = useMemo(
    () =>
      cachedStopsData && cachedStopsData.feedVersionId === activeFeedVersionId
        ? cachedStopsData.stops
        : [],
    [activeFeedVersionId, cachedStopsData],
  );
  const nearbyStops = useMemo(
    () =>
      getNearbyStops(cachedStops, {
        limit: nearbyStopLimit,
        location,
        radiusMeters: nearbyStopRadiusMeters,
      }),
    [cachedStops, location],
  );
  const { favoriteStops } = useFavorites();
  const favoriteDrawerStops = useMemo(
    () =>
      favoriteStops.flatMap((favorite) => {
        const stop = cachedStops.find(
          (cachedStop) => cachedStop.stopId === favorite.stopId,
        );

        if (!stop) {
          return [];
        }

        const distanceMeters =
          hasValidCoordinates(location) &&
          hasValidCoordinates({ latitude: stop.lat, longitude: stop.lon })
            ? Math.round(
                getDistanceMeters(location, {
                  latitude: stop.lat,
                  longitude: stop.lon,
                }),
              )
            : Number.POSITIVE_INFINITY;

        return [{ ...stop, distanceMeters }];
      }),
    [cachedStops, favoriteStops, location],
  );
  const searchedStops = useMemo(
    () =>
      searchStops(cachedStops, {
        limit: searchStopLimit,
        location,
        query: stopSearchQuery,
      }),
    [cachedStops, location, stopSearchQuery],
  );
  const strikeQuery = useQuery({
    ...trpc.news.getLatest.queryOptions({
      globalNewsLimit: 1,
      strikeLimit: 10,
    }),
    staleTime: 5 * 60 * 1000,
  });
  const hasTodayStrike =
    strikeQuery.data?.strikes.some(
      (strike) =>
        isVisibleStrikeNotice(strike) && getStrikeTiming(strike) === "today",
    ) ?? false;
  const drawerRoutesQuery = useInfiniteQuery({
    enabled: Boolean(activeFeedVersionId),
    getNextPageParam: (lastPage: RoutesPage) =>
      lastPage.nextCursor ?? undefined,
    initialPageParam: 0,
    queryFn: ({ pageParam }): Promise<RoutesPage> => {
      if (!activeFeedVersionId) {
        throw new Error("Active feed version is required to fetch lines.");
      }

      return trpcClient.transit.getRoutes.query({
        cursor: pageParam,
        feedVersionId: activeFeedVersionId,
        limit: routePageSize,
        query: stopSearchQuery,
      });
    },
    queryKey: [
      "transit",
      "drawer-routes",
      activeFeedVersionId,
      stopSearchQuery,
    ],
    staleTime: Number.POSITIVE_INFINITY,
  });
  const drawerLines = useMemo(
    () =>
      drawerRoutesQuery.data?.pages.flatMap(
        (page: RoutesPage) => page.routes,
      ) ?? [],
    [drawerRoutesQuery.data],
  );
  const selectedStopRealtimePayload =
    realtimePayload?.stopId === selectedStopRealtimeId ? realtimePayload : null;
  const selectedStopAlertsInput = useMemo(
    () =>
      selectedStop
        ? {
            limit: 20,
            source: "gtt",
            stopCode: selectedStop.stopCode,
            stopId: selectedStop.stopId,
          }
        : null,
    [selectedStop],
  );
  const selectedStopAlertsQuery = useQuery({
    ...trpc.alerts.getForStop.queryOptions(
      selectedStopAlertsInput ?? skipToken,
    ),
    staleTime: 60_000,
  });
  const { data: plannedTripsData, isLoading: isLoadingPlannedTrips } = useQuery(
    {
      ...trpc.transit.getPlannedUpcomingTrips.queryOptions(
        plannedTripsInput ?? skipToken,
      ),
      staleTime: Number.POSITIVE_INFINITY,
    },
  );
  const displayArrivals = useMemo(
    () =>
      createDisplayArrivals({
        currentTimeMs,
        plannedTripsData,
        realtimePayload: selectedStopRealtimePayload,
        selectedStop,
      }),
    [
      currentTimeMs,
      plannedTripsData,
      selectedStop,
      selectedStopRealtimePayload,
    ],
  );
  const selectedStopArrivalGroups = useMemo(
    () => createArrivalGroups(displayArrivals),
    [displayArrivals],
  );
  const selectedStopLastUpdatedAt =
    selectedStopRealtimePayload?.fetchedAt ?? null;
  const selectedStopLastUpdatedAtMs = selectedStopLastUpdatedAt
    ? Date.parse(selectedStopLastUpdatedAt)
    : Number.NaN;
  const isSelectedStopRealtimeDataStale =
    Number.isFinite(selectedStopLastUpdatedAtMs) &&
    currentTimeMs - selectedStopLastUpdatedAtMs > 60_000;
  const isSelectedStopRealtimeDataPending = !selectedStopLastUpdatedAt;
  const isShowingDefaultStopDetail =
    Boolean(selectedStopId) && selectedStopId === defaultStopDetailStopId;
  const [isLastUpdatedRefreshing, setIsLastUpdatedRefreshing] = useState(false);
  const previousLastUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 10_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    previousLastUpdatedAtRef.current = null;
    onSelectedLineChange?.(null);
    // This state mirrors the selected stop boundary and must reset immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLastUpdatedRefreshing(false);
  }, [onSelectedLineChange, selectedStopId]);

  useEffect(() => {
    if (!selectedStopLastUpdatedAt) {
      previousLastUpdatedAtRef.current = null;
      // This state mirrors whether a timestamp exists for the current stop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLastUpdatedRefreshing(false);
      return;
    }

    const previousLastUpdatedAt = previousLastUpdatedAtRef.current;
    previousLastUpdatedAtRef.current = selectedStopLastUpdatedAt;

    if (
      !previousLastUpdatedAt ||
      previousLastUpdatedAt === selectedStopLastUpdatedAt
    ) {
      return;
    }

    setIsLastUpdatedRefreshing(true);

    const timeout = setTimeout(() => {
      setIsLastUpdatedRefreshing(false);
    }, 900);

    return () => {
      clearTimeout(timeout);
    };
  }, [selectedStopLastUpdatedAt]);

  useEffect(() => {
    if (!selectedStop || !selectedStopRealtimeId || !isWatchingSelectedStop) {
      return;
    }

    const subscription = trpcClient.realtime.observeTopic.subscribe(
      {
        topic: {
          id: selectedStopRealtimeId,
          stopCode: selectedStop.stopCode,
          type: "stop",
        },
      },
      {
        onData(data) {
          const payload = parseStopArrivalsPayload(data);

          if (payload?.stopId === selectedStopRealtimeId) {
            setRealtimePayload(payload);
          }
        },
        onError(error) {
          console.warn("Failed to observe stop realtime arrivals", error);
        },
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isWatchingSelectedStop, selectedStop, selectedStopRealtimeId]);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: targetOffset,
      useNativeDriver: false,
      ...springConfig,
    }).start();
  }, [targetOffset, translateY]);

  useEffect(() => {
    onFullHeightChange?.(isFullHeight);
  }, [isFullHeight, onFullHeightChange]);

  const blurSearchInput = useCallback(() => {
    searchInputRef.current?.blur();
    void KeyboardController.dismiss();
  }, []);

  const dismissSearchOnScroll = useCallback(() => {
    // Clearing the focus-start stop keeps the drawer where it is while the
    // keyboard collapses mid-scroll.
    searchFocusStartStopRef.current = null;
    blurSearchInput();
  }, [blurSearchInput]);

  const setDrawerStop = useCallback(
    (nextStop: DrawerStop) => {
      if (activeDrawerStop === "full" && nextStop !== "full") {
        shouldRestoreSearchFocusStopRef.current = false;
        searchFocusStartStopRef.current = null;
        blurSearchInput();
      }

      setDrawerStopState(nextStop);
      onExpandedChange?.(nextStop !== "collapsed");

      if (nextStop === "collapsed") {
        blurSearchInput();
      }
    },
    [activeDrawerStop, blurSearchInput, onExpandedChange],
  );

  useEffect(() => {
    if (!defaultStopDetailStopId) {
      defaultStopDetailHadSelectedStopRef.current = false;
      return;
    }

    if (selectedStopId === defaultStopDetailStopId) {
      defaultStopDetailHadSelectedStopRef.current = true;
      return;
    }

    if (selectedStopId || !defaultStopDetailHadSelectedStopRef.current) {
      return;
    }

    const previousStop = defaultStopDetailStartStopRef.current;
    defaultStopDetailStartStopRef.current = null;
    lineDetailStartStopRef.current = null;
    defaultStopDetailHadSelectedStopRef.current = false;
    setDefaultStopDetailStopId(null);
    onSelectedLineChange?.(null);
    onTrackedVehicleChange?.(null);

    if (previousStop) {
      setDrawerStop(previousStop);
    }
  }, [
    defaultStopDetailStopId,
    onSelectedLineChange,
    onTrackedVehicleChange,
    selectedStopId,
    setDrawerStop,
  ]);

  useLayoutEffect(() => {
    if (controlledIsExpanded && drawerStop === "collapsed") {
      // Keep the local drawer stop aligned with the controlled expanded state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrawerStopState("expanded");
    }
  }, [controlledIsExpanded, drawerStop]);

  useLayoutEffect(() => {
    const previousSelectedStopId = previousSelectedStopIdRef.current;
    previousSelectedStopIdRef.current = selectedStopId;

    if (selectedStopId && selectedStopId !== previousSelectedStopId) {
      setDrawerStopState("expanded");
    }
  }, [selectedStopId]);

  const panResponder = useMemo(() => {
    const currentOffset = getDrawerStopOffset(activeDrawerStop, drawerStops);

    // PanResponder is a React Native imperative responder object.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const nextOffset = currentOffset + gestureState.dy;

        translateY.setValue(
          applyOverdragResistance(nextOffset, drawerStops.collapsed),
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        const nextOffset = currentOffset + gestureState.dy;
        const nextStop = getReleasedDrawerStop({
          currentStop: activeDrawerStop,
          nextOffset,
          stops: drawerStops,
          velocityY: gestureState.vy,
        });

        setDrawerStop(nextStop);
        Animated.spring(translateY, {
          toValue: getDrawerStopOffset(nextStop, drawerStops),
          useNativeDriver: false,
          ...springConfig,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: currentOffset,
          useNativeDriver: false,
          ...springConfig,
        }).start();
      },
    });
  }, [activeDrawerStop, drawerStops, setDrawerStop, translateY]);

  const fullHeightBodyPanResponder = useMemo(() => {
    const currentOffset = getDrawerStopOffset(activeDrawerStop, drawerStops);
    const shouldHandleBodyPan = (gestureState: { dx: number; dy: number }) =>
      activeDrawerStop === "full" &&
      isArrivalScrollAtTop &&
      gestureState.dy > 6 &&
      Math.abs(gestureState.dy) > Math.abs(gestureState.dx);

    // PanResponder is a React Native imperative responder object.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        shouldHandleBodyPan(gestureState),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        shouldHandleBodyPan(gestureState),
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const nextOffset = currentOffset + gestureState.dy;

        translateY.setValue(
          applyOverdragResistance(nextOffset, drawerStops.collapsed),
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        const nextOffset = currentOffset + gestureState.dy;
        const nextStop = getReleasedDrawerStop({
          currentStop: activeDrawerStop,
          nextOffset,
          stops: drawerStops,
          velocityY: gestureState.vy,
        });

        setDrawerStop(nextStop);
        Animated.spring(translateY, {
          toValue: getDrawerStopOffset(nextStop, drawerStops),
          useNativeDriver: false,
          ...springConfig,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: currentOffset,
          useNativeDriver: false,
          ...springConfig,
        }).start();
      },
    });
  }, [
    activeDrawerStop,
    drawerStops,
    isArrivalScrollAtTop,
    setDrawerStop,
    translateY,
  ]);

  const handleArrivalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const isAtTop = event.nativeEvent.contentOffset.y <= 0;

      setIsArrivalScrollAtTop((currentIsAtTop) =>
        currentIsAtTop === isAtTop ? currentIsAtTop : isAtTop,
      );
    },
    [],
  );

  const toggleDrawer = () => {
    const nextStop =
      activeDrawerStop === "collapsed"
        ? "expanded"
        : activeDrawerStop === "expanded"
          ? "full"
          : "expanded";

    setDrawerStop(nextStop);
  };
  const openLineDetail = useCallback(() => {
    lineDetailStartStopRef.current ??= activeDrawerStop;

    setDrawerStop("collapsed");
  }, [activeDrawerStop, setDrawerStop]);
  const closeLineDetail = useCallback(() => {
    const previousStop = lineDetailStartStopRef.current;
    lineDetailStartStopRef.current = null;
    onSelectedLineChange?.(null);

    if (previousStop) {
      setDrawerStop(previousStop);
    }
  }, [onSelectedLineChange, setDrawerStop]);
  const dismissLineDetail = useCallback(() => {
    const previousStop = lineDetailStartStopRef.current;
    lineDetailStartStopRef.current = null;
    onSelectedLineChange?.(null);
    onTrackedVehicleChange?.(null);
    onStopSelect?.(null);

    if (previousStop) {
      setDrawerStop(previousStop);
    }
  }, [
    onSelectedLineChange,
    onStopSelect,
    onTrackedVehicleChange,
    setDrawerStop,
  ]);
  const openDefaultStopDetail = useCallback(() => {
    defaultStopDetailStartStopRef.current ??= activeDrawerStop;

    setDrawerStop("collapsed");
  }, [activeDrawerStop, setDrawerStop]);
  const openFavorites = useCallback(() => {
    favoritesStartStopRef.current ??= activeDrawerStop;

    if (activeDrawerStop === "collapsed") {
      setDrawerStop("expanded");
    }
  }, [activeDrawerStop, setDrawerStop]);
  const closeFavorites = useCallback(() => {
    const previousStop = favoritesStartStopRef.current;
    favoritesStartStopRef.current = null;

    if (previousStop) {
      setDrawerStop(previousStop);
    }
  }, [setDrawerStop]);
  const closeDefaultStopDetail = useCallback(() => {
    const previousStop = defaultStopDetailStartStopRef.current;
    defaultStopDetailStartStopRef.current = null;
    lineDetailStartStopRef.current = null;
    defaultStopDetailHadSelectedStopRef.current = false;
    setDefaultStopDetailStopId(null);
    onSelectedLineChange?.(null);
    onTrackedVehicleChange?.(null);
    onStopSelect?.(null);

    if (previousStop) {
      setDrawerStop(previousStop);
    }
  }, [
    onSelectedLineChange,
    onStopSelect,
    onTrackedVehicleChange,
    setDrawerStop,
  ]);

  const handleDefaultStopPress = useCallback(
    (stop: DrawerNearbyStop) => {
      defaultStopDetailHadSelectedStopRef.current = false;
      setDefaultStopDetailStopId(stop.stopId);
      openDefaultStopDetail();
      onStopSelect?.({
        coordinates: {
          latitude: stop.lat,
          longitude: stop.lon,
        },
        routes: stop.routes,
        stopCode: stop.stopCode,
        stopDesc: stop.stopDesc,
        stopId: stop.stopId,
        stopName: stop.stopName,
      });
    },
    [onStopSelect, openDefaultStopDetail],
  );
  const handleDefaultLinePress = useCallback(
    (line: (typeof drawerLines)[number]) => {
      onSelectedLineChange?.({
        color: line.color,
        routeLabel: line.shortName,
        routeId: line.routeId,
        routeType: line.type,
      });
      openLineDetail();
    },
    [onSelectedLineChange, openLineDetail],
  );
  const rootPanHandlers = selectedStop
    ? fullHeightBodyPanResponder.panHandlers
    : undefined;

  return (
    <Animated.View
      {...rootPanHandlers}
      className="absolute right-0 bottom-0 left-0"
      style={[
        {
          bottom: -overdragResistance,
          height: fullHeight + overdragResistance,
          borderTopLeftRadius: cornerRadius,
          borderTopRightRadius: cornerRadius,
          boxShadow: "0 -8px 28px rgba(15, 23, 42, 0.18)",
          transform: [{ translateY }],
        },
      ]}
    >
      <Animated.View
        className="border-border overflow-hidden border"
        style={{
          height: fullHeight + overdragResistance,
          borderTopLeftRadius: cornerRadius,
          borderTopRightRadius: cornerRadius,
        }}
      >
        <DrawerSurface blurTarget={blurTarget} cornerRadius={cornerRadius} />
        <View
          className="px-5"
          style={{
            height: fullHeight + overdragResistance,
            paddingBottom: 16,
          }}
        >
          <View
            {...panResponder.panHandlers}
            className="items-center justify-end"
            style={{
              height: topDragHandleHeight + drawerHeaderGap,
              marginHorizontal: -20,
              paddingBottom: topDragHandleBottomPadding + drawerHeaderGap,
            }}
          >
            <Pressable
              {...panResponder.panHandlers}
              accessibilityLabel={
                isFullHeight
                  ? t("home.drawer.collapseAccessibilityLabel")
                  : t("home.drawer.expandAccessibilityLabel")
              }
              accessibilityRole="button"
              className="px-8 py-2"
              hitSlop={12}
              onPress={toggleDrawer}
            >
              <View className="bg-border h-1.5 w-12 rounded-full" />
            </Pressable>
          </View>

          {selectedStop && !isShowingDefaultStopDetail ? (
            <SelectedStopDrawerContent
              alerts={selectedStopAlertsQuery.data?.alerts ?? []}
              arrivalGroups={selectedStopArrivalGroups}
              isLoading={isLoadingPlannedTrips}
              isLoadingAlerts={selectedStopAlertsQuery.isLoading}
              isLastUpdatedRefreshing={isLastUpdatedRefreshing}
              isRealtimeDataPending={isSelectedStopRealtimeDataPending}
              isRealtimeDataStale={isSelectedStopRealtimeDataStale}
              key={selectedStop.stopId}
              onArrivalScroll={handleArrivalScroll}
              onLineDetailClose={closeLineDetail}
              onLineDetailDismiss={dismissLineDetail}
              onLineDetailOpen={openLineDetail}
              onSelectedLineChange={onSelectedLineChange ?? noop}
              onTrackedVehicleChange={onTrackedVehicleChange ?? noop}
              onSearchBlur={() => {
                if (!shouldRestoreSearchFocusStopRef.current) {
                  shouldRestoreSearchFocusStopRef.current = true;
                  return;
                }

                const previousStop = searchFocusStartStopRef.current;
                searchFocusStartStopRef.current = null;

                if (previousStop && previousStop !== "full") {
                  setDrawerStop(previousStop);
                }
              }}
              onSearchFocus={() => {
                shouldRestoreSearchFocusStopRef.current = true;

                if (activeDrawerStop !== "full") {
                  searchFocusStartStopRef.current = activeDrawerStop;
                  setDrawerStop("full");
                }
              }}
              onSearchScrollDismiss={dismissSearchOnScroll}
              panHandlers={panResponder.panHandlers}
              scrollEnabled={isContentScrollEnabled}
              searchInputRef={searchInputRef}
              scrollBottomPadding={scrollBottomPadding}
              lastUpdatedAt={selectedStopLastUpdatedAt ?? null}
              stopCode={
                plannedTripsData?.stop?.stopCode ?? selectedStop.stopCode
              }
              stopId={selectedStop.stopId}
              stopName={
                plannedTripsData?.stop?.stopName ?? selectedStop.stopName
              }
            />
          ) : (
            <DefaultDrawerContent
              currentTimeMs={currentTimeMs}
              favoriteStops={favoriteDrawerStops}
              hasTodayStrike={hasTodayStrike}
              onFavoritesClose={closeFavorites}
              onFavoritesOpen={openFavorites}
              nearbyRadiusMeters={nearbyStopRadiusMeters}
              nearbyStops={nearbyStops}
              location={location}
              lines={drawerLines}
              onSearchBlur={() => {
                if (!shouldRestoreSearchFocusStopRef.current) {
                  shouldRestoreSearchFocusStopRef.current = true;
                  return;
                }

                const previousStop = searchFocusStartStopRef.current;
                searchFocusStartStopRef.current = null;

                if (previousStop && previousStop !== "full") {
                  setDrawerStop(previousStop);
                }
              }}
              onSearchChange={setStopSearchQuery}
              onSearchFocus={() => {
                shouldRestoreSearchFocusStopRef.current = true;

                if (activeDrawerStop !== "full") {
                  searchFocusStartStopRef.current = activeDrawerStop;
                  setDrawerStop("full");
                }
              }}
              onSearchScrollDismiss={dismissSearchOnScroll}
              onLinePress={handleDefaultLinePress}
              onLineBack={() => {
                closeLineDetail();
              }}
              onRouteVehiclePress={onRouteVehiclePress}
              onStopFollowingVehicle={onStopFollowingVehicle}
              onStopArrivalScroll={handleArrivalScroll}
              onStopBack={closeDefaultStopDetail}
              onStopLineDetailClose={closeLineDetail}
              onStopLineDetailDismiss={closeDefaultStopDetail}
              onStopLineDetailOpen={openLineDetail}
              onStopSelectedLineChange={onSelectedLineChange ?? noop}
              onStopTrackedVehicleChange={onTrackedVehicleChange ?? noop}
              hasMoreLines={Boolean(drawerRoutesQuery.hasNextPage)}
              isLoadingMoreLines={drawerRoutesQuery.isFetchingNextPage}
              onLoadMoreLines={() => {
                if (
                  drawerRoutesQuery.hasNextPage &&
                  !drawerRoutesQuery.isFetchingNextPage
                ) {
                  void drawerRoutesQuery.fetchNextPage();
                }
              }}
              onShowLocationTutorial={() => {
                router.push("/settings/location-sharing");
              }}
              onStopPress={handleDefaultStopPress}
              panHandlers={panResponder.panHandlers}
              scrollEnabled={isContentScrollEnabled}
              routeVehiclesPayload={routeVehiclesPayload}
              searchInputRef={searchInputRef}
              searchQuery={stopSearchQuery}
              searchResults={searchedStops}
              scrollBottomPadding={scrollBottomPadding}
              stopDetail={{
                alerts: selectedStopAlertsQuery.data?.alerts ?? [],
                arrivalGroups: selectedStopArrivalGroups,
                isOpen: Boolean(defaultStopDetailStopId),
                isLoadingAlerts: selectedStopAlertsQuery.isLoading,
                isLastUpdatedRefreshing,
                isRealtimeDataPending: isSelectedStopRealtimeDataPending,
                isRealtimeDataStale: isSelectedStopRealtimeDataStale,
                isLoading: isLoadingPlannedTrips,
                lastUpdatedAt: selectedStopLastUpdatedAt ?? null,
                selectedStop: isShowingDefaultStopDetail ? selectedStop : null,
              }}
              trackedVehicle={trackedVehicle}
            />
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function getNearbyStops(
  stops: CachedStop[],
  options: {
    limit: number;
    location: Coordinates | null;
    radiusMeters: number;
  },
): DrawerNearbyStop[] {
  const location = options.location;

  if (!hasValidCoordinates(location)) {
    return [];
  }

  return stops
    .flatMap((stop) => {
      if (!hasValidCoordinates({ latitude: stop.lat, longitude: stop.lon })) {
        return [];
      }

      const distanceMeters = Math.round(
        getDistanceMeters(location, {
          latitude: stop.lat,
          longitude: stop.lon,
        }),
      );

      if (distanceMeters > options.radiusMeters) {
        return [];
      }

      return [{ ...stop, distanceMeters }];
    })
    .sort(compareDrawerStops)
    .slice(0, options.limit);
}

function searchStops(
  stops: CachedStop[],
  options: {
    limit: number;
    location: Coordinates | null;
    query: string;
  },
): DrawerNearbyStop[] {
  const normalizedQuery = options.query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return stops
    .flatMap((stop) => {
      const searchableText = [
        stop.stopName,
        stop.stopCode,
        stop.stopDesc,
        ...stop.routes.map((route) => route.shortName),
      ]
        .filter(Boolean)
        .join(" ");
      const matchScore = getFuzzyMatchScore(normalizedQuery, searchableText);

      if (matchScore === 0) {
        return [];
      }

      const location = options.location;
      const distanceMeters = hasValidCoordinates(location)
        ? Math.round(
            getDistanceMeters(location, {
              latitude: stop.lat,
              longitude: stop.lon,
            }),
          )
        : Number.POSITIVE_INFINITY;

      return [{ ...stop, distanceMeters, matchScore }];
    })
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore || compareDrawerStops(left, right),
    )
    .slice(0, options.limit)
    .map(({ matchScore: _matchScore, ...stop }) => stop);
}

function compareDrawerStops(left: DrawerNearbyStop, right: DrawerNearbyStop) {
  return (
    left.distanceMeters - right.distanceMeters ||
    left.stopName.localeCompare(right.stopName) ||
    left.stopId.localeCompare(right.stopId)
  );
}

function hasValidCoordinates(
  coordinates:
    | Coordinates
    | {
        latitude?: number | null;
        longitude?: number | null;
      }
    | null,
): coordinates is ValidCoordinates {
  return (
    typeof coordinates?.latitude === "number" &&
    Number.isFinite(coordinates.latitude) &&
    typeof coordinates.longitude === "number" &&
    Number.isFinite(coordinates.longitude)
  );
}

function getDistanceMeters(from: ValidCoordinates, to: ValidCoordinates) {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const halfChordLength =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  const angularDistance =
    2 * Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength));

  return earthRadiusMeters * angularDistance;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function DrawerSurface({
  blurTarget,
  cornerRadius,
}: {
  blurTarget?: RefObject<RNView | null>;
  cornerRadius: Animated.AnimatedInterpolation<number>;
}) {
  const colorScheme = useColorScheme();
  // The Android blur implementation doesn't resolve the adaptive
  // "systemMaterial" tint against the current color scheme, so pick the
  // explicit variant there. iOS resolves it natively.
  const tint =
    Platform.OS === "android"
      ? colorScheme === "dark"
        ? "systemMaterialDark"
        : "systemMaterialLight"
      : "systemMaterial";

  return (
    <AnimatedBlurView
      blurMethod="dimezisBlurViewSdk31Plus"
      blurReductionFactor={3}
      blurTarget={blurTarget}
      className="absolute inset-0 overflow-hidden"
      intensity={88}
      style={{
        borderTopLeftRadius: cornerRadius,
        borderTopRightRadius: cornerRadius,
      }}
      tint={tint}
    />
  );
}
