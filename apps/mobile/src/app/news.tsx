import NewspaperIcon from "@expo/material-symbols/newspaper.xml";
import { Column, FieldGroup, Host, Icon, ListItem, Text } from "@expo/ui";
import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@prossimo-app/localization";

import {
  secondaryTextColor,
  settingsScreenBackgroundColor,
} from "~/theme/native-colors";
import { trpc } from "~/utils/api";

const newsIcon = Icon.select({
  ios: "newspaper.fill",
  android: NewspaperIcon,
});

interface NewsItem {
  description: string;
  id: string;
  lastSeenAt: string;
  title: string;
}

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

function NewsListItem({ description, lastSeenAt, title }: NewsItem) {
  const { t } = useTranslation();
  const displayTitle =
    title || description || t("news.alerts.noDescription");

  return (
    <ListItem supportingText={displayTitle}>
      <ListItem.Leading>
        <NewsIcon accessibilityLabel={displayTitle} />
      </ListItem.Leading>
      <ListItem.Trailing>
        <Text textStyle={{ color: secondaryTextColor }}>
          {formatUpdatedAt(lastSeenAt)}
        </Text>
      </ListItem.Trailing>
    </ListItem>
  );
}

export default function NewsScreen() {
  const { t } = useTranslation();
  const activeAlertsQuery = useQuery({
    ...trpc.alerts.getActive.queryOptions({ limit: 50, source: "gtt" }),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });
  const recentNewsItems = activeAlertsQuery.data?.alerts ?? [];

  return (
    <Host style={{ backgroundColor: settingsScreenBackgroundColor, flex: 1 }}>
      <Column
        alignment="center"
        spacing={14}
        style={{ paddingBottom: 24, width: "100%" }}
      >
        <FieldGroup testID="news-list">
          <FieldGroup.Section title={t("news.sections.recent")}>
            {activeAlertsQuery.isLoading ? (
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
            ) : recentNewsItems.length > 0 ? (
              recentNewsItems.map((newsItem) => (
                <NewsListItem key={newsItem.id} {...newsItem} />
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
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
