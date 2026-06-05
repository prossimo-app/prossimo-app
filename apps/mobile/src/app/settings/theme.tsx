import { Pressable, ScrollView, Text, View } from "react-native";
import CheckIcon from "@expo/material-symbols/check.xml";
import { Host, Icon } from "@expo/ui";

import { useTranslation } from "@prossimo-app/localization";

import type { ThemeOption } from "~/settings/settings-provider";
import { themeOptions, useSettings } from "~/settings/settings-provider";
import {
  defaultForegroundColor,
  settingsScreenBackgroundColor,
} from "~/theme/native-colors";

const checkIcon = Icon.select({
  ios: "checkmark.circle.fill",
  android: CheckIcon,
});

const optionColors = {
  system: {
    background: "#f2f2f7",
    phoneLeft: "#ffffff",
    phoneRight: "#1c1c1e",
    screenLeft: "#f9f9fb",
    screenRight: "#2c2c2e",
  },
  dark: {
    background: "#1c1c1e",
    phoneLeft: "#2c2c2e",
    phoneRight: "#2c2c2e",
    screenLeft: "#3a3a3c",
    screenRight: "#3a3a3c",
  },
  light: {
    background: "#f2f2f7",
    phoneLeft: "#ffffff",
    phoneRight: "#ffffff",
    screenLeft: "#f9f9fb",
    screenRight: "#f9f9fb",
  },
} as const;

function ThemePhonePreview({ option }: { option: ThemeOption }) {
  const colors = optionColors[option];

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        borderCurve: "continuous",
        borderRadius: 18,
        height: 190,
        justifyContent: "center",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <View
        style={{
          backgroundColor:
            option === "system" ? colors.phoneLeft : colors.phoneRight,
          borderColor: "rgba(0, 0, 0, 0.18)",
          borderCurve: "continuous",
          borderRadius: 26,
          borderWidth: 3,
          height: 154,
          overflow: "hidden",
          width: 78,
        }}
      >
        {option === "system" ? (
          <View
            style={{
              backgroundColor: colors.phoneRight,
              bottom: 0,
              position: "absolute",
              right: 0,
              top: 0,
              width: "50%",
            }}
          />
        ) : null}
        <View
          style={{
            alignSelf: "center",
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            borderRadius: 4,
            height: 4,
            marginTop: 8,
            width: 24,
          }}
        />
        <View style={{ gap: 8, padding: 10, paddingTop: 16 }}>
          <View
            style={{
              backgroundColor:
                option === "system" ? colors.screenLeft : colors.screenRight,
              borderRadius: 9,
              height: 42,
              opacity: 0.96,
            }}
          />
          <View
            style={{
              backgroundColor:
                option === "system" ? colors.screenRight : colors.screenLeft,
              borderRadius: 8,
              height: 16,
              opacity: 0.86,
              width: "72%",
            }}
          />
          <View
            style={{
              backgroundColor:
                option === "system" ? colors.screenLeft : colors.screenRight,
              borderRadius: 8,
              height: 16,
              opacity: 0.82,
              width: "88%",
            }}
          />
        </View>
      </View>
    </View>
  );
}

export default function ThemeScreen() {
  const { t } = useTranslation();
  const { hasLoadedSettings, setTheme, theme } = useSettings();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 32 }}
      style={{ backgroundColor: settingsScreenBackgroundColor, flex: 1 }}
    >
      {themeOptions.map((option) => {
        const isSelected = theme === option;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{
              checked: isSelected,
              disabled: !hasLoadedSettings,
            }}
            disabled={!hasLoadedSettings}
            key={option}
            onPress={() => {
              void setTheme(option);
            }}
            style={({ pressed }) => ({
              borderColor: isSelected ? "#0a84ff" : "rgba(120, 120, 128, 0.3)",
              borderCurve: "continuous",
              borderRadius: 22,
              borderWidth: 2,
              gap: 12,
              opacity: pressed ? 0.74 : 1,
              padding: 12,
            })}
          >
            <ThemePhonePreview option={option} />
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: defaultForegroundColor,
                  fontSize: 17,
                  fontWeight: "600",
                }}
              >
                {t(`settings.theme.options.${option}`)}
              </Text>
              {isSelected ? (
                <Host matchContents>
                  <Icon color="#0a84ff" name={checkIcon} size={18} />
                </Host>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
