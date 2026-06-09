import type { PermissionResponse } from "expo-tracking-transparency";
import {
  Linking,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { PermissionStatus } from "expo-tracking-transparency";

import { useTranslation } from "@prossimo-app/localization";

import { AppButton } from "~/components/app-button";
import { useSettings } from "~/settings/settings-provider";
import {
  defaultForegroundColor,
  secondaryCardBackgroundColor,
  secondaryTextColor,
  settingsScreenBackgroundColor,
} from "~/theme/native-colors";
import appSettingsImage from "../../assets/tracking/1-app-settings.png";
import allowTrackingImage from "../../assets/tracking/2-allow-tracking.png";

const trackingSettingSteps = [
  {
    image: appSettingsImage,
    imageAspectRatio: 1206 / 1386,
    titleKey: "settings.appUsage.steps.appSettings",
  },
  {
    image: allowTrackingImage,
    imageAspectRatio: 1206 / 904,
    titleKey: "settings.appUsage.steps.allowTracking",
  },
];

function getTrackingOptionKey(permission: PermissionResponse | null) {
  if (!permission) {
    return "loading";
  }

  if (permission.status === PermissionStatus.UNDETERMINED) {
    return "askNextTime";
  }

  if (permission.status === PermissionStatus.GRANTED) {
    return "allowed";
  }

  return "notAllowed";
}

export default function TrackingScreen() {
  const { t } = useTranslation();
  const { isShareAppUsageEnabled, trackingPermission } = useSettings();
  const { width } = useWindowDimensions();
  const trackingOptionKey = getTrackingOptionKey(trackingPermission);
  const imageWidth = Math.min(width - 64, 360);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: 18, padding: 16, paddingBottom: 32 }}
      style={{ backgroundColor: settingsScreenBackgroundColor, flex: 1 }}
    >
      <View
        style={{
          backgroundColor: secondaryCardBackgroundColor,
          borderCurve: "continuous",
          borderRadius: 16,
          gap: 12,
          padding: 16,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text
            selectable
            style={{
              color: isShareAppUsageEnabled ? "#30d158" : "#ff453a",
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            {isShareAppUsageEnabled
              ? t("settings.appUsage.status.shared")
              : t("settings.appUsage.status.disabled")}
          </Text>
          <Text
            selectable
            style={{
              color: secondaryTextColor,
              fontSize: 15,
              lineHeight: 20,
            }}
          >
            {t("settings.appUsage.detail.description")}
          </Text>
        </View>

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text
            style={{
              color: defaultForegroundColor,
              flex: 1,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {t("settings.appUsage.detail.currentOptionTitle")}
          </Text>
          <Text
            selectable
            style={{
              color: isShareAppUsageEnabled ? "#30d158" : "#ff453a",
              flexShrink: 1,
              fontSize: 16,
              fontWeight: "600",
              textAlign: "right",
            }}
          >
            {t(`settings.appUsage.options.${trackingOptionKey}`)}
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        {trackingSettingSteps.map((step, index) => (
          <View
            key={step.titleKey}
            style={{
              backgroundColor: secondaryCardBackgroundColor,
              borderCurve: "continuous",
              borderRadius: 16,
              gap: 12,
              overflow: "hidden",
              padding: 12,
            }}
          >
            <Text
              style={{
                color: defaultForegroundColor,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {index + 1}. {t(step.titleKey)}
            </Text>
            <View
              style={{
                alignSelf: "center",
                aspectRatio: step.imageAspectRatio,
                borderCurve: "continuous",
                borderRadius: 12,
                overflow: "hidden",
                width: imageWidth,
              }}
            >
              <Image
                accessibilityLabel={t(step.titleKey)}
                contentFit="contain"
                source={step.image}
                style={{ height: "100%", width: "100%" }}
              />
            </View>
          </View>
        ))}
      </View>

      <AppButton
        onPress={() => {
          void Linking.openSettings();
        }}
      >
        {t("settings.appUsage.detail.settingsAction")}
      </AppButton>
    </ScrollView>
  );
}
