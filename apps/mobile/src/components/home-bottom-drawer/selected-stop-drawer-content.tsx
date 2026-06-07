import type { Coordinates } from "expo-maps";
import type { GestureResponderHandlers } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardController,
} from "react-native-keyboard-controller";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import BusIcon from "@expo/material-symbols/directions_bus.xml";
import SubwayIcon from "@expo/material-symbols/subway.xml";
import TrainIcon from "@expo/material-symbols/train.xml";
import TramIcon from "@expo/material-symbols/tram.xml";
import { Host, Icon, Text as NativeText } from "@expo/ui";
import {
  animation,
  Animation,
  contentTransition,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { skipToken, useQuery } from "@tanstack/react-query";

import { useTranslation } from "@prossimo-app/localization";

import type {
  ArrivalGroup,
  DisplayArrival,
  LastUpdatedDisplay,
  RouteType,
  RouteVehicle,
  SelectedStopDrawerContentProps,
  ServiceAlert,
  TrackedTransitVehicle,
  Translate,
} from "./types";
import { SearchInput } from "~/components/search-input";
import { getWarningForegroundColor } from "~/theme/native-colors";
import { trpc } from "~/utils/api";
import {
  filterArrivalGroups,
  formatArrivalMinutes,
  getArrivalDetail,
  getLastUpdatedDisplay,
  normalizeRouteColor,
} from "./arrival-model";
import { DrawerIconButton } from "./drawer-icon-button";

const routeTypeIcons = {
  bus: Icon.select({
    ios: "bus.fill",
    android: BusIcon,
  }),
  metro: Icon.select({
    ios: "train.side.front.car",
    android: SubwayIcon,
  }),
  rail: Icon.select({
    ios: "train.side.front.car",
    android: TrainIcon,
  }),
  tram: Icon.select({
    ios: "tram.fill",
    android: TramIcon,
  }),
  unknown: Icon.select({
    ios: "questionmark.circle.fill",
    android: TrainIcon,
  }),
} satisfies Record<RouteType, React.ComponentProps<typeof Icon>["name"]>;
const lineCardChevronIcon = Icon.select({
  ios: "chevron.forward",
  android: ChevronRightIcon,
});

interface LatLon {
  latitude: number;
  longitude: number;
}

export function SelectedStopDrawerContent({
  alerts,
  arrivalGroups,
  isLoading,
  isLoadingAlerts,
  isLastUpdatedRefreshing,
  isRealtimeDataPending,
  isRealtimeDataStale,
  lastUpdatedAt,
  onArrivalScroll,
  onBack,
  onLineDetailClose,
  onLineDetailDismiss,
  onLineDetailOpen,
  onSelectedLineChange,
  onTrackedVehicleChange,
  onSearchBlur,
  onSearchFocus,
  panHandlers,
  searchInputRef,
  scrollBottomPadding,
  stopCode,
  stopId,
  stopName,
}: SelectedStopDrawerContentProps) {
  const { t } = useTranslation();
  const [lineSearchQuery, setLineSearchQuery] = useState("");
  const [pageTransition] = useState(() => new Animated.Value(0));
  const [selectedArrivalGroup, setSelectedArrivalGroup] =
    useState<ArrivalGroup | null>(null);
  const filteredArrivalGroups = useMemo(
    () => filterArrivalGroups(arrivalGroups, lineSearchQuery),
    [arrivalGroups, lineSearchQuery],
  );
  const selectedLatestArrivalGroup = selectedArrivalGroup
    ? (arrivalGroups.find((group) => group.key === selectedArrivalGroup.key) ??
      selectedArrivalGroup)
    : null;
  const selectedTrackedVehicle = useMemo(
    () => getNearestLiveVehicle(selectedLatestArrivalGroup),
    [selectedLatestArrivalGroup],
  );
  const isFiltering = lineSearchQuery.trim().length > 0;
  const lastUpdatedDisplay = getLastUpdatedDisplay(lastUpdatedAt, t);
  const handleStopAlertsPress = useCallback(() => {
    router.push({
      pathname: "/stop-alerts",
      params: {
        stopCode: stopCode ?? "",
        stopId,
        stopName,
      },
    });
  }, [stopCode, stopId, stopName]);

  useEffect(() => {
    onTrackedVehicleChange(selectedTrackedVehicle);
  }, [onTrackedVehicleChange, selectedTrackedVehicle]);

  useEffect(() => {
    if (!selectedLatestArrivalGroup) {
      onSelectedLineChange(null);
      return;
    }

    onSelectedLineChange({
      color: selectedLatestArrivalGroup.color,
      routeLabel: selectedLatestArrivalGroup.label,
      routeId: selectedLatestArrivalGroup.key,
      routeType: selectedLatestArrivalGroup.routeType,
    });
  }, [onSelectedLineChange, selectedLatestArrivalGroup]);

  useEffect(
    () => () => {
      onSelectedLineChange(null);
      onTrackedVehicleChange(null);
    },
    [onSelectedLineChange, onTrackedVehicleChange],
  );
  const animatePageTransition = useCallback(
    (toValue: number, onComplete?: () => void) => {
      Animated.timing(pageTransition, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      });
    },
    [pageTransition],
  );

  const handleLinePress = useCallback(
    (group: ArrivalGroup) => {
      pageTransition.stopAnimation();
      setSelectedArrivalGroup(group);
      onLineDetailOpen();
      animatePageTransition(1);
    },
    [animatePageTransition, onLineDetailOpen, pageTransition],
  );

  const handleBack = useCallback(() => {
    pageTransition.stopAnimation();
    onTrackedVehicleChange(null);
    onLineDetailClose();
    animatePageTransition(0, () => {
      setSelectedArrivalGroup(null);
    });
  }, [
    animatePageTransition,
    onLineDetailClose,
    onTrackedVehicleChange,
    pageTransition,
  ]);
  const handleClose = useCallback(() => {
    pageTransition.stopAnimation();
    onTrackedVehicleChange(null);
    onLineDetailDismiss();
    setSelectedArrivalGroup(null);
  }, [onLineDetailDismiss, onTrackedVehicleChange, pageTransition]);

  const listPageAnimatedStyle = {
    opacity: pageTransition.interpolate({
      inputRange: [0, 0.65, 1],
      outputRange: [1, 0.18, 0],
    }),
    transform: [
      {
        translateX: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -40],
        }),
      },
      {
        scale: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.985],
        }),
      },
    ],
  };
  const detailPageAnimatedStyle = {
    opacity: pageTransition.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0, 0.35, 1],
    }),
    transform: [
      {
        translateX: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [46, 0],
        }),
      },
      {
        scale: pageTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.99, 1],
        }),
      },
    ],
  };

  return (
    <View className="relative min-h-0 flex-1 overflow-hidden">
      <Animated.View
        pointerEvents={selectedArrivalGroup ? "none" : "auto"}
        style={[styles.page, listPageAnimatedStyle]}
      >
        <ArrivalLineList
          alerts={alerts}
          filteredArrivalGroups={filteredArrivalGroups}
          isFiltering={isFiltering}
          isLoadingAlerts={isLoadingAlerts}
          isLastUpdatedRefreshing={isLastUpdatedRefreshing}
          isLoading={isLoading}
          isRealtimeDataPending={isRealtimeDataPending}
          isRealtimeDataStale={isRealtimeDataStale}
          lastUpdatedDisplay={lastUpdatedDisplay}
          lineSearchQuery={lineSearchQuery}
          onArrivalScroll={onArrivalScroll}
          onBack={onBack}
          onStopAlertsPress={alerts.length > 0 ? handleStopAlertsPress : null}
          onLinePress={handleLinePress}
          onSearchBlur={onSearchBlur}
          onSearchChangeText={setLineSearchQuery}
          onSearchFocus={onSearchFocus}
          panHandlers={panHandlers}
          searchInputRef={searchInputRef}
          scrollBottomPadding={scrollBottomPadding}
          stopCode={stopCode}
          stopName={stopName}
        />
      </Animated.View>

      {selectedLatestArrivalGroup ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.page, detailPageAnimatedStyle]}
        >
          <ArrivalLineDetail
            group={selectedLatestArrivalGroup}
            isLastUpdatedRefreshing={isLastUpdatedRefreshing}
            isRealtimeDataPending={isRealtimeDataPending}
            isRealtimeDataStale={isRealtimeDataStale}
            lastUpdatedDisplay={lastUpdatedDisplay}
            onBack={handleBack}
            onClose={handleClose}
            onScroll={onArrivalScroll}
            panHandlers={panHandlers}
            scrollBottomPadding={scrollBottomPadding}
            showRouteVehicles={false}
            stopName={stopName}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function ArrivalLineList({
  alerts,
  filteredArrivalGroups,
  isFiltering,
  isLoadingAlerts,
  isLastUpdatedRefreshing,
  isLoading,
  isRealtimeDataPending,
  isRealtimeDataStale,
  lastUpdatedDisplay,
  lineSearchQuery,
  onArrivalScroll,
  onBack,
  onLinePress,
  onSearchBlur,
  onSearchChangeText,
  onSearchFocus,
  onStopAlertsPress,
  panHandlers,
  searchInputRef,
  scrollBottomPadding,
  stopName,
}: {
  alerts: ServiceAlert[];
  filteredArrivalGroups: ArrivalGroup[];
  isFiltering: boolean;
  isLoadingAlerts: boolean;
  isLastUpdatedRefreshing: boolean;
  isLoading: boolean;
  isRealtimeDataPending: boolean;
  isRealtimeDataStale: boolean;
  lastUpdatedDisplay: LastUpdatedDisplay | null;
  lineSearchQuery: string;
  onArrivalScroll: SelectedStopDrawerContentProps["onArrivalScroll"];
  onBack?: () => void;
  onLinePress: (group: ArrivalGroup) => void;
  onSearchBlur: () => void;
  onSearchChangeText: (query: string) => void;
  onSearchFocus: () => void;
  onStopAlertsPress: (() => void) | null;
  panHandlers: GestureResponderHandlers;
  searchInputRef: SelectedStopDrawerContentProps["searchInputRef"];
  scrollBottomPadding: number;
  stopCode: string | null;
  stopName: string;
}) {
  const { t } = useTranslation();

  return (
    <>
      <View {...panHandlers} className="gap-4">
        <View className="flex-row items-center gap-3">
          {onBack ? (
            <DrawerIconButton
              accessibilityLabel={t("home.drawer.backAccessibilityLabel")}
              icon="back"
              onPress={onBack}
            />
          ) : null}
          <View className="min-w-0 flex-1 gap-1">
            <Text
              className="text-foreground font-sans text-2xl font-bold"
              numberOfLines={2}
            >
              {stopName}
            </Text>
            {lastUpdatedDisplay ? (
              <LastUpdatedTimestamp
                display={lastUpdatedDisplay}
                isRefreshing={isLastUpdatedRefreshing}
              />
            ) : null}
          </View>
          {onStopAlertsPress ? (
            <DrawerIconButton
              accessibilityLabel={t("home.drawer.alerts.open")}
              hasBadge={alerts.length > 0}
              icon="news"
              onPress={onStopAlertsPress}
            />
          ) : null}
        </View>
        <SearchInput
          accessibilityLabel={t("home.drawer.arrivals.searchLines")}
          onBlur={onSearchBlur}
          onChangeText={onSearchChangeText}
          onFocus={() => {
            onSearchFocus();
            KeyboardController.preload();
          }}
          onSubmitEditing={() => {
            void KeyboardController.dismiss();
          }}
          placeholder={t("home.drawer.arrivals.searchLines")}
          ref={searchInputRef}
          value={lineSearchQuery}
        />
      </View>

      <View className="min-h-0 flex-1">
        <KeyboardAwareScrollView
          bottomOffset={24}
          className="min-h-0 flex-1"
          contentContainerStyle={{
            gap: 12,
            paddingBottom: scrollBottomPadding,
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={onArrivalScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {isRealtimeDataPending ? (
            <RealtimeDataAlert type="pending" />
          ) : isRealtimeDataStale ? (
            <RealtimeDataAlert type="stale" />
          ) : null}
          <StopServiceAlertList alerts={alerts} isLoading={isLoadingAlerts} />
          {isLoading ? (
            <ArrivalSkeletonList />
          ) : filteredArrivalGroups.length > 0 ? (
            <>
              <RealtimeArrivalLegend />
              {filteredArrivalGroups.map((group) => (
                <ArrivalLineCard
                  group={group}
                  key={group.key}
                  onPress={() => {
                    onLinePress(group);
                  }}
                />
              ))}
            </>
          ) : (
            <View className="bg-card rounded-2xl p-4">
              <Text className="text-muted-foreground text-center font-sans text-sm">
                {isFiltering
                  ? t("home.drawer.arrivals.noMatchingLines")
                  : t("home.drawer.arrivals.empty")}
              </Text>
            </View>
          )}
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}

export function ArrivalLineDetail({
  emptyMessage,
  group,
  isLastUpdatedRefreshing,
  isRealtimeDataPending,
  isRealtimeDataStale,
  lastUpdatedDisplay,
  onBack,
  onClose,
  onRouteVehiclePress,
  onScroll,
  onStopFollowingVehicle,
  panHandlers,
  routeVehicles = [],
  scrollBottomPadding,
  showArrivalDetails = true,
  showRouteVehicles = true,
  stopName,
  trackedVehicleId = null,
  userLocation = null,
}: {
  emptyMessage?: string;
  group: ArrivalGroup;
  isLastUpdatedRefreshing: boolean;
  isRealtimeDataPending: boolean;
  isRealtimeDataStale: boolean;
  lastUpdatedDisplay: LastUpdatedDisplay | null;
  onBack: () => void;
  onClose?: () => void;
  onRouteVehiclePress?: (vehicle: RouteVehicle) => void;
  onScroll: SelectedStopDrawerContentProps["onArrivalScroll"];
  onStopFollowingVehicle?: () => void;
  panHandlers: GestureResponderHandlers;
  routeVehicles?: RouteVehicle[];
  scrollBottomPadding: number;
  showArrivalDetails?: boolean;
  showRouteVehicles?: boolean;
  stopName?: string | null;
  trackedVehicleId?: string | null;
  userLocation?: Coordinates | null;
}) {
  const { t } = useTranslation();
  const routeTypeIcon = routeTypeIcons[group.routeType];
  const lineAlertsQuery = useQuery({
    ...trpc.alerts.getForRoute.queryOptions(
      group.key
        ? {
            limit: 20,
            routeId: group.key,
            routeType: group.routeType,
            source: "gtt",
          }
        : skipToken,
    ),
    staleTime: 60_000,
  });
  const lineAlerts = lineAlertsQuery.data?.alerts ?? [];
  const handleLineAlertsPress = useCallback(() => {
    router.push({
      pathname: "/stop-alerts",
      params: {
        routeId: group.key,
        routeLabel: group.label,
        routeType: group.routeType,
      },
    });
  }, [group.key, group.label, group.routeType]);

  return (
    <>
      <View {...panHandlers} className="gap-4">
        <View className="flex-row items-center gap-3">
          <DrawerIconButton
            accessibilityLabel={t("home.drawer.backAccessibilityLabel")}
            icon="back"
            onPress={onBack}
          />
          <View
            className="h-10 w-10 items-center justify-center rounded-full px-3"
            style={{
              backgroundColor: normalizeRouteColor(group.color),
            }}
          >
            <Host style={{ height: 0, width: 20 }}>
              <Icon
                accessibilityLabel={t("home.drawer.arrivals.line", {
                  line: group.label,
                })}
                color="#ffffff"
                name={routeTypeIcon}
                size={17}
              />
            </Host>
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="text-foreground font-sans text-2xl font-bold"
              numberOfLines={1}
            >
              {t("home.drawer.arrivals.line", { line: group.label })}
            </Text>
            {stopName ? (
              <Text
                className="text-muted-foreground font-sans text-sm"
                numberOfLines={1}
              >
                {stopName}
              </Text>
            ) : null}
          </View>
          {lineAlerts.length > 0 ? (
            <DrawerIconButton
              accessibilityLabel={t("home.drawer.alerts.open")}
              hasBadge
              icon="news"
              onPress={handleLineAlertsPress}
            />
          ) : null}
          <DrawerIconButton
            accessibilityLabel={t("home.drawer.closeAccessibilityLabel")}
            icon="close"
            onPress={onClose ?? onBack}
          />
        </View>
        {lastUpdatedDisplay ? (
          <LastUpdatedTimestamp
            display={lastUpdatedDisplay}
            isRefreshing={isLastUpdatedRefreshing}
          />
        ) : null}
        {isRealtimeDataPending ? (
          <RealtimeDataAlert type="pending" />
        ) : isRealtimeDataStale ? (
          <RealtimeDataAlert type="stale" />
        ) : null}
      </View>

      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ gap: 12, paddingBottom: scrollBottomPadding }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <ServiceAlertList
          alerts={lineAlerts}
          isLoading={lineAlertsQuery.isLoading}
        />
        {showRouteVehicles ? (
          <RouteVehicleList
            followedVehicleId={trackedVehicleId}
            isPending={isRealtimeDataPending}
            onStopFollowing={onStopFollowingVehicle}
            routeLabel={group.label}
            userLocation={userLocation}
            vehicles={routeVehicles}
            onVehiclePress={onRouteVehiclePress}
          />
        ) : null}
        {showArrivalDetails ? (
          <>
            <RealtimeArrivalLegend />
            {group.arrivals.length > 0 ? (
              group.arrivals.map((arrival, index) => (
                <ArrivalDetailRow
                  arrival={arrival}
                  key={`${arrival.tripId}:${arrival.directionId}:${arrival.arrivalSeconds}:${index}`}
                />
              ))
            ) : emptyMessage ? (
              <View className="bg-card rounded-2xl p-4">
                <Text className="text-muted-foreground text-center font-sans text-sm">
                  {emptyMessage}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function ServiceAlertList({
  alerts,
  isLoading,
}: {
  alerts: ServiceAlert[];
  isLoading: boolean;
}) {
  return <HighSeverityServiceAlertList alerts={alerts} isLoading={isLoading} />;
}

function RouteVehicleList({
  followedVehicleId,
  isPending,
  onStopFollowing,
  onVehiclePress,
  routeLabel,
  userLocation,
  vehicles,
}: {
  followedVehicleId?: string | null;
  isPending: boolean;
  onStopFollowing?: () => void;
  onVehiclePress?: (vehicle: RouteVehicle) => void;
  routeLabel: string;
  userLocation?: Coordinates | null;
  vehicles: RouteVehicle[];
}) {
  const { t } = useTranslation();
  const sortedVehicles = useMemo(
    () =>
      sortRouteVehiclesByFollowedAndDistance(
        vehicles,
        followedVehicleId ?? null,
        userLocation ?? null,
      ),
    [followedVehicleId, userLocation, vehicles],
  );

  if (isPending) {
    return <RouteVehicleSkeletonList />;
  }

  if (vehicles.length === 0) {
    return (
      <View className="bg-card rounded-2xl p-4">
        <Text className="text-muted-foreground text-center font-sans text-sm">
          {t("home.drawer.lineDetail.noLiveVehicles")}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {sortedVehicles.map((vehicle) => {
        const isFollowing = vehicle.id === followedVehicleId;

        return (
          <Pressable
            accessibilityLabel={t("home.drawer.lineDetail.focusVehicle", {
              line: routeLabel,
              vehicle: getRouteVehicleLabel(vehicle),
            })}
            accessibilityRole="button"
            className={`border-border flex-row items-center gap-3 rounded-2xl p-3 active:opacity-80 ${
              isFollowing ? "bg-green-100 dark:bg-green-900/60" : "bg-card"
            }`}
            key={`${vehicle.id}:${vehicle.tripId ?? ""}`}
            onPress={() => {
              onVehiclePress?.(vehicle);
            }}
          >
            <View className="bg-primary h-10 min-w-10 items-center justify-center rounded-full px-2">
              <Text
                className="font-sans text-xs font-bold text-white"
                numberOfLines={1}
              >
                {getRouteVehicleBadge(vehicle)}
              </Text>
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-foreground min-w-0 flex-1 font-sans text-base font-bold"
                  numberOfLines={1}
                >
                  {getRouteVehicleLabel(vehicle)}
                </Text>
              </View>
              <Text
                className="text-muted-foreground font-sans text-xs"
                numberOfLines={1}
              >
                {getRouteVehicleDetail(vehicle, t, userLocation ?? null)}
              </Text>
            </View>
            {isFollowing ? (
              <Pressable
                accessibilityLabel={t("home.drawer.lineDetail.stopFollowing")}
                accessibilityRole="button"
                className="rounded-full px-2 py-1 active:opacity-75"
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation();
                  onStopFollowing?.();
                }}
              >
                <Text className="text-primary font-sans text-xs font-bold">
                  {t("home.drawer.lineDetail.stopFollowing")}
                </Text>
              </Pressable>
            ) : (
              <SymbolView
                name={{ ios: "location.fill", android: "location_on" }}
                size={18}
                tintColor="#2563eb"
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function sortRouteVehiclesByFollowedAndDistance(
  vehicles: RouteVehicle[],
  followedVehicleId: string | null,
  userLocation: Coordinates | null,
) {
  return [...vehicles].sort((left, right) => {
    if (left.id === followedVehicleId) {
      return -1;
    }

    if (right.id === followedVehicleId) {
      return 1;
    }

    const leftDistance = getRouteVehicleDistanceMeters(left, userLocation);
    const rightDistance = getRouteVehicleDistanceMeters(right, userLocation);

    if (leftDistance !== null && rightDistance !== null) {
      return leftDistance - rightDistance || left.id.localeCompare(right.id);
    }

    if (leftDistance !== null) {
      return -1;
    }

    if (rightDistance !== null) {
      return 1;
    }

    return (
      (right.timestamp ?? 0) - (left.timestamp ?? 0) ||
      left.id.localeCompare(right.id)
    );
  });
}

function getRouteVehicleBadge(vehicle: RouteVehicle) {
  const label = vehicle.label ?? vehicle.vehicleId ?? vehicle.id;

  return label.slice(0, 3).toLocaleUpperCase("it-IT");
}

function RouteVehicleSkeletonList() {
  return (
    <View className="gap-2">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
        <View
          className="bg-card flex-row items-center gap-3 rounded-2xl p-3"
          key={item}
        >
          <View className="bg-muted h-10 w-12 rounded-full opacity-70" />
          <View className="min-w-0 flex-1 gap-2">
            <View className="bg-muted h-4 w-28 rounded-full opacity-70" />
            <View className="bg-muted h-3 w-40 rounded-full opacity-50" />
          </View>
          <View className="bg-muted h-5 w-5 rounded-full opacity-60" />
        </View>
      ))}
    </View>
  );
}

function getRouteVehicleLabel(vehicle: RouteVehicle) {
  return vehicle.label ?? vehicle.vehicleId ?? vehicle.id;
}

function getRouteVehicleDetail(
  vehicle: RouteVehicle,
  t: Translate,
  userLocation: Coordinates | null,
) {
  const details: string[] = [];
  const distanceMeters = getRouteVehicleDistanceMeters(vehicle, userLocation);

  if (distanceMeters !== null) {
    details.push(
      t("home.drawer.lineDetail.distanceAway", {
        distance: formatVehicleDistance(distanceMeters),
      }),
    );
  }

  if (vehicle.currentStopSequence !== null) {
    details.push(
      t("home.drawer.lineDetail.stopSequence", {
        sequence: vehicle.currentStopSequence,
      }),
    );
  }

  return details.length > 0
    ? details.join(" · ")
    : t("home.drawer.lineDetail.liveVehicle");
}

function getRouteVehicleDistanceMeters(
  vehicle: RouteVehicle,
  userLocation: Coordinates | null,
) {
  if (!userLocation || !hasFiniteCoordinate(userLocation)) {
    return null;
  }

  return getDistanceMeters(userLocation, {
    latitude: vehicle.lat,
    longitude: vehicle.lon,
  });
}

function hasFiniteCoordinate(coordinates: Coordinates): coordinates is LatLon {
  return (
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude)
  );
}

function getDistanceMeters(from: LatLon, to: LatLon) {
  const earthRadiusMeters = 6_371_000;
  const fromLatitudeRadians = toRadians(from.latitude);
  const toLatitudeRadians = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function formatVehicleDistance(distanceMeters: number) {
  if (distanceMeters >= 1_000) {
    return `${(distanceMeters / 1_000).toFixed(distanceMeters >= 10_000 ? 0 : 1)} km`;
  }

  return `${Math.max(1, Math.round(distanceMeters))} m`;
}

function StopServiceAlertList({
  alerts,
  isLoading,
}: {
  alerts: ServiceAlert[];
  isLoading: boolean;
}) {
  return <HighSeverityServiceAlertList alerts={alerts} isLoading={isLoading} />;
}

function HighSeverityServiceAlertList({
  alerts,
  isLoading,
}: {
  alerts: ServiceAlert[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const highSeverityAlerts = useMemo(
    () => sortServiceAlerts(alerts).filter(isHighSeverityAlert),
    [alerts],
  );
  const visibleAlerts = isExpanded
    ? highSeverityAlerts
    : highSeverityAlerts.slice(0, 1);
  const hiddenCount = highSeverityAlerts.length - visibleAlerts.length;

  if (isLoading) {
    return <ServiceAlertSkeleton />;
  }

  if (highSeverityAlerts.length === 0) {
    return null;
  }

  return (
    <View className="gap-2">
      {visibleAlerts.map((alert) => (
        <ServiceAlertCard alert={alert} key={alert.id} />
      ))}
      {hiddenCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          className="self-start rounded-full px-1 py-1 active:opacity-75"
          onPress={() => {
            setIsExpanded(true);
          }}
        >
          <Text className="text-primary font-sans text-sm font-bold">
            {t("home.drawer.alerts.showMore", { count: hiddenCount })}
          </Text>
        </Pressable>
      ) : null}
      <Text className="text-muted-foreground px-1 font-sans text-xs">
        {t("home.drawer.alerts.source")}
      </Text>
    </View>
  );
}

function isHighSeverityAlert(alert: ServiceAlert) {
  return (alert.severityLevel ?? 0) >= 3;
}

function sortServiceAlerts(alerts: ServiceAlert[]) {
  return [...alerts].sort(
    (left, right) =>
      (right.severityLevel ?? 0) - (left.severityLevel ?? 0) ||
      right.lastSeenAt.localeCompare(left.lastSeenAt) ||
      left.id.localeCompare(right.id),
  );
}

function ServiceAlertSkeleton() {
  return (
    <View className="border-border bg-card flex-row items-start gap-3 rounded-2xl border p-3">
      <View className="bg-muted h-5 w-5 rounded-full opacity-70" />
      <View className="min-w-0 flex-1 gap-2">
        <View className="bg-muted h-4 w-40 rounded-full opacity-70" />
        <View className="bg-muted h-3 w-full rounded-full opacity-50" />
      </View>
    </View>
  );
}

function ServiceAlertCard({ alert }: { alert: ServiceAlert }) {
  const { t } = useTranslation();
  const style = getServiceAlertStyle(alert.severityLevel);
  const title = alert.title || t("home.drawer.alerts.title");
  const description = alert.description;

  return (
    <View
      className={`flex-row items-start gap-3 rounded-2xl border p-3 ${style.containerClassName}`}
    >
      <SymbolView
        name={{ ios: style.iconName, android: "warning" }}
        size={18}
        tintColor={style.iconColor}
      />
      <View className="min-w-0 flex-1 gap-1">
        <Text className={`font-sans text-sm font-bold ${style.titleClassName}`}>
          {title}
        </Text>
        {description ? (
          <Text className={`font-sans text-sm ${style.bodyClassName}`}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function getServiceAlertStyle(severityLevel: number | null) {
  if (severityLevel === 4) {
    return {
      bodyClassName: "text-red-900 dark:text-red-100",
      containerClassName:
        "border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-950",
      iconColor: "#dc2626",
      iconName: "exclamationmark.octagon.fill" as const,
      titleClassName: "text-red-950 dark:text-red-50",
    };
  }

  if (severityLevel === 2) {
    return {
      bodyClassName: "text-blue-900 dark:text-blue-100",
      containerClassName:
        "border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-950",
      iconColor: "#2563eb",
      iconName: "info.circle.fill" as const,
      titleClassName: "text-blue-950 dark:text-blue-50",
    };
  }

  return {
    bodyClassName: "text-amber-900 dark:text-amber-100",
    containerClassName:
      "border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-900",
    iconColor: "#d97706",
    iconName: "exclamationmark.triangle.fill" as const,
    titleClassName: "text-amber-950 dark:text-amber-50",
  };
}

function ArrivalDetailRow({ arrival }: { arrival: DisplayArrival }) {
  const { t } = useTranslation();

  return (
    <View
      className={`rounded-2xl border p-4 ${
        arrival.isRealtime
          ? "border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900"
          : "border-border bg-card"
      }`}
    >
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1 gap-1">
          <Text
            className={`font-sans text-lg font-bold ${
              arrival.isRealtime
                ? "text-green-950 dark:text-green-50"
                : "text-foreground"
            }`}
            numberOfLines={1}
          >
            {getArrivalDetail(arrival, t)}
          </Text>
          <Text
            className={`font-sans text-sm ${
              arrival.isRealtime
                ? "text-green-800 dark:text-green-200"
                : "text-muted-foreground"
            }`}
            numberOfLines={1}
          >
            {arrival.isRealtime
              ? t("home.drawer.arrivals.live")
              : t("home.drawer.arrivals.scheduled")}
          </Text>
        </View>
        <Text
          className={`font-sans text-base font-bold tabular-nums ${
            arrival.isRealtime
              ? "text-green-950 dark:text-green-50"
              : "text-foreground"
          }`}
          numberOfLines={1}
        >
          {formatArrivalMinutes(
            arrival.arrivalInSeconds,
            arrival.isRealtime,
            t,
          )}
        </Text>
      </View>
    </View>
  );
}

function LastUpdatedTimestamp({
  display,
  isRefreshing,
}: {
  display: LastUpdatedDisplay;
  isRefreshing: boolean;
}) {
  const modifiers =
    Platform.OS === "ios"
      ? [
          contentTransition("numericText"),
          animation(
            Animation.spring({ response: 0.4, dampingFraction: 0.6 }),
            display.animationValue,
          ),
          frame({ maxWidth: 300, alignment: "leading" }),
        ]
      : undefined;

  return (
    <View className="flex-row items-center gap-2">
      <Host matchContents>
        <NativeText
          modifiers={modifiers}
          numberOfLines={1}
          textStyle={{
            color: "#6b7280",
            fontSize: 12,
            lineHeight: 20,
          }}
        >
          {display.label}
        </NativeText>
      </Host>
      <View className="h-4 w-4 items-center justify-center">
        {isRefreshing ? (
          <ActivityIndicator color="#6b7280" size="small" />
        ) : null}
      </View>
    </View>
  );
}

function RealtimeArrivalLegend() {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center gap-2 px-1">
      <View className="h-3 w-3 rounded-full border border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900" />
      <Text className="text-muted-foreground min-w-0 flex-1 font-sans text-sm">
        {t("home.drawer.arrivals.liveLegend")}
      </Text>
    </View>
  );
}

function RealtimeDataAlert({ type }: { type: "pending" | "stale" }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const iconColor = getWarningForegroundColor(colorScheme);

  const label =
    type === "pending"
      ? t("home.drawer.arrivals.pendingRealtimeData")
      : t("home.drawer.arrivals.staleRealtimeData");

  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-amber-300 bg-amber-100 p-3 dark:border-amber-700 dark:bg-amber-900">
      <View className="h-4.5 w-4.5 items-center justify-center">
        {type === "pending" ? (
          <ActivityIndicator color={iconColor} size="small" />
        ) : (
          <SymbolView
            name={{ ios: "exclamationmark.triangle.fill", android: "warning" }}
            size={18}
            tintColor={iconColor}
          />
        )}
      </View>
      <Text className="min-w-0 flex-1 font-sans text-sm font-semibold text-amber-950 dark:text-amber-50">
        {label}
      </Text>
    </View>
  );
}

function ArrivalLineCard({
  group,
  onPress,
}: {
  group: ArrivalGroup;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const routeTypeIcon = routeTypeIcons[group.routeType];

  return (
    <View className="bg-card rounded-2xl p-4">
      <Pressable
        accessibilityRole="button"
        className="mb-3 flex-row items-center gap-3 active:opacity-85"
        onPress={onPress}
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-full px-2"
          style={{
            backgroundColor: normalizeRouteColor(group.color),
          }}
        >
          <Host style={{ height: 0, width: 20 }}>
            <Icon
              accessibilityLabel={t("home.drawer.arrivals.line", {
                line: group.label,
              })}
              color="#ffffff"
              name={routeTypeIcon}
              size={16}
            />
          </Host>
        </View>

        <Text
          className="text-foreground min-w-0 flex-1 font-sans text-base leading-6 font-bold"
          numberOfLines={1}
        >
          {t("home.drawer.arrivals.line", { line: group.label })}
        </Text>
        <View className="h-9 w-5 items-center justify-center">
          <Host style={{ height: 0, width: 20 }}>
            <Icon color="#9ca3af" name={lineCardChevronIcon} size={18} />
          </Host>
        </View>
      </Pressable>

      <View className="relative" style={{ marginHorizontal: -16 }}>
        <ScrollView
          horizontal
          contentContainerStyle={{ gap: 8 }}
          showsHorizontalScrollIndicator={false}
        >
          {group.arrivals.map((arrival, index) => {
            const isFirst = index === 0;
            const isLast = index === group.arrivals.length - 1;

            return (
              <ArrivalPill
                arrival={arrival}
                isFirst={isFirst}
                isLast={isLast}
                key={`${arrival.tripId}:${arrival.directionId}:${arrival.arrivalSeconds}:${index}`}
              />
            );
          })}
        </ScrollView>
        <PillListEdgeFog side="left" />
        <PillListEdgeFog side="right" />
      </View>
    </View>
  );
}

function PillListEdgeFog({ side }: { side: "left" | "right" }) {
  const opacities =
    side === "left"
      ? ["opacity-90", "opacity-60", "opacity-30"]
      : ["opacity-30", "opacity-60", "opacity-90"];

  return (
    <View
      className={`pointer-events-none absolute top-0 bottom-0 w-6 flex-row ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      {opacities.map((opacity, index) => (
        <View className={`bg-card flex-1 ${opacity}`} key={index} />
      ))}
    </View>
  );
}

function ArrivalPill({
  arrival,
  isFirst,
  isLast,
}: {
  arrival: DisplayArrival;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View
      className={`max-w-44 min-w-28 rounded-2xl border px-3 py-2 ${
        arrival.isRealtime
          ? "border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900"
          : "border-border bg-background"
      }`}
      style={{
        marginLeft: isFirst ? 16 : 0,
        marginRight: isLast ? 16 : 0,
      }}
    >
      <Text
        className={`font-sans text-sm font-bold tabular-nums ${
          arrival.isRealtime
            ? "text-green-950 dark:text-green-50"
            : "text-foreground"
        }`}
        numberOfLines={1}
      >
        {formatArrivalMinutes(arrival.arrivalInSeconds, arrival.isRealtime, t)}
      </Text>
      <Text
        className={`font-sans text-xs ${
          arrival.isRealtime
            ? "text-green-800 dark:text-green-200"
            : "text-muted-foreground"
        }`}
        numberOfLines={1}
      >
        {getArrivalDetail(arrival, t)}
      </Text>
    </View>
  );
}

function ArrivalSkeletonList() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
        <View className="bg-card gap-3 rounded-2xl p-4" key={item}>
          <View className="flex-row items-center gap-3">
            <View className="bg-muted h-9 w-12 rounded-full opacity-70" />
            <View className="bg-muted h-5 w-28 rounded-full opacity-70" />
          </View>
          <View className="flex-row gap-2 overflow-hidden">
            <View className="bg-muted h-12 w-28 rounded-full opacity-60" />
            <View className="bg-muted h-12 w-24 rounded-full opacity-50" />
            <View className="bg-muted h-12 w-32 rounded-full opacity-40" />
          </View>
        </View>
      ))}
    </>
  );
}

function getNearestLiveVehicle(
  group: ArrivalGroup | null,
): TrackedTransitVehicle | null {
  const arrival = group?.arrivals.find(
    (currentArrival) =>
      currentArrival.isRealtime &&
      currentArrival.vehiclePosition &&
      Number.isFinite(currentArrival.vehiclePosition.lat) &&
      Number.isFinite(currentArrival.vehiclePosition.lon),
  );

  if (!arrival?.vehiclePosition || !group) {
    return null;
  }

  return {
    color: group.color,
    coordinates: {
      latitude: arrival.vehiclePosition.lat,
      longitude: arrival.vehiclePosition.lon,
    },
    id: arrival.vehicleId ?? arrival.tripId,
    routeLabel: group.label,
    routeType: group.routeType,
    tripId: arrival.tripId,
  };
}

const styles = StyleSheet.create({
  page: {
    bottom: 0,
    gap: 20,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
