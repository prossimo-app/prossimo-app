import { Platform, Pressable, Text, View } from "react-native";
import BusIcon from "@expo/material-symbols/directions_bus.xml";
import SubwayIcon from "@expo/material-symbols/subway.xml";
import TrainIcon from "@expo/material-symbols/train.xml";
import TramIcon from "@expo/material-symbols/tram.xml";
import { Host, Icon } from "@expo/ui";

import { useTranslation } from "@prossimo-app/localization";

import type { RouteType } from "./home-bottom-drawer/types";
import type { RouterOutputs } from "~/utils/api";
import { normalizeRouteColor } from "./home-bottom-drawer/arrival-model";

export type TransitLine =
  RouterOutputs["transit"]["getRoutes"]["routes"][number];

// Compose clips the icon to the Host bounds on Android, so it needs a real
// height; the SwiftUI Host on iOS draws the icon centered on a zero-height line.
const iconHostStyle = {
  height: Platform.OS === "android" ? 20 : 0,
  width: 20,
} as const;

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

interface TransitLineRowProps {
  line: TransitLine;
  onPress?: (line: TransitLine) => void;
}

export function TransitLineRow({ line, onPress }: TransitLineRowProps) {
  const { t } = useTranslation();
  const lineLabel = t("home.drawer.arrivals.line", { line: line.shortName });
  const routeTypeIcon = routeTypeIcons[line.type];
  const content = (
    <>
      <View
        className="h-10 w-10 items-center justify-center rounded-full px-3"
        style={{
          backgroundColor: normalizeRouteColor(line.color),
        }}
      >
        <Host style={iconHostStyle}>
          <Icon
            accessibilityLabel={lineLabel}
            color="#ffffff"
            name={routeTypeIcon}
            size={17}
          />
        </Host>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-foreground font-sans text-base font-bold"
          numberOfLines={1}
        >
          {lineLabel}
        </Text>
        <Text
          className="text-muted-foreground font-sans text-sm"
          numberOfLines={1}
        >
          {line.longName ?? t(`home.drawer.lineTypes.${line.type}`)}
        </Text>
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View className="flex-row items-center gap-3 px-1 py-2">{content}</View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={lineLabel}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl px-1 py-2 active:opacity-75"
      onPress={() => {
        onPress(line);
      }}
    >
      {content}
    </Pressable>
  );
}
