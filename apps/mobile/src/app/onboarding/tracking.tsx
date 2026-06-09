import { useCallback, useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";

import { useTranslation } from "@prossimo-app/localization";

import { AppButton } from "~/components/app-button";
import {
  defaultBackgroundColor,
  defaultForegroundColor,
  secondaryTextColor,
} from "~/theme/native-colors";
import trackingDarkImage from "../../../assets/empty/tracking-dark.png";
import trackingImage from "../../../assets/empty/tracking.png";

export default function TrackingOnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const requestTrackingPermission = useCallback(async () => {
    setIsRequestingPermission(true);

    try {
      await requestTrackingPermissionsAsync();
    } finally {
      setIsRequestingPermission(false);
      router.push("/onboarding/location");
    }
  }, [router]);

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: defaultBackgroundColor }}
    >
      <View className="flex-1 items-center justify-center px-7">
        <Image
          accessibilityLabel={t("onboarding.tracking.imageAlt")}
          contentFit="contain"
          source={isDarkMode ? trackingDarkImage : trackingImage}
          style={{ width: 250, height: 200 }}
        />
        <View className="max-w-[320px] gap-3">
          <Text
            className="text-center font-sans text-3xl font-bold"
            style={{ color: defaultForegroundColor }}
          >
            {t("onboarding.tracking.title")}
          </Text>
          <Text
            className="text-center font-sans text-lg"
            style={{ color: secondaryTextColor }}
          >
            {t("onboarding.tracking.subtitle")}
          </Text>
        </View>
      </View>

      <View className="px-6 pt-4 pb-12">
        <AppButton
          disabled={isRequestingPermission}
          onPress={() => {
            void requestTrackingPermission();
          }}
        >
          {t("onboarding.tracking.primaryAction")}
        </AppButton>
      </View>
    </View>
  );
}
