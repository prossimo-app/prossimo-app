import type { Coordinates } from "expo-maps";
import type { ComponentProps, RefObject } from "react";
import type { TextInput } from "react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";

import { useTranslation } from "@prossimo-app/localization";

import type {
  ArrivalGroup,
  DrawerDragHandleProps,
  DrawerNearbyStop,
  RouteVehicle,
  RouteVehiclesPayload,
  ServiceAlert,
  TrackedTransitVehicle,
} from "./types";
import type { SelectedStop } from "~/components/home-map";
import type { TransitLine } from "~/components/transit-line-row";
import { SearchInput } from "~/components/search-input";
import { TransitLineRow } from "~/components/transit-line-row";
import { getLastUpdatedDisplay } from "./arrival-model";
import {
  ArrivalLineDetail,
  SelectedStopDrawerContent,
} from "./selected-stop-drawer-content";

interface DefaultDrawerContentProps extends DrawerDragHandleProps {
  currentTimeMs: number;
  hasMoreLines: boolean;
  hasTodayStrike: boolean;
  isLoadingMoreLines: boolean;
  location?: Coordinates | null;
  lines: TransitLine[];
  nearbyRadiusMeters: number;
  nearbyStops: DrawerNearbyStop[];
  onLinePress: (line: TransitLine) => void;
  onSearchBlur: () => void;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onSearchScrollDismiss: () => void;
  onLineBack: () => void;
  onLoadMoreLines: () => void;
  onRouteVehiclePress?: (vehicle: RouteVehicle) => void;
  onStopFollowingVehicle?: () => void;
  onShowLocationTutorial: () => void;
  onStopArrivalScroll: ComponentProps<
    typeof SelectedStopDrawerContent
  >["onArrivalScroll"];
  onStopBack: () => void;
  onStopLineDetailClose: () => void;
  onStopLineDetailDismiss: () => void;
  onStopLineDetailOpen: () => void;
  onStopPress: (stop: DrawerNearbyStop) => void;
  onStopSelectedLineChange: ComponentProps<
    typeof SelectedStopDrawerContent
  >["onSelectedLineChange"];
  onStopTrackedVehicleChange: ComponentProps<
    typeof SelectedStopDrawerContent
  >["onTrackedVehicleChange"];
  routeVehiclesPayload?: RouteVehiclesPayload | null;
  searchInputRef: RefObject<TextInput | null>;
  searchQuery: string;
  searchResults: DrawerNearbyStop[];
  scrollBottomPadding: number;
  stopDetail: {
    alerts: ServiceAlert[];
    arrivalGroups: ArrivalGroup[];
    isOpen: boolean;
    isLoadingAlerts: boolean;
    isLastUpdatedRefreshing: boolean;
    isRealtimeDataPending: boolean;
    isRealtimeDataStale: boolean;
    isLoading: boolean;
    lastUpdatedAt: string | null;
    selectedStop: SelectedStop | null;
  };
  trackedVehicle?: TrackedTransitVehicle | null;
}

const searchStopPageSize = 10;

