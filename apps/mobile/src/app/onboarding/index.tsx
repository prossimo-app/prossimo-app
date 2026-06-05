import { Text, useColorScheme, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { useTranslation } from "@prossimo-app/localization";

import { AppButton } from "~/components/app-button";
import {
  defaultBackgroundColor,
  defaultForegroundColor,
  secondaryTextColor,
} from "~/theme/native-colors";
import onboardingBackgroundImage from "../../../assets/empty/onboarding-background.png";
import onboardingFadeDarkImage from "../../../assets/empty/onboarding-fade-dark.png";
import onboardingFadeImage from "../../../assets/empty/onboarding-fade.png";
import iconDark from "../../../assets/icon-onboarding-dark.svg";
import icon from "../../../assets/icon-onboarding.svg";

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: defaultBackgroundColor }}
    >
      <View className="overflow-hidden" style={{ flex: 2 }}>
        <Image
          accessibilityLabel={t("onboarding.imageAlt")}
          contentFit="cover"
          source={onboardingBackgroundImage}
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
        {isDarkMode ? (
          <View
            pointerEvents="none"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.28)",
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          />
        ) : null}
        <Image
          contentFit="fill"
          pointerEvents="none"
          source={isDarkMode ? onboardingFadeDarkImage : onboardingFadeImage}
          style={{
            bottom: 0,
            height: isDarkMode ? 520 : 400,
            left: 0,
            position: "absolute",
            right: 0,
          }}
        />
      </View>

      <View className="flex-1 justify-end gap-8 px-7 pb-12">
        <View className="gap-5">
          <Image
            pointerEvents="none"
            source={isDarkMode ? iconDark : icon}
            style={{ height: 40, width: 40 }}
          />
          <View className="gap-3">
            <Text
              className="font-serif text-3xl"
              style={{ color: defaultForegroundColor }}
            >
              {t("onboarding.title")}
            </Text>
            <Text
              className="font-sans text-lg"
              style={{ color: secondaryTextColor }}
            >
              {t("onboarding.subtitle")}
            </Text>
          </View>
        </View>

        <AppButton
          onPress={() => {
            router.push("/onboarding/location");
          }}
        >
          {t("onboarding.primaryAction")}
        </AppButton>
      </View>
    </View>
  );
}
