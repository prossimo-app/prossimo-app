import { useEffect, useState } from "react";
import CheckIcon from "@expo/material-symbols/check.xml";
import { Column, FieldGroup, Host, Icon, ListItem, Text } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { useTranslation } from "@prossimo-app/localization";

import type { FavoriteStop } from "~/favorites/favorites-provider";
import { useFavorites } from "~/favorites/favorites-provider";
import { useNativeColors } from "~/theme/native-colors";
import {
  getWidgetSelectedStopAsync,
  setWidgetSelectedStopAsync,
} from "~/widgets/stop-arrivals-widget-data";

const fullScreenListModifiers = [
  frame({ maxHeight: Infinity, maxWidth: Infinity }),
];

const checkIcon = Icon.select({
  ios: "checkmark",
  android: CheckIcon,
});

export default function WidgetStopScreen() {
  const { t } = useTranslation();
  const { favoriteStops, hasLoadedFavorites } = useFavorites();
  const { secondaryTextColor, settingsScreenBackgroundColor } =
    useNativeColors();
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getWidgetSelectedStopAsync().then((stop) => {
      if (isMounted) {
        setSelectedStopId(stop?.stopId ?? null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectStop = (stop: FavoriteStop | null) => {
    setSelectedStopId(stop?.stopId ?? null);
    void setWidgetSelectedStopAsync(stop);
  };

  return (
    <Host
      style={{
        backgroundColor: settingsScreenBackgroundColor,
        flex: 1,
      }}
    >
      <Column
        alignment="center"
        spacing={14}
        modifiers={fullScreenListModifiers}
      >
        <FieldGroup
          modifiers={fullScreenListModifiers}
          style={{
            backgroundColor: settingsScreenBackgroundColor,
          }}
          testID="widget-stop-list"
        >
          <FieldGroup.Section title={t("settings.widget.label")}>
            <ListItem
              onPress={() => {
                handleSelectStop(null);
              }}
              supportingText={t("settings.widget.none")}
            >
              {selectedStopId === null ? (
                <ListItem.Trailing>
                  <Icon name={checkIcon} size={18} />
                </ListItem.Trailing>
              ) : null}
            </ListItem>

            {favoriteStops.map((stop) => (
              <ListItem
                key={stop.stopId}
                onPress={() => {
                  handleSelectStop(stop);
                }}
                supportingText={stop.stopName}
              >
                {selectedStopId === stop.stopId ? (
                  <ListItem.Trailing>
                    <Icon name={checkIcon} size={18} />
                  </ListItem.Trailing>
                ) : null}
              </ListItem>
            ))}

            <FieldGroup.SectionFooter>
              <Text
                textStyle={{
                  color: secondaryTextColor,
                  fontSize: 12,
                }}
              >
                {hasLoadedFavorites && favoriteStops.length === 0
                  ? t("settings.widget.noFavorites")
                  : t("settings.widget.description")}
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        </FieldGroup>
      </Column>
    </Host>
  );
}
