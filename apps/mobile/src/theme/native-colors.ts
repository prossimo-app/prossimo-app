import type { ColorSchemeName } from "react-native";
import { Platform, PlatformColor } from "react-native";

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

export const settingsScreenBackgroundColor = (
  Platform.OS === "ios"
    ? PlatformColor("systemGroupedBackground")
    : Platform.OS === "android"
      ? PlatformColor("?android:attr/colorBackground")
      : "white"
) as string;

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
