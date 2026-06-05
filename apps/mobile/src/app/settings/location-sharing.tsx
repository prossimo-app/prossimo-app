import {
  Linking,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";

import { useTranslation } from "@prossimo-app/localization";

import { AppButton } from "~/components/app-button";
import { useSettings } from "~/settings/settings-provider";
import {
  defaultForegroundColor,
  secondaryCardBackgroundColor,
  secondaryTextColor,
  settingsScreenBackgroundColor,
} from "~/theme/native-colors";
import appSettingsImage from "../../../assets/location/1-app-settings.png";
import locationSettingsImage from "../../../assets/location/2-location-settings.png";
import locationOptionsImage from "../../../assets/location/3-location-options.png";

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

  if (permission.ios?.scope === "always") {
    return "always";
  }

  return "whileUsing";
}

export default function LocationSharingScreen() {
  const { t } = useTranslation();
  const { isLocationSharingEnabled, locationPermission } = useSettings();
  const { width } = useWindowDimensions();
  const locationOptionKey = getLocationOptionKey(locationPermission);
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
              color: isLocationSharingEnabled ? "#30d158" : "#ff453a",
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            {isLocationSharingEnabled
              ? t("settings.locationSharing.status.shared")
              : t("settings.locationSharing.status.disabled")}
          </Text>
          <Text
            selectable
            style={{
              color: secondaryTextColor,
              fontSize: 15,
              lineHeight: 20,
            }}
          >
            {t("settings.locationSharing.detail.description")}
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
            {t("settings.locationSharing.detail.currentOptionTitle")}
          </Text>
          <Text
            selectable
            style={{
              color: isLocationSharingEnabled ? "#30d158" : "#ff453a",
              flexShrink: 1,
              fontSize: 16,
              fontWeight: "600",
              textAlign: "right",
            }}
          >
            {t(`settings.locationSharing.options.${locationOptionKey}`)}
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        {locationSettingSteps.map((step, index) => (
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
        {t("settings.locationSharing.detail.settingsAction")}
      </AppButton>
    </ScrollView>
  );
}
