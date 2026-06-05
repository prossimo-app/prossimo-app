import type { ReactNode } from "react";
import type {
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import { StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";

import { SpringPressable } from "~/components/spring-pressable";
import { themeColors } from "~/theme/colors";

type AppButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  className?: string;
  hapticsEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textClassName?: string;
  textStyle?: StyleProp<TextStyle>;
};

export function AppButton({
  children,
  className,
  disabled,
  hapticsEnabled = true,
  onPressIn,
  style,
  textClassName,
  textStyle,
  ...pressableProps
}: AppButtonProps) {
  const isDisabled = disabled ?? false;

  return (
    <SpringPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      className={`bg-primary min-h-14 items-center justify-center rounded-2xl px-5 ${
        isDisabled ? "opacity-50" : ""
      } ${className ?? ""}`}
      disabled={isDisabled}
      onPressIn={(event) => {
        if (hapticsEnabled && !isDisabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        onPressIn?.(event);
      }}
      pressedScale={0.98}
      style={[style]}
      {...pressableProps}
    >
      <Text
        className={`font-sans text-base font-bold ${
          textClassName ?? "text-primary-foreground"
        }`}
        numberOfLines={1}
        style={textStyle}
      >
        {children}
      </Text>
    </SpringPressable>
  );
}
