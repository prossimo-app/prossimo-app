import type { PermissionResponse } from "expo-tracking-transparency";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, AppState } from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";

import type { SupportedLanguage } from "@prossimo-app/localization";
import { i18n, normalizeLanguage } from "@prossimo-app/localization";

const shareAppUsageStorageKey = "settings.shareAppUsage";
const languageStorageKey = "settings.language";
const themeStorageKey = "settings.theme";

export const themeOptions = ["system", "dark", "light"] as const;

export type ThemeOption = (typeof themeOptions)[number];

interface SettingsContextValue {
  hasLoadedSettings: boolean;
  locationPermission: Location.LocationPermissionResponse | null;
  isLocationPermissionGranted: boolean;
  isLocationSharingEnabled: boolean;
  trackingPermission: PermissionResponse | null;
  isShareAppUsageEnabled: boolean;
  language: SupportedLanguage;
  theme: ThemeOption;
  setIsShareAppUsageEnabled: (value: boolean) => Promise<void>;
  setLanguage: (value: SupportedLanguage) => Promise<void>;
  setTheme: (value: ThemeOption) => Promise<void>;
  refreshLocationPermission: () => Promise<Location.LocationPermissionResponse>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function normalizeTheme(theme?: string | null): ThemeOption {
  if (themeOptions.includes(theme as ThemeOption)) {
    return theme as ThemeOption;
  }

  return "system";
}

function applyTheme(theme: ThemeOption) {
  Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [locationPermission, setLocationPermission] =
    useState<Location.LocationPermissionResponse | null>(null);
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] =
    useState(false);
  const [isLocationSharingEnabled, setIsLocationSharingEnabled] =
    useState(false);
  const [trackingPermission, setTrackingPermission] =
    useState<PermissionResponse | null>(null);
  const [isShareAppUsageEnabled, setIsShareAppUsageEnabledState] =
    useState(false);
  const [language, setLanguageState] = useState<SupportedLanguage>(
    normalizeLanguage(i18n.language),
  );
  const [theme, setThemeState] = useState<ThemeOption>("system");

  const refreshLocationPermission = useCallback(async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    const isGranted = permission.status === Location.PermissionStatus.GRANTED;

    setLocationPermission(permission);
    setIsLocationPermissionGranted(isGranted);
    setIsLocationSharingEnabled(isGranted);

    return permission;
  }, []);

  const refreshTrackingPermission = useCallback(async () => {
    const permission = await getTrackingPermissionsAsync();
    const isGranted = permission.status === PermissionStatus.GRANTED;

    setTrackingPermission(permission);
    setIsShareAppUsageEnabledState(isGranted);

    if (!isGranted) {
      await SecureStore.setItemAsync(shareAppUsageStorageKey, "false");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const [
          savedLanguage,
          savedTheme,
          locationPermission,
          trackingPermission,
        ] = await Promise.all([
          SecureStore.getItemAsync(languageStorageKey),
          SecureStore.getItemAsync(themeStorageKey),
          Location.getForegroundPermissionsAsync(),
          getTrackingPermissionsAsync(),
        ]);

        if (!isMounted) {
          return;
        }

        const nextLanguage = normalizeLanguage(savedLanguage ?? i18n.language);
        const nextTheme = normalizeTheme(savedTheme);

        setLanguageState(nextLanguage);
        setThemeState(nextTheme);
        await i18n.changeLanguage(nextLanguage);
        applyTheme(nextTheme);
        setIsShareAppUsageEnabledState(
          trackingPermission.status === PermissionStatus.GRANTED,
        );
        setTrackingPermission(trackingPermission);
        const isLocationGranted =
          locationPermission.status === Location.PermissionStatus.GRANTED;
        setLocationPermission(locationPermission);
        setIsLocationSharingEnabled(isLocationGranted);
        setIsLocationPermissionGranted(isLocationGranted);
      } finally {
        if (isMounted) {
          setHasLoadedSettings(true);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshLocationPermission();
        void refreshTrackingPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshLocationPermission, refreshTrackingPermission]);

  const setIsShareAppUsageEnabled = useCallback(async (value: boolean) => {
    if (!value) {
      await SecureStore.setItemAsync(shareAppUsageStorageKey, "false");
      setIsShareAppUsageEnabledState(false);
      return;
    }

    const currentPermission = await getTrackingPermissionsAsync();
    const permission =
      currentPermission.status === PermissionStatus.GRANTED
        ? currentPermission
        : await requestTrackingPermissionsAsync();
    const isGranted = permission.status === PermissionStatus.GRANTED;

    await SecureStore.setItemAsync(shareAppUsageStorageKey, String(isGranted));
    setTrackingPermission(permission);
    setIsShareAppUsageEnabledState(isGranted);
  }, []);

  const setLanguage = useCallback(async (value: SupportedLanguage) => {
    await SecureStore.setItemAsync(languageStorageKey, value);
    await i18n.changeLanguage(value);
    setLanguageState(value);
  }, []);

  const setTheme = useCallback(async (value: ThemeOption) => {
    await SecureStore.setItemAsync(themeStorageKey, value);
    applyTheme(value);
    setThemeState(value);
  }, []);

  const value = useMemo(
    () => ({
      hasLoadedSettings,
      locationPermission,
      isLocationPermissionGranted,
      isLocationSharingEnabled,
      trackingPermission,
      isShareAppUsageEnabled,
      language,
      theme,
      setIsShareAppUsageEnabled,
      setLanguage,
      setTheme,
      refreshLocationPermission,
    }),
    [
      hasLoadedSettings,
      locationPermission,
      isLocationPermissionGranted,
      isLocationSharingEnabled,
      trackingPermission,
      isShareAppUsageEnabled,
      language,
      theme,
      setIsShareAppUsageEnabled,
      setLanguage,
      setTheme,
      refreshLocationPermission,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (context === null) {
    throw new Error("useSettings must be used within SettingsProvider");
  }

  return context;
}