export function DefaultDrawerContent({
  currentTimeMs,
  hasMoreLines,
  hasTodayStrike,
  isLoadingMoreLines,
  location = null,
  lines,
  nearbyRadiusMeters,
  nearbyStops,
  onLinePress,
  onSearchBlur,
  onSearchChange,
  onSearchFocus,
  onSearchScrollDismiss,
  onLineBack,
  onLoadMoreLines,
  onRouteVehiclePress,
  onStopFollowingVehicle,
  onShowLocationTutorial,
  onStopArrivalScroll,
  onStopBack,
  onStopLineDetailClose,
  onStopLineDetailDismiss,
  onStopLineDetailOpen,
  onStopPress,
  onStopSelectedLineChange,
  onStopTrackedVehicleChange,
  panHandlers,
  routeVehiclesPayload = null,
  scrollEnabled,
  searchInputRef,
  searchQuery,
  searchResults,
  scrollBottomPadding,
  stopDetail,
  trackedVehicle = null,
}: DefaultDrawerContentProps) {
  const { t } = useTranslation();
  const [pageTransition] = useState(() => new Animated.Value(0));
  const [selectedLine, setSelectedLine] = useState<TransitLine | null>(null);
  const [selectedStop, setSelectedStop] = useState<DrawerNearbyStop | null>(
    null,
  );
  const isSearching = searchQuery.trim().length > 0;
  const [visibleStopCount, setVisibleStopCount] = useState(searchStopPageSize);
  const [previousSearchQuery, setPreviousSearchQuery] = useState(searchQuery);

  if (previousSearchQuery !== searchQuery) {
    setPreviousSearchQuery(searchQuery);
    setVisibleStopCount(searchStopPageSize);
  }

  const displayedStops = isSearching
    ? searchResults.slice(0, visibleStopCount)
    : nearbyStops;
  const hasMoreSearchResults =
    isSearching && searchResults.length > visibleStopCount;
  const displayedStopDetail = stopDetail.selectedStop ?? selectedStop;
  const selectedLineRouteVehiclesPayload =
    selectedLine && routeVehiclesPayload?.routeId === selectedLine.routeId
      ? routeVehiclesPayload
      : null;
  const selectedLineRouteVehiclesFetchedAt =
    selectedLineRouteVehiclesPayload?.fetchedAt ?? null;
  const selectedLineRouteVehiclesFetchedAtMs =
    selectedLineRouteVehiclesFetchedAt
      ? Date.parse(selectedLineRouteVehiclesFetchedAt)
      : Number.NaN;
  const isSelectedLineRouteVehiclesStale =
    Number.isFinite(selectedLineRouteVehiclesFetchedAtMs) &&
    currentTimeMs - selectedLineRouteVehiclesFetchedAtMs > 60_000;
  const isSelectedLineRouteVehiclesPending =
    !selectedLineRouteVehiclesFetchedAt;
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

  useEffect(() => {
    if (!selectedStop || stopDetail.isOpen) {
      return;
    }

    pageTransition.stopAnimation();
    animatePageTransition(0, () => {
      setSelectedStop(null);
    });
  }, [animatePageTransition, pageTransition, selectedStop, stopDetail.isOpen]);

  return (
    <View className="relative min-h-0 flex-1 overflow-hidden">
      <Animated.View
        pointerEvents={selectedLine || selectedStop ? "none" : "auto"}
        style={[styles.page, listPageAnimatedStyle]}
      >
        <View {...panHandlers} className="gap-3">
          <View className="gap-1">
            <Text className="text-foreground font-sans text-2xl font-bold">
              {t("home.drawer.searchTitle")}
            </Text>
            <Text className="text-muted-foreground font-sans text-sm">
              {t("home.drawer.searchSubtitle")}
            </Text>
          </View>
          <SearchInput
            accessibilityLabel={t("home.drawer.globalSearch")}
            onBlur={onSearchBlur}
            onChangeText={onSearchChange}
            onFocus={onSearchFocus}
            placeholder={t("home.drawer.globalSearch")}
            ref={searchInputRef}
            value={searchQuery}
          />
        </View>

        <View
          {...(scrollEnabled ? undefined : panHandlers)}
          className="min-h-0 flex-1"
        >
          <ScrollView
            className="min-h-0 flex-1"
            contentContainerClassName="gap-2 px-2"
            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={onSearchScrollDismiss}
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}
          >
            {hasTodayStrike ? <TodayStrikeAlert /> : null}
            <View className="flex-row items-center gap-2 px-1">
              <Text className="text-foreground flex-1 font-sans text-base font-bold">
                {isSearching
                  ? t("home.drawer.stops")
                  : t("home.drawer.nearbyStops")}
              </Text>
              {!isSearching ? (
                <Text className="text-muted-foreground font-sans text-xs font-semibold">
                  {t("home.drawer.nearbyRadius", {
                    distance: formatDistance(nearbyRadiusMeters),
                  })}
                </Text>
              ) : null}
            </View>

            {displayedStops.length > 0 ? (
              displayedStops.map((stop) => (
                <StopRow
                  key={stop.stopId}
                  onPress={(selectedStop) => {
                    pageTransition.stopAnimation();
                    setSelectedStop(selectedStop);
                    onStopPress(selectedStop);
                    animatePageTransition(1);
                  }}
                  stop={stop}
                />
              ))
            ) : (
              <View className="bg-card rounded-2xl px-4 py-5">
                <Text className="text-foreground font-sans text-base font-bold">
                  {isSearching
                    ? t("home.drawer.noMatchingStops")
                    : t("home.drawer.noNearbyStops")}
                </Text>
                <Text className="text-muted-foreground mt-1 font-sans text-sm">
                  {isSearching
                    ? t("home.drawer.noMatchingStopsDescription")
                    : t("home.drawer.noNearbyStopsDescription")}
                </Text>
                {!isSearching ? (
                  <Pressable
                    accessibilityRole="button"
                    className="mt-4 self-start rounded-full px-0 py-1 active:opacity-70"
                    onPress={onShowLocationTutorial}
                  >
                    <Text className="text-primary font-sans text-sm font-bold">
                      {t("home.drawer.locationTutorialAction")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {hasMoreSearchResults ? (
              <Pressable
                accessibilityRole="button"
                className="py-2 active:opacity-80"
                onPress={() => {
                  setVisibleStopCount(
                    (currentCount) => currentCount + searchStopPageSize,
                  );
                }}
              >
                <Text className="text-primary text-center font-sans text-base font-bold">
                  {t("home.drawer.loadMoreStops")}
                </Text>
              </Pressable>
            ) : null}

            <View className="mt-4 gap-3">
              <View className="gap-1 px-1">
                <Text className="text-foreground font-sans text-base font-bold">
                  {t("home.drawer.lines")}
                </Text>
                <Text className="text-muted-foreground font-sans text-sm">
                  {isSearching
                    ? t("home.drawer.matchingLinesDescription")
                    : t("home.drawer.linesDescription")}
                </Text>
              </View>
            </View>

            {lines.length > 0 ? (
              lines.map((line) => (
                <TransitLineRow
                  key={line.routeId}
                  line={line}
                  onPress={(selectedLine) => {
                    pageTransition.stopAnimation();
                    setSelectedLine(selectedLine);
                    onLinePress(selectedLine);
                    animatePageTransition(1);
                  }}
                />
              ))
            ) : (
              <View className="bg-card rounded-2xl px-4 py-5">
                <Text className="text-foreground font-sans text-base font-bold">
                  {isSearching
                    ? t("home.drawer.noMatchingLines")
                    : t("home.drawer.noLines")}
                </Text>
                <Text className="text-muted-foreground mt-1 font-sans text-sm">
                  {isSearching
                    ? t("home.drawer.noMatchingLinesDescription")
                    : t("home.drawer.noLinesDescription")}
                </Text>
              </View>
            )}

            {hasMoreLines ? (
              <Pressable
                accessibilityRole="button"
                className="py-4 active:opacity-80"
                disabled={isLoadingMoreLines}
                onPress={onLoadMoreLines}
              >
                {isLoadingMoreLines ? (
                  <ActivityIndicator color="#2563eb" />
                ) : (
                  <Text className="text-primary text-center font-sans text-base font-bold">
                    {t("home.drawer.loadMoreLines")}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </Animated.View>

      {selectedLine ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.page, detailPageAnimatedStyle]}
        >
          <ArrivalLineDetail
            emptyMessage={t("home.drawer.lineDetail.empty")}
            group={createArrivalGroupFromLine(selectedLine)}
            isLastUpdatedRefreshing={false}
            isRealtimeDataPending={isSelectedLineRouteVehiclesPending}
            isRealtimeDataStale={isSelectedLineRouteVehiclesStale}
            lastUpdatedDisplay={getLastUpdatedDisplay(
              selectedLineRouteVehiclesFetchedAt,
              t,
            )}
            onBack={() => {
              pageTransition.stopAnimation();
              onLineBack();
              animatePageTransition(0, () => {
                setSelectedLine(null);
              });
            }}
            onClose={() => {
              pageTransition.stopAnimation();
              onLineBack();
              animatePageTransition(0, () => {
                setSelectedLine(null);
              });
            }}
            onRouteVehiclePress={onRouteVehiclePress}
            onScroll={noop}
            onStopFollowingVehicle={onStopFollowingVehicle}
            panHandlers={panHandlers}
            scrollEnabled={scrollEnabled}
            routeVehicles={selectedLineRouteVehiclesPayload?.vehicles ?? []}
            scrollBottomPadding={scrollBottomPadding}
            showArrivalDetails={false}
            stopName={null}
            trackedVehicleId={trackedVehicle?.id ?? null}
            userLocation={location}
          />
        </Animated.View>
      ) : null}

      {displayedStopDetail ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.page, detailPageAnimatedStyle]}
        >
          <SelectedStopDrawerContent
            alerts={stopDetail.alerts}
            arrivalGroups={stopDetail.arrivalGroups}
            isLoading={stopDetail.isLoading}
            isLoadingAlerts={stopDetail.isLoadingAlerts}
            isLastUpdatedRefreshing={stopDetail.isLastUpdatedRefreshing}
            isRealtimeDataPending={stopDetail.isRealtimeDataPending}
            isRealtimeDataStale={stopDetail.isRealtimeDataStale}
            lastUpdatedAt={stopDetail.lastUpdatedAt}
            onArrivalScroll={onStopArrivalScroll}
            onBack={() => {
              pageTransition.stopAnimation();
              onStopBack();
              animatePageTransition(0, () => {
                setSelectedStop(null);
              });
            }}
            onLineDetailClose={onStopLineDetailClose}
            onLineDetailDismiss={onStopLineDetailDismiss}
            onLineDetailOpen={onStopLineDetailOpen}
            onSearchBlur={onSearchBlur}
            onSearchFocus={onSearchFocus}
            onSearchScrollDismiss={onSearchScrollDismiss}
            onSelectedLineChange={onStopSelectedLineChange}
            onTrackedVehicleChange={onStopTrackedVehicleChange}
            panHandlers={panHandlers}
            scrollEnabled={scrollEnabled}
            searchInputRef={searchInputRef}
            scrollBottomPadding={scrollBottomPadding}
            stopCode={displayedStopDetail.stopCode}
            stopId={displayedStopDetail.stopId}
            stopName={displayedStopDetail.stopName}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function createArrivalGroupFromLine(line: TransitLine): ArrivalGroup {
  return {
    arrivals: [],
    color: line.color,
    key: line.routeId,
    label: line.shortName,
    routeType: line.type,
  };
}

function noop() {
  return undefined;
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

function TodayStrikeAlert() {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl bg-red-50 px-4 py-3.5 active:opacity-80 dark:bg-red-950/40"
      onPress={() => {
        router.push("/news");
      }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500">
        <SymbolView
          name={{ ios: "exclamationmark.triangle.fill", android: "warning" }}
          size={20}
          tintColor="white"
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans text-sm font-bold text-red-600 dark:text-red-400">
          {t("home.drawer.strikeAlert.title")}
        </Text>
        <Text
          className="font-sans text-xs text-red-600/80 dark:text-red-400/80"
          numberOfLines={2}
        >
          {t("home.drawer.strikeAlert.description")}
        </Text>
      </View>
      <SymbolView
        name={{ ios: "chevron.forward", android: "chevron_right" }}
        size={14}
        tintColor="#dc2626"
      />
    </Pressable>
  );
}

function StopRow({
  onPress,
  stop,
}: {
  onPress: (stop: DrawerNearbyStop) => void;
  stop: DrawerNearbyStop;
}) {
  const { t } = useTranslation();
  const routeLabels = stop.routes
    .map((route) => route.shortName)
    .filter(Boolean)
    .slice(0, 4);
  const distanceLabel = Number.isFinite(stop.distanceMeters)
    ? formatDistance(stop.distanceMeters)
    : null;

  return (
    <Pressable
      accessibilityLabel={stop.stopName}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl px-1 py-2 active:opacity-75"
      onPress={() => {
        onPress(stop);
      }}
    >
      <View className="bg-card h-11 w-11 items-center justify-center rounded-full">
        <SymbolView
          name={{ ios: "mappin.circle.fill", android: "location_on" }}
          size={23}
          tintColor="#2563eb"
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-foreground font-sans text-base font-semibold"
          numberOfLines={1}
        >
          {stop.stopName}
        </Text>
        <Text
          className="text-muted-foreground font-sans text-sm"
          numberOfLines={1}
        >
          {routeLabels.length > 0
            ? t("home.drawer.stopRoutes", { routes: routeLabels.join(", ") })
            : t("home.drawer.stop")}
        </Text>
      </View>
      {distanceLabel ? (
        <Text className="text-muted-foreground font-sans text-sm font-medium">
          {distanceLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters >= 1_000) {
    return `${(distanceMeters / 1_000).toFixed(1)} km`;
  }

  return `${Math.max(Math.round(distanceMeters), 0)} m`;
}
