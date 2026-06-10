import { useEffect } from "react";
import { usePathname } from "expo-router";

import { useSettings } from "~/settings/settings-provider";
import { analytics } from "./analytics";
import { ConsoleAnalyticsBackend } from "./console-backend";
import { PostHogAnalyticsBackend } from "./posthog-backend";

const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

if (posthogApiKey) {
  analytics.setBackend(new PostHogAnalyticsBackend(posthogApiKey));
} else if (__DEV__) {
  analytics.setBackend(new ConsoleAnalyticsBackend());
}

/**
 * Headless component that keeps the analytics client in sync with the user's
 * "share app usage" consent and tracks screen views from the router.
 * Must be rendered inside `SettingsProvider`.
 */
export function AnalyticsGate() {
  const pathname = usePathname();
  const { hasLoadedSettings, isShareAppUsageEnabled } = useSettings();

  useEffect(() => {
    if (!hasLoadedSettings) {
      return;
    }

    analytics.setEnabled(isShareAppUsageEnabled);
  }, [hasLoadedSettings, isShareAppUsageEnabled]);

  useEffect(() => {
    analytics.track("app_opened");
  }, []);

  useEffect(() => {
    analytics.screen(pathname);
  }, [pathname]);

  return null;
}
