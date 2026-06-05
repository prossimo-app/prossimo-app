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

import { useTranslation } from "@prossimo-app/localization";

import type {
  ArrivalGroup,
  DisplayArrival,
  LastUpdatedDisplay,
  RouteType,
  SelectedStopDrawerContentProps,
  TrackedTransitVehicle,
} from "./types";
import { SearchInput } from "~/components/search-input";
import { getWarningForegroundColor } from "~/theme/native-colors";
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

export function SelectedStopDrawerContent({
  arrivalGroups,
  isLoading,
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
          filteredArrivalGroups={filteredArrivalGroups}
          isFiltering={isFiltering}
          isLastUpdatedRefreshing={isLastUpdatedRefreshing}
          isLoading={isLoading}
          isRealtimeDataPending={isRealtimeDataPending}
          isRealtimeDataStale={isRealtimeDataStale}
          lastUpdatedDisplay={lastUpdatedDisplay}
          lineSearchQuery={lineSearchQuery}
          onArrivalScroll={onArrivalScroll}
          onBack={onBack}
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
            stopName={stopName}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function ArrivalLineList({
  filteredArrivalGroups,
  isFiltering,
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
  panHandlers,
  searchInputRef,
  scrollBottomPadding,
  stopName,
}: {
  filteredArrivalGroups: ArrivalGroup[];
  isFiltering: boolean;
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
  onScroll,
  panHandlers,
  scrollBottomPadding,
  stopName,
}: {
  emptyMessage?: string;
  group: ArrivalGroup;
  isLastUpdatedRefreshing: boolean;
  isRealtimeDataPending: boolean;
  isRealtimeDataStale: boolean;
  lastUpdatedDisplay: LastUpdatedDisplay | null;
  onBack: () => void;
  onClose?: () => void;
  onScroll: SelectedStopDrawerContentProps["onArrivalScroll"];
  panHandlers: GestureResponderHandlers;
  scrollBottomPadding: number;
  stopName?: string | null;
}) {
  const { t } = useTranslation();
  const routeTypeIcon = routeTypeIcons[group.routeType];

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
            className="h-10 min-w-12 items-center justify-center rounded-full px-3"
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
        <RealtimeArrivalLegend />
      </View>

      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ gap: 12, paddingBottom: scrollBottomPadding }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </>
  );
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
              arrival.isRealtime ? "text-green-950" : "text-foreground"
            }`}
            numberOfLines={1}
          >
            {getArrivalDetail(arrival, t)}
          </Text>
          <Text
            className={`font-sans text-sm ${
              arrival.isRealtime ? "text-green-800" : "text-muted-foreground"
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
            arrival.isRealtime ? "text-green-950" : "text-foreground"
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

  const label =
    type === "pending"
      ? t("home.drawer.arrivals.pendingRealtimeData")
      : t("home.drawer.arrivals.staleRealtimeData");

  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-amber-300 bg-amber-100 p-3 dark:border-amber-700 dark:bg-amber-900">
      <SymbolView
        name={{ ios: "exclamationmark.triangle.fill", android: "warning" }}
        size={18}
        tintColor={getWarningForegroundColor(colorScheme)}
      />
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
          className="h-9 min-w-10 items-center justify-center rounded-full px-2"
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
          arrival.isRealtime ? "text-green-950" : "text-foreground"
        }`}
        numberOfLines={1}
      >
        {formatArrivalMinutes(arrival.arrivalInSeconds, arrival.isRealtime, t)}
      </Text>
      <Text
        className={`font-sans text-xs ${
          arrival.isRealtime ? "text-green-800" : "text-muted-foreground"
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
      {[0, 1, 2].map((item) => (
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
