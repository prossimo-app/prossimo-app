import type { ConfigContext, ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "Prossimo (Dev)" : "Prossimo",
  slug: "prossimo-app",
  scheme: IS_DEV ? "prossimo-app-dev" : "prossimo-app",
  version: "1.0.1",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  updates: {
    fallbackToCacheTimeout: 0,
  },
  ios: {
    bundleIdentifier: IS_DEV ? "app.prossimo.app.dev" : "app.prossimo.app",
    associatedDomains: ["applinks:prossimo.app", "webcredentials:prossimo.app"],
    supportsTablet: false,
    icon: IS_DEV ? "./assets/icon-dev.png" : "./assets/icon.png",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: IS_DEV ? "app.prossimo.app.dev" : "app.prossimo.app",
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
      },
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "prossimo.app",
            pathPrefix: "/",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    adaptiveIcon: {
      foregroundImage: IS_DEV
        ? "./assets/icon-android-dev.png"
        : "./assets/icon-android.png",
      backgroundColor: "#FEF9E7",
    },
  },
  extra: {
    eas: {
      projectId: "955783d6-f2e3-4982-b4c3-4638135e0794",
    },
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
    reactCanary: true,
    reactCompiler: true,
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-font",
    "expo-secure-store",
    "expo-web-browser",
    "expo-localization",
    "expo-notifications",
    "expo-background-task",
    [
      "expo-updates",
      {
        updates: {
          url: "https://u.expo.dev/955783d6-f2e3-4982-b4c3-4638135e0794",
        },
        runtimeVersion: {
          policy: "appVersion",
        },
      },
    ],
    [
      "expo-tracking-transparency",
      {
        userTrackingPermission:
          "Allow Prossimo to use app activity and device identifiers to measure usage and improve the experience.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow Prossimo to use your location to find nearby stops.",
      },
    ],
    [
      "expo-maps",
      {
        requestLocationPermission: true,
        locationPermission:
          "Allow Prossimo to use your location to find nearby stops.",
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#ffffff",
        image: "./assets/splash-icon-light.png",
        dark: {
          backgroundColor: "#0b0b0b",
          image: "./assets/splash-icon-dark.png",
        },
        imageWidth: 100,
      },
    ],
  ],
});
