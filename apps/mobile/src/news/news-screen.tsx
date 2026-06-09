import { useState } from "react";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import NewspaperIcon from "@expo/material-symbols/newspaper.xml";
import { Column, FieldGroup, Host, Icon, ListItem, Text } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { useTranslation } from "@prossimo-app/localization";

import type { StrikeNotice } from "~/news/strike-notices";
import type { GlobalNewsItem } from "~/news/use-latest-news";
import { formatDate } from "~/news/format-date";
import { StrikeDetailModal } from "~/news/strike-detail-modal";
import { getStrikeStartDate, getStrikeTiming } from "~/news/strike-notices";
import { StrikeNotificationsToolbar } from "~/news/strike-notifications-toolbar";
import { useLatestNews } from "~/news/use-latest-news";
import { useNativeColors } from "~/theme/native-colors";

const fullWidthColumnModifiers = [frame({ maxWidth: Infinity })];

const newsIcon = Icon.select({
  ios: "newspaper.fill",
  android: NewspaperIcon,
});

const chevronIcon = Icon.select({
  ios: "chevron.forward",
  android: ChevronRightIcon,
});

interface NewsIconProps {
  accessibilityLabel: string;
}

function NewsIcon({ accessibilityLabel }: NewsIconProps) {
  return (
    <Icon
      accessibilityLabel={accessibilityLabel}
      color="white"
      name={newsIcon}
      size={18}
      style={{
        backgroundColor: "#0a84ff",
        borderRadius: 7,
        height: 28,
        width: 28,
      }}
    />
  );
}

function NewsListItem({
  description,
  publishedAt,
  startsAt,
  title,
}: {
  description: string | null;
  publishedAt: string | null;
  startsAt?: string | null;
  title: string;
}) {
  const displayDate = formatDate(startsAt ?? publishedAt);
  const { secondaryTextColor } = useNativeColors();

  return (
    <ListItem supportingText={description ?? title}>
      <ListItem.Leading>
        <NewsIcon accessibilityLabel={title} />
      </ListItem.Leading>
      {displayDate ? (
        <ListItem.Trailing>
          <Text textStyle={{ color: secondaryTextColor }}>{displayDate}</Text>
        </ListItem.Trailing>
      ) : null}
    </ListItem>
  );
}

export default function NewsScreen() {
  const { t } = useTranslation();
  const [selectedStrike, setSelectedStrike] = useState<StrikeNotice | null>(
    null,
  );
  const { globalNews, isLoading, strikes } = useLatestNews();
  const { secondaryTextColor, settingsScreenBackgroundColor } =
    useNativeColors();

  return (
    <>
      <StrikeNotificationsToolbar />
      <Host style={{ backgroundColor: settingsScreenBackgroundColor, flex: 1 }}>
        <Column
          alignment="center"
          spacing={14}
          modifiers={fullWidthColumnModifiers}
        >
          <FieldGroup testID="news-list">
            <FieldGroup.Section title={t("news.sections.strikes")}>
              {isLoading ? (
                <ListItem supportingText={t("news.loading.description")}>
                  <ListItem.Leading>
                    <NewsIcon accessibilityLabel={t("news.loading.title")} />
                  </ListItem.Leading>
                  <ListItem.Trailing>
                    <Text textStyle={{ color: secondaryTextColor }}>
                      {t("news.loading.title")}
                    </Text>
                  </ListItem.Trailing>
                </ListItem>
              ) : strikes.length > 0 ? (
                strikes.map((strike) => (
                  <StrikeListItem
                    key={strike.id}
                    onPress={() => {
                      setSelectedStrike(strike);
                    }}
                    strike={strike}
                  />
                ))
              ) : (
                <ListItem supportingText={t("news.strikes.emptyDescription")}>
                  <ListItem.Leading>
                    <NewsIcon
                      accessibilityLabel={t("news.strikes.emptyTitle")}
                    />
                  </ListItem.Leading>
                  <ListItem.Trailing>
                    <Text textStyle={{ color: secondaryTextColor }}>
                      {t("news.strikes.emptyTitle")}
                    </Text>
                  </ListItem.Trailing>
                </ListItem>
              )}
            </FieldGroup.Section>

            <FieldGroup.Section title={t("news.sections.serviceNews")}>
              {isLoading ? (
                <ListItem supportingText={t("news.loading.description")}>
                  <ListItem.Leading>
                    <NewsIcon accessibilityLabel={t("news.loading.title")} />
                  </ListItem.Leading>
                  <ListItem.Trailing>
                    <Text textStyle={{ color: secondaryTextColor }}>
                      {t("news.loading.title")}
                    </Text>
                  </ListItem.Trailing>
                </ListItem>
              ) : globalNews.length > 0 ? (
                globalNews.map((newsItem) => (
                  <GlobalNewsListItem key={newsItem.id} newsItem={newsItem} />
                ))
              ) : (
                <ListItem supportingText={t("news.empty.description")}>
                  <ListItem.Leading>
                    <NewsIcon accessibilityLabel={t("news.empty.title")} />
                  </ListItem.Leading>
                  <ListItem.Trailing>
                    <Text textStyle={{ color: secondaryTextColor }}>
                      {t("news.empty.title")}
                    </Text>
                  </ListItem.Trailing>
                </ListItem>
              )}
            </FieldGroup.Section>
          </FieldGroup>
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

function StrikeListItem({
  onPress,
  strike,
}: {
  onPress: () => void;
  strike: StrikeNotice;
}) {
  const { t } = useTranslation();
  const startsAt = getStrikeStartDate(strike);
  const date = startsAt ? formatDate(startsAt.toISOString()) : "";
  const timing = getStrikeTiming(strike);
  const title = date
    ? t(`news.strikes.summary.${timing}`, { date })
    : t("news.strikes.summary.incomingWithoutDate");

  return (
    <ListItem onPress={onPress} supportingText={title}>
      <ListItem.Leading>
        <Icon
          accessibilityLabel={title}
          color="white"
          name={Icon.select({
            ios: "exclamationmark.triangle.fill",
            android: NewspaperIcon,
          })}
          size={18}
          style={{
            backgroundColor: "#ef4444",
            borderRadius: 7,
            height: 28,
            width: 28,
          }}
        />
      </ListItem.Leading>
      <ListItem.Trailing>
        <Icon name={chevronIcon} size={18} />
      </ListItem.Trailing>
    </ListItem>
  );
}

function GlobalNewsListItem({ newsItem }: { newsItem: GlobalNewsItem }) {
  return (
    <NewsListItem
      description={newsItem.description}
      publishedAt={newsItem.publishedAt}
      title={newsItem.title}
    />
  );
}
