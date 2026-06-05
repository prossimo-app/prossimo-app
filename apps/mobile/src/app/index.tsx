import type { Coordinates } from "expo-maps";
import type { View as RNView } from "react-native";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import NewspaperIcon from "@expo/material-symbols/newspaper.xml";
import SettingsIcon from "@expo/material-symbols/settings.xml";

import { useTranslation } from "@prossimo-app/localization";

import type {
  SelectedTransitLine,
  TrackedTransitVehicle,
} from "~/components/home-bottom-drawer/types";
import type { SelectedStop } from "~/components/home-map";
import { HomeBottomDrawer } from "~/components/home-bottom-drawer";
import { HomeMap } from "~/components/home-map";
import {
  defaultForegroundColor,
  toolbarButtonBackgroundColor,
  toolbarButtonBorderColor,
} from "~/theme/native-colors";

export default function Index() {
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
  const handleStopSelectionChange = (stop: SelectedStop | null) => {
    setSelectedStop(stop);
    setSelectedLine(null);
    setTrackedVehicle(null);
    setIsDrawerExpanded(Boolean(stop));
    setIsDrawerFullHeight(false);
  };

  return (
    <>
      {!isDrawerFullHeight ? <HomeToolbar /> : null}
      <View className="flex-1">
        <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
          <HomeMap
            onLocationChange={setLocation}
            onStopSelectionChange={handleStopSelectionChange}
            preserveSelectedStopOnLineDetail={Boolean(selectedStop)}
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
          onStopSelect={handleStopSelectionChange}
          onSelectedLineChange={setSelectedLine}
          onTrackedVehicleChange={setTrackedVehicle}
          selectedStop={selectedStop}
        />
      </View>
    </>
  );
}

function HomeToolbar() {
  const { t } = useTranslation();
  const newsLabel = t("home.toolbar.news");
  const settingsLabel = t("home.toolbar.settings");

  if (Platform.OS === "ios" && !isLiquidGlassAvailable()) {
    return (
      <Stack.Toolbar asChild placement="left">
        <View style={styles.fallbackToolbar}>
          <FallbackToolbarButton
            accessibilityLabel={newsLabel}
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
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        accessibilityLabel={newsLabel}
        icon={Platform.OS === "ios" ? "newspaper" : NewspaperIcon}
        onPress={() => {
          router.push("/news");
        }}
      />
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
  icon,
  onPress,
}: {
  accessibilityLabel: string;
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
});
