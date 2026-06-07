import { Pressable, useColorScheme, View } from "react-native";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { Button, Host } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  frame,
  labelStyle,
} from "@expo/ui/swift-ui/modifiers";

import { getPrimaryIconColor } from "~/theme/native-colors";

type DrawerIconButtonIcon = "back" | "close" | "news";

interface DrawerIconButtonProps {
  accessibilityLabel: string;
  hasBadge?: boolean;
  icon: DrawerIconButtonIcon;
  onPress: () => void;
}

const nativeIcons = {
  back: "chevron.backward",
  close: "xmark",
  news: "newspaper.fill",
} satisfies Record<
  DrawerIconButtonIcon,
  NonNullable<React.ComponentProps<typeof Button>["systemImage"]>
>;

const fallbackIcons = {
  back: { ios: "chevron.backward", android: "chevron_left" },
  close: { ios: "xmark", android: "close" },
  news: { ios: "newspaper.fill", android: "newspaper" },
} as const;

export function DrawerIconButton({
  accessibilityLabel,
  hasBadge = false,
  icon,
  onPress,
}: DrawerIconButtonProps) {
  const colorScheme = useColorScheme();
  const iconColor = getPrimaryIconColor(colorScheme);

  if (isLiquidGlassAvailable()) {
    return (
      <View className="relative">
        <Host matchContents style={{ marginHorizontal: 12 }}>
          <Button
            label={accessibilityLabel}
            modifiers={[
              buttonStyle("glass"),
              controlSize("regular"),
              frame({ height: 24, width: 24 }),
              labelStyle("iconOnly"),
            ]}
            onPress={onPress}
            systemImage={nativeIcons[icon]}
          />
        </Host>
        {hasBadge ? (
          <SymbolView
            name={{ ios: "circle.fill", android: "circle" }}
            size={9}
            tintColor="#ef4444"
            style={{ position: "absolute", right: 9, top: 2 }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="bg-card h-11 w-11 items-center justify-center rounded-full active:opacity-80"
      hitSlop={8}
      onPress={onPress}
    >
      <SymbolView
        name={fallbackIcons[icon]}
        size={icon === "back" ? 22 : 20}
        tintColor={iconColor}
      />
      {hasBadge ? (
        <SymbolView
          name={{ ios: "circle.fill", android: "circle" }}
          size={9}
          tintColor="#ef4444"
          style={{ position: "absolute", right: 9, top: 9 }}
        />
      ) : null}
    </Pressable>
  );
}
