import "../../global.css";

import type { StatusBarStyle } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { ObserveRoot } from "expo-observe";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  InstrumentSans_400Regular,
  InstrumentSans_400Regular_Italic,
  InstrumentSans_500Medium,
  InstrumentSans_500Medium_Italic,
  InstrumentSans_600SemiBold,
  InstrumentSans_600SemiBold_Italic,
  InstrumentSans_700Bold,
  InstrumentSans_700Bold_Italic,
} from "@expo-google-fonts/instrument-sans";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner-native";

import { useTranslation } from "@prossimo-app/localization";

import {
  AppBootstrapProvider,
  useAppBootstrap,
} from "~/app-bootstrap/app-bootstrap-provider";
import {
  OnboardingProvider,
  useOnboarding,
} from "~/onboarding/onboarding-provider";
import { SettingsProvider, useSettings } from "~/settings/settings-provider";
import {
  getPrimaryIconColor,
  getSettingsScreenBackgroundColor,
  settingsScreenBackgroundColor,
} from "~/theme/native-colors";
import { queryClient } from "~/utils/api";

void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_400Regular_Italic,
    InstrumentSans_500Medium,
    InstrumentSans_500Medium_Italic,
    InstrumentSans_600SemiBold,
    InstrumentSans_600SemiBold_Italic,
    InstrumentSans_700Bold,
    InstrumentSans_700Bold_Italic,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <OnboardingProvider>
              <AppBootstrapProvider>
                <SettingsProvider>
                  <AppStatusBar />
                  <RootStack />
                </SettingsProvider>
              </AppBootstrapProvider>
            </OnboardingProvider>
          </QueryClientProvider>
        </KeyboardProvider>
        <Toaster position="top-center" />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function AppStatusBar() {
  const { theme } = useSettings();

  const statusBarStyle: StatusBarStyle =
    theme === "system" ? "auto" : theme === "dark" ? "light" : "dark";

  return <StatusBar animated style={statusBarStyle} />;
}

function RootStack() {
  const { t } = useTranslation();
  const { hasLoadedAppBootstrap } = useAppBootstrap();
  const { hasLoadedOnboardingState, hasSeenOnboarding } = useOnboarding();
  const colorScheme = useColorScheme();
  const groupedHeaderForegroundColor = getPrimaryIconColor(colorScheme);
  const groupedHeaderBackgroundOptions = {
    contentStyle: {
      backgroundColor: settingsScreenBackgroundColor,
    },
    headerStyle: {
      backgroundColor: getSettingsScreenBackgroundColor(colorScheme),
    },
    headerTintColor: groupedHeaderForegroundColor,
    headerLargeTitleStyle: {
      color: groupedHeaderForegroundColor,
    },
    headerTitleStyle: {
      color: groupedHeaderForegroundColor,
      fontFamily: "InstrumentSans_600SemiBold",
    },
    headerTransparent: false,
  };

  if (!hasLoadedAppBootstrap || !hasLoadedOnboardingState) {
    return <View className="bg-background flex-1" />;
  }

  return (
    <Stack
      screenOptions={{
        headerTitleStyle: {
          fontFamily: "InstrumentSans_600SemiBold",
        },
      }}
    >
      <Stack.Protected guard={!hasSeenOnboarding}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={hasSeenOnboarding}>
        <Stack.Screen
          name="index"
          options={{
            headerShown: true,
            headerTitle: "",
            headerTransparent: true,
          }}
        />
        <Stack.Screen
          name="stop-alerts"
          options={{
            ...groupedHeaderBackgroundOptions,
            headerShown: true,
            headerTitle: t("home.drawer.alerts.modalTitle"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="news"
          options={{
            ...groupedHeaderBackgroundOptions,
            headerShown: true,
            headerTitle: t("news.title"),
            headerLargeTitleEnabled: true,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            ...groupedHeaderBackgroundOptions,
            headerShown: true,
            headerTitle: t("settings.title"),
            headerLargeTitleEnabled: true,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="settings/location-sharing"
          options={{
            ...groupedHeaderBackgroundOptions,
            headerShown: true,
            headerTitle: t("settings.locationSharing.title"),
          }}
        />
        <Stack.Screen
          name="settings/tracking"
          options={{
            ...groupedHeaderBackgroundOptions,
            headerShown: true,
            headerTitle: t("settings.appUsage.title"),
          }}
        />
        <Stack.Screen
          name="settings/theme"
          options={{
            ...groupedHeaderBackgroundOptions,
            headerShown: true,
            headerTitle: t("settings.theme.title"),
            headerLargeTitleEnabled: true,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="settings/data-sources"
          options={{
            ...groupedHeaderBackgroundOptions,
            headerShown: true,
            headerTitle: t("settings.dataSources.title"),
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default ObserveRoot.wrap(RootLayout);
