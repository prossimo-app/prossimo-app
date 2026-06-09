import { useColorScheme } from "react-native";
import {
  Card,
  Column,
  Host,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  testID,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";

import { useTranslation } from "@prossimo-app/localization";

const screenModifiers = [
  fillMaxSize(),
  verticalScroll(),
  padding(16, 0, 16, 24),
  testID("data-sources-list"),
];

function DataSourceCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  const colors = useMaterialColors();

  return (
    <Card
      colors={{ containerColor: colors.surfaceContainer }}
      modifiers={[fillMaxWidth()]}
    >
      <Column
        modifiers={[paddingAll(16)]}
        verticalArrangement={{ spacedBy: 8 }}
      >
        <Text color={colors.onSurface} style={{ typography: "titleMedium" }}>
          {title}
        </Text>
        <Text
          color={colors.onSurfaceVariant}
          style={{ typography: "bodyMedium" }}
        >
          {description}
        </Text>
      </Column>
    </Card>
  );
}

export default function DataSourcesScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = useMaterialColors({ colorScheme });

  return (
    <Host
      colorScheme={colorScheme}
      style={{
        backgroundColor: colors.surface,
        flex: 1,
      }}
    >
      <Column modifiers={screenModifiers} verticalArrangement={{ spacedBy: 16 }}>
        <DataSourceCard
          description={t("settings.dataSources.sourceDescription")}
          title={t("settings.dataSources.sourceName")}
        />
        <DataSourceCard
          description={t("settings.dataSources.strikeSourceDescription")}
          title={t("settings.dataSources.strikeSourceName")}
        />
        <DataSourceCard
          description={t("settings.dataSources.mapSourceDescription")}
          title={t("settings.dataSources.mapSourceName")}
        />
        <Text
          color={colors.onSurfaceVariant}
          modifiers={[fillMaxWidth(), padding(4, 0, 4, 0)]}
          style={{ typography: "bodyMedium" }}
        >
          {t("settings.dataSources.independentDisclaimer")}
        </Text>
      </Column>
    </Host>
  );
}
