import { useState } from "react";
import { useColorScheme } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import ContractIcon from "@expo/material-symbols/contract.xml";
import DarkModeIcon from "@expo/material-symbols/dark_mode.xml";
import LanguageIcon from "@expo/material-symbols/language.xml";
import LocationOnIcon from "@expo/material-symbols/location_on.xml";
import OpenInNewIcon from "@expo/material-symbols/open_in_new.xml";
import PrivacyTipIcon from "@expo/material-symbols/privacy_tip.xml";
import StorageIcon from "@expo/material-symbols/storage.xml";
import {
  Button,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Host,
  Icon,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxSize,
  fillMaxWidth,
  padding,
  testID,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";

import { languageOptions, useTranslation } from "@prossimo-app/localization";

import {
  MaterialListGroup,
  MaterialListRow,
  MaterialSectionHeader,
} from "~/components/material-list";
import { useOnboarding } from "~/onboarding/onboarding-provider";
import { getAppVersion } from "~/settings/app-version";
import { getLegalDocumentUrl } from "~/settings/legal-documents";
import { useSettings } from "~/settings/settings-provider";

const screenModifiers = [
  fillMaxSize(),
  verticalScroll(),
  padding(16, 0, 16, 24),
  testID("settings-list"),
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { resetOnboarding } = useOnboarding();
  const colorScheme = useColorScheme();
  const colors = useMaterialColors({ colorScheme });
  const appVersion = getAppVersion();
  const [isLanguageMenuExpanded, setIsLanguageMenuExpanded] = useState(false);
  const {
    hasLoadedSettings,
    isLocationSharingEnabled,
    language,
    theme,
    setLanguage,
  } = useSettings();

  const selectedLanguageLabel = languageOptions.find(
    (languageOption) => languageOption.code === language,
  )?.nativeLabel;

  const externalLinkIcon = (
    <Icon size={20} source={OpenInNewIcon} tint={colors.onSurfaceVariant} />
  );

  return (
    <Host
      colorScheme={colorScheme}
      style={{
        backgroundColor: colors.surface,
        flex: 1,
      }}
    >
      <Column modifiers={screenModifiers}>
        <MaterialSectionHeader>
          {t("settings.sections.preferences")}
        </MaterialSectionHeader>
        <MaterialListGroup>
          <MaterialListRow
            headline={t("settings.theme.label")}
            icon={DarkModeIcon}
            iconAccessibilityLabel={t("settings.theme.accessibilityLabel")}
            isFirstInGroup
            onPress={() => {
              router.push("/settings/theme");
            }}
            supportingText={t(`settings.theme.options.${theme}`)}
          />

          <DropdownMenu
            expanded={isLanguageMenuExpanded}
            modifiers={[fillMaxWidth()]}
            onDismissRequest={() => {
              setIsLanguageMenuExpanded(false);
            }}
          >
            <DropdownMenu.Items>
              {languageOptions.map((languageOption) => (
                <DropdownMenuItem
                  key={languageOption.code}
                  onClick={() => {
                    setIsLanguageMenuExpanded(false);
                    void setLanguage(languageOption.code);
                  }}
                >
                  <DropdownMenuItem.Text>
                    <Text>{languageOption.nativeLabel}</Text>
                  </DropdownMenuItem.Text>
                </DropdownMenuItem>
              ))}
            </DropdownMenu.Items>
            <MaterialListRow
              headline={t("settings.language.label")}
              icon={LanguageIcon}
              iconAccessibilityLabel={t("settings.language.accessibilityLabel")}
              isLastInGroup
              onPress={
                hasLoadedSettings
                  ? () => {
                      setIsLanguageMenuExpanded(true);
                    }
                  : undefined
              }
              supportingText={selectedLanguageLabel}
            />
          </DropdownMenu>
        </MaterialListGroup>

        <MaterialSectionHeader>
          {t("settings.sections.privacy")}
        </MaterialSectionHeader>
        <MaterialListGroup>
          <MaterialListRow
            headline={t("settings.locationSharing.label")}
            icon={LocationOnIcon}
            iconAccessibilityLabel={t(
              "settings.locationSharing.accessibilityLabel",
            )}
            isLastInGroup
            onPress={() => {
              router.push("/settings/location-sharing");
            }}
            supportingText={t(
              isLocationSharingEnabled
                ? "settings.locationSharing.status.shared"
                : "settings.locationSharing.status.disabled",
            )}
          />
        </MaterialListGroup>

        <MaterialSectionHeader>
          {t("settings.sections.legal")}
        </MaterialSectionHeader>
        <MaterialListGroup>
          <MaterialListRow
            headline={t("settings.legal.privacyPolicy")}
            icon={PrivacyTipIcon}
            iconAccessibilityLabel={t(
              "settings.legal.privacyPolicyAccessibilityLabel",
            )}
            isFirstInGroup
            onPress={() => {
              void WebBrowser.openBrowserAsync(
                getLegalDocumentUrl("privacy-policy"),
              );
            }}
            trailing={externalLinkIcon}
          />
          <MaterialListRow
            headline={t("settings.legal.termsOfUse")}
            icon={ContractIcon}
            iconAccessibilityLabel={t(
              "settings.legal.termsOfUseAccessibilityLabel",
            )}
            onPress={() => {
              void WebBrowser.openBrowserAsync(getLegalDocumentUrl("terms"));
            }}
            trailing={externalLinkIcon}
          />
          <MaterialListRow
            headline={t("settings.legal.dataSources")}
            icon={StorageIcon}
            iconAccessibilityLabel={t(
              "settings.legal.dataSourcesAccessibilityLabel",
            )}
            isLastInGroup
            onPress={() => {
              router.push("/settings/data-sources");
            }}
          />
        </MaterialListGroup>

        <Column
          horizontalAlignment="center"
          modifiers={[fillMaxWidth(), padding(16, 32, 16, 0)]}
          verticalArrangement={{ spacedBy: 12 }}
        >
          <Text
            color={colors.onSurfaceVariant}
            style={{ textAlign: "center", typography: "bodySmall" }}
          >
            {t("settings.version", { version: appVersion })}
          </Text>

          {__DEV__ ? (
            <Button
              onClick={() => {
                void resetOnboarding();
              }}
            >
              <Text>{t("settings.developerTools.resetOnboarding")}</Text>
            </Button>
          ) : null}
        </Column>
      </Column>
    </Host>
  );
}
