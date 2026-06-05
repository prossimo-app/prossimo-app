import { useCallback, useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";

import { useTranslation } from "@prossimo-app/localization";

import { AppButton } from "~/components/app-button";
import { useOnboarding } from "~/onboarding/onboarding-provider";
import {
  defaultBackgroundColor,
  defaultForegroundColor,
  secondaryTextColor,
} from "~/theme/native-colors";
import locationPinDarkImage from "../../../assets/empty/location-pin-dark.png";
import locationPinImage from "../../../assets/empty/location-pin.png";

export default function LocationOnboardingScreen() {
  const { t } = useTranslation();
  const { completeOnboarding } = useOnboarding();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingPermission(true);

    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      setIsRequestingPermission(false);
      await completeOnboarding();
    }
  }, [completeOnboarding]);

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: defaultBackgroundColor }}
    >
      <View className="flex-1 items-center justify-center px-7">
        <Image
          accessibilityLabel={t("onboarding.location.imageAlt")}
          contentFit="contain"
          source={isDarkMode ? locationPinDarkImage : locationPinImage}
          style={{ width: 250, height: 200 }}
        />
        <View className="max-w-[320px] gap-3">
          <Text
            className="text-center font-sans text-3xl font-bold"
            style={{ color: defaultForegroundColor }}
          >
            {t("onboarding.location.title")}
          </Text>
          <Text
            className="text-center font-sans text-lg"
            style={{ color: secondaryTextColor }}
          >
            {t("onboarding.location.subtitle")}
          </Text>
        </View>
      </View>

      <View className="px-6 pt-4 pb-12">
        <AppButton
          disabled={isRequestingPermission}
          onPress={() => {
            void requestLocationPermission();
          }}
        >
          {t("onboarding.location.primaryAction")}
        </AppButton>
      </View>
    </View>
  );
}
