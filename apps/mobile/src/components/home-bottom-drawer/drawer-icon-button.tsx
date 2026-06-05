import { Pressable, useColorScheme } from "react-native";
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

type DrawerIconButtonIcon = "back" | "close";

interface DrawerIconButtonProps {
  accessibilityLabel: string;
  icon: DrawerIconButtonIcon;
  onPress: () => void;
}

const nativeIcons = {
  back: "chevron.backward",
  close: "xmark",
} satisfies Record<
  DrawerIconButtonIcon,
  NonNullable<React.ComponentProps<typeof Button>["systemImage"]>
>;

const fallbackIcons = {
  back: { ios: "chevron.backward", android: "chevron_left" },
  close: { ios: "xmark", android: "close" },
} as const;

export function DrawerIconButton({
  accessibilityLabel,
  icon,
  onPress,
}: DrawerIconButtonProps) {
  const colorScheme = useColorScheme();
  const iconColor = getPrimaryIconColor(colorScheme);

  if (isLiquidGlassAvailable()) {
    return (
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
    </Pressable>
  );
}
