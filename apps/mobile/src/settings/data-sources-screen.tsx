import { Platform, ScrollView, Text, View } from "react-native";

import { useTranslation } from "@prossimo-app/localization";

import {
  defaultForegroundColor,
  secondaryCardBackgroundColor,
  secondaryTextColor,
  settingsScreenBackgroundColor,
} from "~/theme/native-colors";

export default function DataSourcesScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 32 }}
      style={{ backgroundColor: settingsScreenBackgroundColor, flex: 1 }}
    >
      <View
        style={{
          backgroundColor: secondaryCardBackgroundColor,
          borderCurve: "continuous",
          borderRadius: 16,
          gap: 10,
          padding: 16,
        }}
      >
        <Text
          selectable
          style={{
            color: defaultForegroundColor,
            fontSize: 17,
            fontWeight: "600",
            lineHeight: 22,
          }}
        >
          {t("settings.dataSources.sourceName")}
        </Text>
        <Text
          selectable
          style={{ color: secondaryTextColor, fontSize: 15, lineHeight: 21 }}
        >
          {t("settings.dataSources.sourceDescription")}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: secondaryCardBackgroundColor,
          borderCurve: "continuous",
          borderRadius: 16,
          gap: 10,
          padding: 16,
        }}
      >
        <Text
          selectable
          style={{
            color: defaultForegroundColor,
            fontSize: 17,
            fontWeight: "600",
            lineHeight: 22,
          }}
        >
          {t("settings.dataSources.strikeSourceName")}
        </Text>
        <Text
          selectable
          style={{ color: secondaryTextColor, fontSize: 15, lineHeight: 21 }}
        >
          {t("settings.dataSources.strikeSourceDescription")}
        </Text>
      </View>
      {Platform.OS === "android" ? (
        <View
          style={{
            backgroundColor: secondaryCardBackgroundColor,
            borderCurve: "continuous",
            borderRadius: 16,
            gap: 10,
            padding: 16,
          }}
        >
          <Text
            selectable
            style={{
              color: defaultForegroundColor,
              fontSize: 17,
              fontWeight: "600",
              lineHeight: 22,
            }}
          >
            {t("settings.dataSources.mapSourceName")}
          </Text>
          <Text
            selectable
            style={{ color: secondaryTextColor, fontSize: 15, lineHeight: 21 }}
          >
            {t("settings.dataSources.mapSourceDescription")}
          </Text>
        </View>
      ) : null}
      <Text
        selectable
        style={{
          color: secondaryTextColor,
          fontSize: 15,
          lineHeight: 21,
          paddingHorizontal: 6,
        }}
      >
        {t("settings.dataSources.independentDisclaimer")}
      </Text>
    </ScrollView>
  );
}
