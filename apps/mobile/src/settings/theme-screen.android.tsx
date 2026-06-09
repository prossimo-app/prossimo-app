import { useColorScheme } from "react-native";
import BrightnessAutoIcon from "@expo/material-symbols/brightness_auto.xml";
import DarkModeIcon from "@expo/material-symbols/dark_mode.xml";
import LightModeIcon from "@expo/material-symbols/light_mode.xml";
import {
  Column,
  Host,
  RadioButton,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxSize,
  padding,
  testID,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";

import { useTranslation } from "@prossimo-app/localization";

import {
  MaterialListGroup,
  MaterialListRow,
} from "~/components/material-list";
import type { ThemeOption } from "~/settings/settings-provider";
import { themeOptions, useSettings } from "~/settings/settings-provider";

const themeOptionIcons: Record<
  ThemeOption,
  React.ComponentProps<typeof MaterialListRow>["icon"]
> = {
  system: BrightnessAutoIcon,
  dark: DarkModeIcon,
  light: LightModeIcon,
};

const screenModifiers = [
  fillMaxSize(),
  verticalScroll(),
  padding(16, 0, 16, 24),
  testID("theme-list"),
];

export default function ThemeScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = useMaterialColors({ colorScheme });
  const { hasLoadedSettings, setTheme, theme } = useSettings();

  return (
    <Host
      colorScheme={colorScheme}
      style={{
        backgroundColor: colors.surface,
        flex: 1,
      }}
    >
      <Column modifiers={screenModifiers}>
        <MaterialListGroup>
          {themeOptions.map((option, index) => {
            const selectOption = hasLoadedSettings
              ? () => {
                  void setTheme(option);
                }
              : undefined;

            return (
              <MaterialListRow
                headline={t(`settings.theme.options.${option}`)}
                icon={themeOptionIcons[option]}
                iconAccessibilityLabel={t(`settings.theme.options.${option}`)}
                isFirstInGroup={index === 0}
                isLastInGroup={index === themeOptions.length - 1}
                key={option}
                onPress={selectOption}
                trailing={
                  <RadioButton
                    onClick={selectOption}
                    selected={theme === option}
                  />
                }
              />
            );
          })}
        </MaterialListGroup>
      </Column>
    </Host>
  );
}
