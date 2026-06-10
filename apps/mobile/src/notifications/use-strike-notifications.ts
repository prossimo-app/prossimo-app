import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { toast } from "sonner-native";

import { useTranslation } from "@prossimo-app/localization";

import { analytics } from "~/analytics/analytics";
import {
  disableStrikeNotificationsAsync,
  enableStrikeNotificationsAsync,
  getStrikeNotificationsEnabledAsync,
  isNotificationPermissionGranted,
} from "./strike-notifications";

export function useStrikeNotifications() {
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      const [storedEnabled, permission] = await Promise.all([
        getStrikeNotificationsEnabledAsync(),
        Notifications.getPermissionsAsync(),
      ]);

      if (isMounted) {
        setIsEnabled(
          storedEnabled && isNotificationPermissionGranted(permission),
        );
      }
    }

    void loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  const enable = useCallback(async () => {
    try {
      await enableStrikeNotificationsAsync();
      setIsEnabled(true);
      analytics.track("strike_notifications_toggled", { enabled: true });
      toast.success(t("news.notifications.enabledToast"));
    } catch {
      toast.error(t("news.notifications.errorToast"));
    }
  }, [t]);

  const toggleStrikeNotifications = useCallback(async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);

    try {
      if (isEnabled) {
        await disableStrikeNotificationsAsync();
        setIsEnabled(false);
        analytics.track("strike_notifications_toggled", { enabled: false });
        toast.success(t("news.notifications.disabledToast"));
        return;
      }

      const permission = await Notifications.getPermissionsAsync();

      if (isNotificationPermissionGranted(permission)) {
        await enable();
        return;
      }

      if (permission.canAskAgain) {
        Alert.alert(
          t("news.notifications.permissionPromptTitle"),
          t("news.notifications.permissionPromptMessage"),
          [
            { style: "cancel", text: t("news.notifications.notNow") },
            {
              onPress: () => {
                void (async () => {
                  const result = await Notifications.requestPermissionsAsync({
                    ios: {
                      allowAlert: true,
                      allowBadge: true,
                      allowSound: true,
                    },
                  });

                  if (isNotificationPermissionGranted(result)) {
                    await enable();
                  } else {
                    toast.error(t("news.notifications.permissionDeniedToast"));
                  }
                })();
              },
              text: t("news.notifications.allow"),
            },
          ],
        );
        return;
      }

      Alert.alert(
        t("news.notifications.permissionBlockedTitle"),
        t("news.notifications.permissionBlockedMessage"),
        [
          { style: "cancel", text: t("news.notifications.notNow") },
          {
            onPress: () => {
              void Linking.openSettings();
            },
            text: t("news.notifications.openSettings"),
          },
        ],
      );
    } catch {
      toast.error(t("news.notifications.errorToast"));
    } finally {
      setIsBusy(false);
    }
  }, [enable, isBusy, isEnabled, t]);

  return { isEnabled, toggleStrikeNotifications };
}
