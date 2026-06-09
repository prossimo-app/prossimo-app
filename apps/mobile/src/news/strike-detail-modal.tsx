import {
  Linking,
  Modal,
  Pressable,
  Text as RNText,
  ScrollView,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";

import { useTranslation } from "@prossimo-app/localization";

import type { StrikeNotice } from "~/news/strike-notices";
import { formatDate } from "~/news/format-date";
import { getStrikeStartDate } from "~/news/strike-notices";
import { useNativeColors } from "~/theme/native-colors";

export function StrikeDetailModal({
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
