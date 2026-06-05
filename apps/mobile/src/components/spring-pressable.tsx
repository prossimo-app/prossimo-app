import type { ReactNode } from "react";
import type {
  PressableProps,
  PressableStateCallbackType,
  View as RNView,
} from "react-native";
import type { WithSpringConfig } from "react-native-reanimated";
import { forwardRef, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const pressSpringConfig: WithSpringConfig = {
  damping: 18,
  mass: 0.6,
  stiffness: 260,
};

type SpringPressableProps = PressableProps & {
  pressedScale?: number;
  trailingAccessory?: ReactNode;
};

export const SpringPressable = forwardRef<RNView, SpringPressableProps>(
  (
    {
      children,
      onPressIn,
      onPressOut,
      pressedScale = 0.97,
      style,
      trailingAccessory,
      ...pressableProps
    },
    ref,
  ) => {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback<NonNullable<PressableProps["onPressIn"]>>(
      (event) => {
        scale.value = withSpring(pressedScale, pressSpringConfig);
        onPressIn?.(event);
      },
      [onPressIn, pressedScale, scale],
    );

    const handlePressOut = useCallback<
      NonNullable<PressableProps["onPressOut"]>
    >(
      (event) => {
        scale.value = withSpring(1, pressSpringConfig);
        onPressOut?.(event);
      },
      [onPressOut, scale],
    );

    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          ref={ref}
          {...pressableProps}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={style}
        >
          {(state: PressableStateCallbackType) => {
            const content =
              typeof children === "function" ? children(state) : children;

            return trailingAccessory ? (
              <View style={styles.content}>
                <View style={styles.children}>{content}</View>
                <View style={styles.trailingAccessory}>
                  {trailingAccessory}
                </View>
              </View>
            ) : (
              content
            );
          }}
        </Pressable>
      </Animated.View>
    );
  },
);

SpringPressable.displayName = "SpringPressable";

const styles = StyleSheet.create({
  children: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  trailingAccessory: {
    alignItems: "center",
    justifyContent: "center",
  },
});
