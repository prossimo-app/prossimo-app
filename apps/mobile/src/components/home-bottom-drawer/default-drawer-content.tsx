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
import { SymbolView } from "expo-symbols";

import { useTranslation } from "@prossimo-app/localization";

import type {
  ArrivalGroup,
  DrawerDragHandleProps,
  DrawerNearbyStop,
} from "./types";
import type { SelectedStop } from "~/components/home-map";
import type { TransitLine } from "~/components/transit-line-row";
import { SearchInput } from "~/components/search-input";
import { TransitLineRow } from "~/components/transit-line-row";
import {
  ArrivalLineDetail,
  SelectedStopDrawerContent,
} from "./selected-stop-drawer-content";

interface DefaultDrawerContentProps extends DrawerDragHandleProps {
  hasMoreLines: boolean;
  isLoadingMoreLines: boolean;
  lines: TransitLine[];
  nearbyRadiusMeters: number;
  nearbyStops: DrawerNearbyStop[];
  onLinePress: (line: TransitLine) => void;
  onSearchBlur: () => void;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onLineBack: () => void;
  onLoadMoreLines: () => void;
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
  searchInputRef: RefObject<TextInput | null>;
  searchQuery: string;
  searchResults: DrawerNearbyStop[];
  scrollBottomPadding: number;
  stopDetail: {
    arrivalGroups: ArrivalGroup[];
    isOpen: boolean;
    isLastUpdatedRefreshing: boolean;
    isRealtimeDataPending: boolean;
    isRealtimeDataStale: boolean;
    isLoading: boolean;
    lastUpdatedAt: string | null;
    selectedStop: SelectedStop | null;
  };
}

export function DefaultDrawerContent({
  hasMoreLines,
  isLoadingMoreLines,
  lines,
  nearbyRadiusMeters,
  nearbyStops,
  onLinePress,
  onSearchBlur,
  onSearchChange,
  onSearchFocus,
  onLineBack,
  onLoadMoreLines,
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
  searchInputRef,
  searchQuery,
  searchResults,
  scrollBottomPadding,
  stopDetail,
}: DefaultDrawerContentProps) {
  const { t } = useTranslation();
  const [pageTransition] = useState(() => new Animated.Value(0));
  const [selectedLine, setSelectedLine] = useState<TransitLine | null>(null);
  const [selectedStop, setSelectedStop] = useState<DrawerNearbyStop | null>(
    null,
  );
  const isSearching = searchQuery.trim().length > 0;
  const displayedStops = isSearching ? searchResults : nearbyStops;
  const displayedStopDetail = stopDetail.selectedStop ?? selectedStop;
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

        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-2 px-2"
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
            isRealtimeDataPending={false}
            isRealtimeDataStale={false}
            lastUpdatedDisplay={null}
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
            onScroll={noop}
            panHandlers={panHandlers}
            scrollBottomPadding={scrollBottomPadding}
            stopName={null}
          />
        </Animated.View>
      ) : null}

      {displayedStopDetail ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.page, detailPageAnimatedStyle]}
        >
          <SelectedStopDrawerContent
            arrivalGroups={stopDetail.arrivalGroups}
            isLoading={stopDetail.isLoading}
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
            onSelectedLineChange={onStopSelectedLineChange}
            onTrackedVehicleChange={onStopTrackedVehicleChange}
            panHandlers={panHandlers}
            searchInputRef={searchInputRef}
            scrollBottomPadding={scrollBottomPadding}
            stopCode={displayedStopDetail.stopCode}
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
