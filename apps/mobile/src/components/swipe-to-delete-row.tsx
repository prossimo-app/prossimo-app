/* eslint-disable react-hooks/immutability -- Reanimated shared values are
   mutated imperatively from gesture and animation callbacks by design. */
import type { PropsWithChildren } from "react";
import { useCallback, useState } from "react";
import { Dimensions, Pressable, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";

const actionWidth = 80;
// Dragging past this fraction of the row width commits the delete, like the
// full swipe in Apple Mail.
const commitFraction = 0.55;
const openVelocityThreshold = -500;
const deleteAnimationDurationMs = 220;
const springConfig = {
  damping: 24,
  mass: 0.9,
  stiffness: 260,
};

interface SwipeToDeleteRowProps {
  closeAccessibilityLabel: string;
  deleteAccessibilityLabel: string;
  onDelete: () => void;
}

export function SwipeToDeleteRow({
  children,
  closeAccessibilityLabel,
  deleteAccessibilityLabel,
  onDelete,
}: PropsWithChildren<SwipeToDeleteRowProps>) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const rowWidth = useSharedValue(Dimensions.get("window").width);
  const rowHeight = useSharedValue(0);
  const isPastCommit = useSharedValue(false);
  const deleteProgress = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(false);

  const triggerCommitHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const startDelete = useCallback(() => {
    setIsOpen(false);
    isPastCommit.value = true;
    translateX.value = withTiming(-rowWidth.value, {
      duration: deleteAnimationDurationMs,
    });
    deleteProgress.value = withTiming(
      1,
      { duration: deleteAnimationDurationMs },
      (finished) => {
        if (finished) {
          runOnJS(onDelete)();
        }
      },
    );
  }, [deleteProgress, isPastCommit, onDelete, rowWidth, translateX]);

  const close = useCallback(() => {
    setIsOpen(false);
    isPastCommit.value = false;
    translateX.value = withSpring(0, springConfig);
  }, [isPastCommit, translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      const nextOffset = Math.min(
        Math.max(startX.value + event.translationX, -rowWidth.value),
        0,
      );
      translateX.value = nextOffset;

      const isPast = nextOffset < -rowWidth.value * commitFraction;

      if (isPast !== isPastCommit.value) {
        isPastCommit.value = isPast;
        runOnJS(triggerCommitHaptic)();
      }
    })
    .onEnd((event) => {
      if (isPastCommit.value) {
        runOnJS(startDelete)();
        return;
      }

      const shouldOpen =
        translateX.value < -actionWidth / 2 ||
        event.velocityX < openVelocityThreshold;

      translateX.value = withSpring(
        shouldOpen ? -actionWidth : 0,
        springConfig,
      );
      runOnJS(setIsOpen)(shouldOpen);
    });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    if (deleteProgress.value === 0 || rowHeight.value === 0) {
      return { opacity: 1 };
    }

    return {
      height: rowHeight.value * (1 - deleteProgress.value),
      opacity: 1 - deleteProgress.value,
    };
  });
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const actionAnimatedStyle = useAnimatedStyle(() => ({
    width: Math.max(-translateX.value, 0),
  }));
  // The trash icon stays pinned to the right edge until the swipe passes the
  // commit threshold, then springs to the leading edge of the red area.
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    right: withSpring(
      isPastCommit.value ? Math.max(-translateX.value - actionWidth, 0) : 0,
      springConfig,
    ),
  }));

  return (
    <Animated.View
      className="relative overflow-hidden"
      style={containerAnimatedStyle}
    >
      <Animated.View
        className="absolute top-0 right-0 bottom-0 overflow-hidden rounded-2xl bg-red-500"
        style={actionAnimatedStyle}
      >
        <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
          <Pressable
            accessibilityLabel={deleteAccessibilityLabel}
            accessibilityRole="button"
            className="h-full w-full items-center justify-center"
            onPress={startDelete}
          >
            <SymbolView
              name={{ ios: "trash.fill", android: "delete" }}
              size={22}
              tintColor="#ffffff"
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(event) => {
            rowWidth.value = event.nativeEvent.layout.width;
            rowHeight.value = event.nativeEvent.layout.height;
          }}
          style={contentAnimatedStyle}
        >
          {children}
        </Animated.View>
      </GestureDetector>
      {isOpen ? (
        <Pressable
          accessibilityLabel={closeAccessibilityLabel}
          accessibilityRole="button"
          onPress={close}
          style={styles.closeOverlay}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  closeOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: actionWidth,
    top: 0,
  },
  iconContainer: {
    bottom: 0,
    position: "absolute",
    top: 0,
    width: actionWidth,
  },
});
