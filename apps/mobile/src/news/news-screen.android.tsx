import { useState } from "react";
import { useColorScheme } from "react-native";
import NewspaperIcon from "@expo/material-symbols/newspaper.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Column, Host, Text, useMaterialColors } from "@expo/ui/jetpack-compose";
import {
  fillMaxSize,
  padding,
  testID,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";

import { useTranslation } from "@prossimo-app/localization";

import type { StrikeNotice } from "~/news/strike-notices";
import type { GlobalNewsItem } from "~/news/use-latest-news";
import {
  MaterialListGroup,
  MaterialListRow,
  MaterialSectionHeader,
} from "~/components/material-list";
import { formatDate } from "~/news/format-date";
import { StrikeDetailModal } from "~/news/strike-detail-modal";
import { getStrikeStartDate, getStrikeTiming } from "~/news/strike-notices";
import { StrikeNotificationsToolbar } from "~/news/strike-notifications-toolbar";
import { useLatestNews } from "~/news/use-latest-news";

const screenModifiers = [
  fillMaxSize(),
  verticalScroll(),
  padding(16, 0, 16, 24),
  testID("news-list"),
];

function LoadingRow() {
  const { t } = useTranslation();

  return (
    <MaterialListRow
      headline={t("news.loading.title")}
      icon={NewspaperIcon}
      iconAccessibilityLabel={t("news.loading.title")}
      isFirstInGroup
      isLastInGroup
      supportingText={t("news.loading.description")}
    />
  );
}

function StrikeRow({
  isFirstInGroup,
  isLastInGroup,
  onPress,
  strike,
}: {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onPress: () => void;
  strike: StrikeNotice;
}) {
  const { t } = useTranslation();
  const colors = useMaterialColors();
  const startsAt = getStrikeStartDate(strike);
  const date = startsAt ? formatDate(startsAt.toISOString()) : "";
  const timing = getStrikeTiming(strike);
  const title = date
    ? t(`news.strikes.summary.${timing}`, { date })
    : t("news.strikes.summary.incomingWithoutDate");

  return (
    <MaterialListRow
      headline={title}
      icon={WarningIcon}
      iconAccessibilityLabel={title}
      iconTint={colors.error}
      isFirstInGroup={isFirstInGroup}
      isLastInGroup={isLastInGroup}
      onPress={onPress}
      supportingText={strike.title}
      supportingTextMaxLines={2}
    />
  );
}

function GlobalNewsRow({
  isFirstInGroup,
  isLastInGroup,
  newsItem,
}: {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  newsItem: GlobalNewsItem;
}) {
  const colors = useMaterialColors();
  const displayDate = formatDate(newsItem.publishedAt);

  return (
    <MaterialListRow
      headline={newsItem.title}
      icon={NewspaperIcon}
      iconAccessibilityLabel={newsItem.title}
      isFirstInGroup={isFirstInGroup}
      isLastInGroup={isLastInGroup}
      supportingText={newsItem.description}
      supportingTextMaxLines={3}
      trailing={
        displayDate ? (
          <Text
            color={colors.onSurfaceVariant}
            style={{ typography: "bodySmall" }}
          >
            {displayDate}
          </Text>
        ) : undefined
      }
    />
  );
}

export default function NewsScreen() {
  const { t } = useTranslation();
  const [selectedStrike, setSelectedStrike] = useState<StrikeNotice | null>(
    null,
  );
  const colorScheme = useColorScheme();
  const colors = useMaterialColors({ colorScheme });
  const { globalNews, isLoading, strikes } = useLatestNews();

  return (
    <>
      <StrikeNotificationsToolbar />
      <Host
        colorScheme={colorScheme}
        style={{ backgroundColor: colors.surface, flex: 1 }}
      >
        <Column modifiers={screenModifiers}>
          <MaterialSectionHeader>
            {t("news.sections.strikes")}
          </MaterialSectionHeader>
          <MaterialListGroup>
            {isLoading ? (
              <LoadingRow />
            ) : strikes.length > 0 ? (
              strikes.map((strike, index) => (
                <StrikeRow
                  key={strike.id}
                  isFirstInGroup={index === 0}
                  isLastInGroup={index === strikes.length - 1}
                  onPress={() => {
                    setSelectedStrike(strike);
                  }}
                  strike={strike}
                />
              ))
            ) : (
              <MaterialListRow
                headline={t("news.strikes.emptyTitle")}
                icon={NewspaperIcon}
                iconAccessibilityLabel={t("news.strikes.emptyTitle")}
                isFirstInGroup
                isLastInGroup
                supportingText={t("news.strikes.emptyDescription")}
              />
            )}
          </MaterialListGroup>

          <MaterialSectionHeader>
            {t("news.sections.serviceNews")}
          </MaterialSectionHeader>
          <MaterialListGroup>
            {isLoading ? (
              <LoadingRow />
            ) : globalNews.length > 0 ? (
              globalNews.map((newsItem, index) => (
                <GlobalNewsRow
                  key={newsItem.id}
                  isFirstInGroup={index === 0}
                  isLastInGroup={index === globalNews.length - 1}
                  newsItem={newsItem}
                />
              ))
            ) : (
              <MaterialListRow
                headline={t("news.empty.title")}
                icon={NewspaperIcon}
                iconAccessibilityLabel={t("news.empty.title")}
                isFirstInGroup
                isLastInGroup
                supportingText={t("news.empty.description")}
              />
            )}
          </MaterialListGroup>
        </Column>
      </Host>
      <StrikeDetailModal
        onClose={() => {
          setSelectedStrike(null);
        }}
        strike={selectedStrike}
      />
    </>
  );
}
