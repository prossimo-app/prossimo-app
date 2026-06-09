import type { PermissionResponse } from "expo-tracking-transparency";
import { PermissionStatus } from "expo-tracking-transparency";

import { useTranslation } from "@prossimo-app/localization";

import { MaterialPermissionDetail } from "~/components/material-permission-detail";
import { useSettings } from "~/settings/settings-provider";
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
  const trackingOptionKey = getTrackingOptionKey(trackingPermission);

  return (
    <MaterialPermissionDetail
      currentOptionTitle={t("settings.appUsage.detail.currentOptionTitle")}
      currentOptionValue={t(`settings.appUsage.options.${trackingOptionKey}`)}
      description={t("settings.appUsage.detail.description")}
      isEnabled={isShareAppUsageEnabled}
      screenTestID="tracking-detail"
      settingsActionLabel={t("settings.appUsage.detail.settingsAction")}
      statusText={t(
        isShareAppUsageEnabled
          ? "settings.appUsage.status.shared"
          : "settings.appUsage.status.disabled",
      )}
      steps={trackingSettingSteps.map((step) => ({
        image: step.image,
        imageAspectRatio: step.imageAspectRatio,
        title: t(step.titleKey),
      }))}
    />
  );
}
