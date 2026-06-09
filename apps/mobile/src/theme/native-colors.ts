import type { ColorSchemeName } from "react-native";
import { Platform, PlatformColor, useColorScheme } from "react-native";

export function getSettingsScreenBackgroundColor(colorScheme: ColorSchemeName) {
  if (Platform.OS === "ios") {
    return colorScheme === "dark" ? "#000000" : "#f2f2f7";
  }

  if (Platform.OS === "android") {
    return colorScheme === "dark" ? "#121212" : "#ffffff";
  }

  return colorScheme === "dark" ? "#000000" : "#ffffff";
}

export function getDefaultBackgroundColor(colorScheme: ColorSchemeName) {
  if (Platform.OS === "ios") {
    return colorScheme === "dark" ? "#000000" : "#ffffff";
  }

  if (Platform.OS === "android") {
    return colorScheme === "dark" ? "#121212" : "#ffffff";
  }

  return colorScheme === "dark" ? "#000000" : "#ffffff";
}

export function getPrimaryIconColor(colorScheme: ColorSchemeName) {
  return colorScheme === "dark" ? "#f9fafb" : "#111827";
}

export const defaultForegroundColor = (
  Platform.OS === "ios"
    ? PlatformColor("label")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/textColorPrimary")
      : "black"
) as string;

export const defaultBackgroundColor = (
  Platform.OS === "ios"
    ? PlatformColor("systemBackground")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/colorBackground")
      : "white"
) as string;

export const settingsScreenBackgroundColor =
  Platform.OS === "ios"
    ? PlatformColor("systemGroupedBackground")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/colorBackground")
      : "white";

export const secondaryCardBackgroundColor = (
  Platform.OS === "ios"
    ? PlatformColor("secondarySystemGroupedBackground")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/colorBackgroundFloating")
      : "white"
) as string;

export const toolbarButtonBackgroundColor = (
  Platform.OS === "ios"
    ? PlatformColor("secondarySystemBackground")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/colorButtonNormal")
      : "white"
) as string;

export const toolbarButtonBorderColor = (
  Platform.OS === "ios"
    ? PlatformColor("separator")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/colorControlNormal")
      : "gray"
) as string;

export function getWarningForegroundColor(colorScheme: ColorSchemeName) {
  return colorScheme === "dark" ? "#fffbeb" : "#92400e";
}

export const secondaryTextColor = (
  Platform.OS === "ios"
    ? PlatformColor("systemGray")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/textColorSecondary")
      : "gray"
) as string;

/**
 * Colors resolved to plain values for use inside `@expo/ui` components.
 *
 * On Android, the Jetpack Compose bridge backing `@expo/ui` views cannot
 * deserialize a `PlatformColor` (it arrives as a native Map and throws
 * "Unknown argument type: Map" / "cannot be cast from ReadableNativeMap"),
 * so we hand it concrete hex strings instead. iOS keeps the dynamic
 * `PlatformColor` values, which SwiftUI resolves natively. The hook reads
 * `useColorScheme()` so the values stay reactive to in-app theme changes.
 */
export interface NativeColors {
  settingsScreenBackgroundColor: string;
  secondaryTextColor: string;
}

function getAndroidSecondaryTextColor(colorScheme: ColorSchemeName) {
  return colorScheme === "dark" ? "#9ca3af" : "#6b7280";
}

export function useNativeColors(): NativeColors {
  const colorScheme = useColorScheme();

  if (Platform.OS === "android") {
    return {
      settingsScreenBackgroundColor:
        getSettingsScreenBackgroundColor(colorScheme),
      secondaryTextColor: getAndroidSecondaryTextColor(colorScheme),
    };
  }

  return {
    settingsScreenBackgroundColor: settingsScreenBackgroundColor as string,
    secondaryTextColor,
  };
}
