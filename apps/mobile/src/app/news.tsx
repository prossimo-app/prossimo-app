import { useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  Text as RNText,
  ScrollView,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import NewspaperIcon from "@expo/material-symbols/newspaper.xml";
import { Column, FieldGroup, Host, Icon, ListItem, Text } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@prossimo-app/localization";

import type { StrikeNotice } from "~/news/strike-notices";
import type { RouterOutputs } from "~/utils/api";
import {
  getStrikeStartDate,
  getStrikeTiming,
  isVisibleStrikeNotice,
} from "~/news/strike-notices";
import { useNativeColors } from "~/theme/native-colors";
import { trpc } from "~/utils/api";

const fullWidthColumnModifiers = [frame({ maxWidth: Infinity })];

const newsIcon = Icon.select({
  ios: "newspaper.fill",
  android: NewspaperIcon,
});

const chevronIcon = Icon.select({
  ios: "chevron.forward",
  android: ChevronRightIcon,
});

type NewsData = RouterOutputs["news"]["getLatest"];
type GlobalNewsItem = NewsData["globalNews"][number];

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

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(date);
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
  const newsQuery = useQuery({
    ...trpc.news.getLatest.queryOptions({}),
    staleTime: 5 * 60 * 1000,
  });
  const strikes =
    newsQuery.data?.strikes.filter((strike) => isVisibleStrikeNotice(strike)) ??
    [];
  const globalNews = newsQuery.data?.globalNews ?? [];
  const { secondaryTextColor, settingsScreenBackgroundColor } =
    useNativeColors();

  return (
    <>
      <Host style={{ backgroundColor: settingsScreenBackgroundColor, flex: 1 }}>
        <Column
          alignment="center"
          spacing={14}
          modifiers={fullWidthColumnModifiers}
        >
          <FieldGroup testID="news-list">
            <FieldGroup.Section title={t("news.sections.strikes")}>
              {newsQuery.isLoading ? (
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
              {newsQuery.isLoading ? (
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

function StrikeDetailModal({
  onClose,
  strike,
}: {
  onClose: () => void;
  strike: StrikeNotice | null;
}) {
  const { t } = useTranslation();
  const { secondaryTextColor } = useNativeColors();
  const startsAt = strike ? getStrikeStartDate(strike) : null;
  const date = startsAt ? formatDate(startsAt.toISOString()) : "";
  const body =
    strike?.description && strike.title
      ? `${strike.title}\n\n${strike.description}`
      : (strike?.description ?? strike?.title ?? "");

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={Boolean(strike)}
    >
      <Pressable
        style={{
          flex: 1,
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          className="bg-background max-h-[82%] rounded-t-3xl px-5 pt-4 pb-8"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-red-500">
              <SymbolView
                name={{
                  ios: "exclamationmark.triangle.fill",
                  android: "warning",
                }}
                size={20}
                tintColor="white"
              />
            </View>
            <View className="min-w-0 flex-1">
              <RNText className="text-foreground font-sans text-lg font-bold">
                {t("news.strikes.detailTitle")}
              </RNText>
              {date ? (
                <RNText className="text-muted-foreground font-sans text-sm">
                  {date}
                </RNText>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel={t("news.strikes.close")}
              accessibilityRole="button"
              className="bg-muted h-9 w-9 items-center justify-center rounded-full active:opacity-75"
              hitSlop={8}
              onPress={onClose}
            >
              <SymbolView
                name={{ ios: "xmark", android: "close" }}
                size={17}
                tintColor={secondaryTextColor}
              />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <RNText
              className="text-foreground font-sans text-base leading-6"
              selectable
            >
              {body}
            </RNText>
          </ScrollView>

          {strike?.link ? (
            <Pressable
              accessibilityRole="link"
              className="bg-primary mt-4 min-h-12 items-center justify-center rounded-2xl px-5 active:opacity-80"
              onPress={() => {
                if (strike.link) {
                  void Linking.openURL(strike.link);
                }
              }}
            >
              <RNText className="font-sans text-base font-bold text-white">
                {t("news.strikes.openLink")}
              </RNText>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
