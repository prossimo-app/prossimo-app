import type { Coordinates } from "expo-maps";
import type { View as RNView } from "react-native";
import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { toast } from "sonner-native";
import NewspaperIcon from "@expo/material-symbols/newspaper.xml";
import SettingsIcon from "@expo/material-symbols/settings.xml";
import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@prossimo-app/localization";

import type {
  RouteVehicle,
  RouteVehiclesPayload,
  SelectedTransitLine,
  TrackedTransitVehicle,
} from "~/components/home-bottom-drawer/types";
import type { SelectedStop } from "~/components/home-map";
import { analytics } from "~/analytics/analytics";
import { HomeBottomDrawer } from "~/components/home-bottom-drawer";
import { parseRouteVehiclesPayload } from "~/components/home-bottom-drawer/arrival-model";
import { HomeMap } from "~/components/home-map";
import { isWithinTorinoServiceArea } from "~/map/torino-bounds";
import { isImminentStrikeNotice } from "~/news/strike-notices";
import {
  defaultForegroundColor,
  getPrimaryIconColor,
  toolbarButtonBackgroundColor,
  toolbarButtonBorderColor,
} from "~/theme/native-colors";
import { trpc, trpcClient } from "~/utils/api";

export default function Index() {
  const { t } = useTranslation();
  const blurTargetRef = useRef<RNView | null>(null);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const [isDrawerFullHeight, setIsDrawerFullHeight] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [selectedStop, setSelectedStop] = useState<SelectedStop | null>(null);
  const [selectedLine, setSelectedLine] = useState<SelectedTransitLine | null>(
    null,
  );
  const [trackedVehicle, setTrackedVehicle] =
    useState<TrackedTransitVehicle | null>(null);
  const [routeVehiclesPayload, setRouteVehiclesPayload] =
    useState<RouteVehiclesPayload | null>(null);
  const handleStopSelectionChange = (
    stop: SelectedStop | null,
    source: "map" | "search" = "map",
  ) => {
    if (stop) {
      analytics.track("stop_selected", {
        source,
        stop_code: stop.stopCode,
        stop_id: stop.stopId,
        stop_name: stop.stopName,
      });
    }

    setSelectedStop(stop);
    setSelectedLine(null);
    setTrackedVehicle(null);
    setRouteVehiclesPayload(null);
    setIsDrawerExpanded(Boolean(stop));
    setIsDrawerFullHeight(false);
  };
  const handleSelectedLineChange = (line: SelectedTransitLine | null) => {
    if (line) {
      analytics.track("line_selected", {
        route_id: line.routeId,
        route_label: line.routeLabel,
        route_type: line.routeType,
      });
    }

    setSelectedLine(line);
    if (!line) {
      setTrackedVehicle(null);
    }
    setRouteVehiclesPayload(null);
  };
  const handleRouteVehiclePress = (vehicle: RouteVehicle) => {
    if (!selectedLine) {
      return;
    }

    if (!isWithinTorinoServiceArea(vehicle.lat, vehicle.lon)) {
      toast.error(t("home.map.invalidVehiclePositionToast"));
      return;
    }

    analytics.track("vehicle_tracked", {
      route_label: selectedLine.routeLabel,
      route_type: selectedLine.routeType,
    });

    setTrackedVehicle({
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
      tripId: vehicle.tripId,
    });
  };
  const handleStopFollowingVehicle = () => {
    analytics.track("vehicle_tracking_stopped");
    setTrackedVehicle(null);
  };

  useEffect(() => {
    if (!selectedLine) {
      return;
    }

    const routeId = selectedLine.routeId;
    const subscription = trpcClient.realtime.observeTopic.subscribe(
      {
        topic: {
          id: routeId,
          type: "route",
        },
      },
      {
        onData(data) {
          const payload = parseRouteVehiclesPayload(data);

          if (payload?.routeId === routeId) {
            setRouteVehiclesPayload(payload);
            setTrackedVehicle((currentTrackedVehicle) => {
              if (!currentTrackedVehicle) {
                return null;
              }

              const latestVehicle = payload.vehicles.find(
                (vehicle) =>
                  vehicle.id === currentTrackedVehicle.id ||
                  (currentTrackedVehicle.tripId &&
                    vehicle.tripId === currentTrackedVehicle.tripId),
              );

              if (!latestVehicle) {
                return null;
              }

              if (
                !isWithinTorinoServiceArea(latestVehicle.lat, latestVehicle.lon)
              ) {
                return currentTrackedVehicle;
              }

              return {
                ...currentTrackedVehicle,
                bearing: latestVehicle.bearing,
                coordinates: {
                  latitude: latestVehicle.lat,
                  longitude: latestVehicle.lon,
                },
                timestamp: latestVehicle.timestamp,
                tripId: latestVehicle.tripId,
              };
            });
          }
        },
        onError(error) {
          console.warn("Failed to observe route realtime vehicles", error);
        },
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedLine]);

  return (
    <>
      {!isDrawerFullHeight ? <HomeToolbar /> : null}
      <View className="flex-1">
        <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
          <HomeMap
            onLocationChange={setLocation}
            onRouteVehiclePress={handleRouteVehiclePress}
            onStopSelectionChange={handleStopSelectionChange}
            preserveSelectedStopOnLineDetail={Boolean(selectedStop)}
            routeVehiclesPayload={routeVehiclesPayload}
            selectedLine={selectedLine}
            selectedStop={selectedStop}
            trackedVehicle={trackedVehicle}
          />
        </BlurTargetView>
        <HomeBottomDrawer
          blurTarget={blurTargetRef}
          isExpanded={isDrawerExpanded}
          location={location}
          onExpandedChange={setIsDrawerExpanded}
          onFullHeightChange={setIsDrawerFullHeight}
          onRouteVehiclePress={handleRouteVehiclePress}
          onStopFollowingVehicle={handleStopFollowingVehicle}
          onStopSelect={(stop) => {
            handleStopSelectionChange(stop, "search");
          }}
          onSelectedLineChange={handleSelectedLineChange}
          onTrackedVehicleChange={setTrackedVehicle}
          routeVehiclesPayload={routeVehiclesPayload}
          selectedStop={selectedStop}
          trackedVehicle={trackedVehicle}
        />
      </View>
    </>
  );
}

function HomeToolbar() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  // On Android the toolbar doesn't follow the in-app Appearance override, so
  // tint the icons explicitly. iOS resolves its tint natively.
  const toolbarTintColor =
    Platform.OS === "android" ? getPrimaryIconColor(colorScheme) : undefined;
  const newsLabel = t("home.toolbar.news");
  const settingsLabel = t("home.toolbar.settings");
  const newsQuery = useQuery({
    ...trpc.news.getLatest.queryOptions({
      globalNewsLimit: 1,
      strikeLimit: 10,
    }),
    staleTime: 5 * 60 * 1000,
  });
  const hasNewsBadge =
    newsQuery.data?.strikes.some((strike) => isImminentStrikeNotice(strike)) ??
    false;

  if (Platform.OS === "ios" && !isLiquidGlassAvailable()) {
    return (
      <Stack.Toolbar asChild placement="left">
        <View style={styles.fallbackToolbar}>
          <FallbackToolbarButton
            accessibilityLabel={newsLabel}
            hasBadge={hasNewsBadge}
            icon="newspaper"
            onPress={() => {
              router.push("/news");
            }}
          />
          <FallbackToolbarButton
            accessibilityLabel={settingsLabel}
            icon="gearshape"
            onPress={() => {
              router.push("/settings");
            }}
          />
        </View>
      </Stack.Toolbar>
    );
  }

  return (
    <Stack.Toolbar placement="left" tintColor={toolbarTintColor}>
      <Stack.Toolbar.Button
        accessibilityLabel={newsLabel}
        icon={Platform.OS === "ios" ? "newspaper" : NewspaperIcon}
        onPress={() => {
          router.push("/news");
        }}
      >
        {hasNewsBadge ? <Stack.Toolbar.Badge /> : null}
      </Stack.Toolbar.Button>
      <Stack.Toolbar.Button
        accessibilityLabel={settingsLabel}
        icon={Platform.OS === "ios" ? "gearshape" : SettingsIcon}
        onPress={() => {
          router.push("/settings");
        }}
      />
    </Stack.Toolbar>
  );
}

function FallbackToolbarButton({
  accessibilityLabel,
  hasBadge = false,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  hasBadge?: boolean;
  icon: "gearshape" | "newspaper";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fallbackButton,
        pressed && styles.fallbackButtonPressed,
      ]}
    >
      <BlurView
        intensity={70}
        style={StyleSheet.absoluteFill}
        tint="systemMaterial"
      />
      <SymbolView
        name={icon}
        size={18}
        tintColor={defaultForegroundColor}
        weight="semibold"
      />
      {hasBadge ? <View style={styles.fallbackButtonBadge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallbackToolbar: {
    flexDirection: "row",
    gap: 8,
  },
  fallbackButton: {
    alignItems: "center",
    backgroundColor: toolbarButtonBackgroundColor,
    borderColor: toolbarButtonBorderColor,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    width: 34,
  },
  fallbackButtonPressed: {
    opacity: 0.72,
  },
  fallbackButtonBadge: {
    backgroundColor: "#ef4444",
    borderColor: toolbarButtonBackgroundColor,
    borderRadius: 5,
    borderWidth: 1,
    height: 10,
    position: "absolute",
    right: 6,
    top: 5,
    width: 10,
  },
});
