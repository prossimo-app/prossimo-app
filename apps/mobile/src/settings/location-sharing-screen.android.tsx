import * as Location from "expo-location";

import { useTranslation } from "@prossimo-app/localization";

import { MaterialPermissionDetail } from "~/components/material-permission-detail";
import { useSettings } from "~/settings/settings-provider";
import appSettingsImage from "../../assets/location/1-app-settings-android.png";
import locationSettingsImage from "../../assets/location/2-location-settings-android.png";
import locationOptionsImage from "../../assets/location/3-location-options-android.png";

const locationSettingSteps = [
  {
    image: appSettingsImage,
    imageAspectRatio: 1206 / 1386,
    titleKey: "settings.locationSharing.steps.appSettings",
  },
  {
    image: locationSettingsImage,
    imageAspectRatio: 1206 / 1031,
    titleKey: "settings.locationSharing.steps.locationSettings",
  },
  {
    image: locationOptionsImage,
    imageAspectRatio: 1206 / 836,
    titleKey: "settings.locationSharing.steps.locationOptions",
  },
];

function getLocationOptionKey(
  permission: Location.LocationPermissionResponse | null,
) {
  if (!permission) {
    return "loading";
  }

  if (permission.status === Location.PermissionStatus.UNDETERMINED) {
    return "askNextTime";
  }

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return "never";
  }

  return "whileUsing";
}

export default function LocationSharingScreen() {
  const { t } = useTranslation();
  const { isLocationSharingEnabled, locationPermission } = useSettings();
  const locationOptionKey = getLocationOptionKey(locationPermission);

  return (
    <MaterialPermissionDetail
      currentOptionTitle={t(
        "settings.locationSharing.detail.currentOptionTitle",
      )}
      currentOptionValue={t(
        `settings.locationSharing.options.${locationOptionKey}`,
      )}
      description={t("settings.locationSharing.detail.description")}
      isEnabled={isLocationSharingEnabled}
      screenTestID="location-sharing-detail"
      settingsActionLabel={t("settings.locationSharing.detail.settingsAction")}
      statusText={t(
        isLocationSharingEnabled
          ? "settings.locationSharing.status.shared"
          : "settings.locationSharing.status.disabled",
      )}
      steps={locationSettingSteps.map((step) => ({
        image: step.image,
        imageAspectRatio: step.imageAspectRatio,
        title: t(step.titleKey),
      }))}
    />
  );
}
