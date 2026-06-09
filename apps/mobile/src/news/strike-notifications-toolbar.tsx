import { Platform, useColorScheme } from "react-native";
import { Stack } from "expo-router";
import NotificationsActiveIcon from "@expo/material-symbols/notifications_active.xml";
import NotificationsIcon from "@expo/material-symbols/notifications.xml";

import { useTranslation } from "@prossimo-app/localization";

import { useStrikeNotifications } from "~/notifications/use-strike-notifications";
import { getPrimaryIconColor } from "~/theme/native-colors";

export function StrikeNotificationsToolbar() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const {
    isEnabled: areStrikeNotificationsEnabled,
    toggleStrikeNotifications,
  } = useStrikeNotifications();
  // On Android the toolbar doesn't follow the in-app Appearance override, so
  // tint the icons explicitly. iOS resolves its tint natively.
  const toolbarTintColor =
    Platform.OS === "android" ? getPrimaryIconColor(colorScheme) : undefined;

  return (
    <Stack.Toolbar placement="right" tintColor={toolbarTintColor}>
      <Stack.Toolbar.Button
        accessibilityLabel={t(
          areStrikeNotificationsEnabled
            ? "news.notifications.disableButton"
            : "news.notifications.enableButton",
        )}
        onPress={() => {
          void toggleStrikeNotifications();
        }}
      >
        {Platform.OS === "ios" ? (
          <Stack.Toolbar.Icon
            sf={areStrikeNotificationsEnabled ? "bell.fill" : "bell"}
          />
        ) : (
          <Stack.Toolbar.Icon
            src={
              areStrikeNotificationsEnabled
                ? NotificationsActiveIcon
                : NotificationsIcon
            }
          />
        )}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
