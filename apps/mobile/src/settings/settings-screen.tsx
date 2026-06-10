import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import AnalyticsIcon from "@expo/material-symbols/analytics.xml";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import ContractIcon from "@expo/material-symbols/contract.xml";
import DarkModeIcon from "@expo/material-symbols/dark_mode.xml";
import LanguageIcon from "@expo/material-symbols/language.xml";
import LocationOnIcon from "@expo/material-symbols/location_on.xml";
import OpenInNewIcon from "@expo/material-symbols/open_in_new.xml";
import PrivacyTipIcon from "@expo/material-symbols/privacy_tip.xml";
import RestartAltIcon from "@expo/material-symbols/restart_alt.xml";
import StorageIcon from "@expo/material-symbols/storage.xml";
import WidgetsIcon from "@expo/material-symbols/widgets.xml";
import {
  Button,
  Column,
  FieldGroup,
  Host,
  Icon,
  ListItem,
  Picker,
  Row,
  Text,
} from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { languageOptions, useTranslation } from "@prossimo-app/localization";

import { useOnboarding } from "~/onboarding/onboarding-provider";
import { getAppVersion } from "~/settings/app-version";
import { getLegalDocumentUrl } from "~/settings/legal-documents";
import { useSettings } from "~/settings/settings-provider";
import { useNativeColors } from "~/theme/native-colors";

const fullWidthButtonModifiers = [frame({ maxWidth: Infinity, minHeight: 32 })];
const fullScreenListModifiers = [
  frame({ maxHeight: Infinity, maxWidth: Infinity }),
];
const fullWidthColumnModifiers = [frame({ maxWidth: Infinity })];

const appUsageIcon = Icon.select({
  ios: "chart.bar.fill",
  android: AnalyticsIcon,
});
const locationSharingIcon = Icon.select({
  ios: "location.fill",
  android: LocationOnIcon,
});
const themeIcon = Icon.select({
  ios: "circle.lefthalf.filled",
  android: DarkModeIcon,
});
const languageIcon = Icon.select({
  ios: "globe",
  android: LanguageIcon,
});
const chevronIcon = Icon.select({
  ios: "chevron.forward",
  android: ChevronRightIcon,
});
const privacyPolicyIcon = Icon.select({
  ios: "hand.raised.fill",
  android: PrivacyTipIcon,
});
const termsIcon = Icon.select({
  ios: "doc.text.fill",
  android: ContractIcon,
});
const dataSourcesIcon = Icon.select({
  ios: "externaldrive.fill",
  android: StorageIcon,
});
const externalLinkIcon = Icon.select({
  ios: "arrow.up.forward",
  android: OpenInNewIcon,
});
const resetOnboardingIcon = Icon.select({
  ios: "arrow.counterclockwise",
  android: RestartAltIcon,
});
const widgetIcon = Icon.select({
  ios: "square.grid.2x2.fill",
  android: WidgetsIcon,
});

interface SettingIconProps {
  accessibilityLabel: string;
  color: string;
  name: React.ComponentProps<typeof Icon>["name"];
}

function SettingIcon({ accessibilityLabel, color, name }: SettingIconProps) {
  return (
    <Icon
      accessibilityLabel={accessibilityLabel}
      color="white"
      name={name}
      size={18}
      style={{
        backgroundColor: color,
        borderRadius: 7,
        height: 28,
        width: 28,
      }}
    />
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { resetOnboarding } = useOnboarding();
  const { secondaryTextColor, settingsScreenBackgroundColor } =
    useNativeColors();
  const appVersion = getAppVersion();
  const {
    hasLoadedSettings,
    isLocationSharingEnabled,
    isShareAppUsageEnabled,
    language,
    theme,
    setLanguage,
  } = useSettings();

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
          testID="settings-list"
        >
          <FieldGroup.Section title={t("settings.sections.preferences")}>
            <ListItem
              onPress={() => {
                router.push("/settings/theme");
              }}
              supportingText={t("settings.theme.label")}
            >
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t("settings.theme.accessibilityLabel")}
                  color="#5e5ce6"
                  name={themeIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Row alignment="center" spacing={8}>
                  <Text
                    textStyle={{
                      color: secondaryTextColor,
                    }}
                  >
                    {t(`settings.theme.options.${theme}`)}
                  </Text>
                  <Icon name={chevronIcon} size={18} />
                </Row>
              </ListItem.Trailing>
            </ListItem>

            <ListItem supportingText={t("settings.language.label")}>
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t("settings.language.accessibilityLabel")}
                  color="#ff9f0a"
                  name={languageIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Picker
                  enabled={hasLoadedSettings}
                  onValueChange={(value) => {
                    void setLanguage(value);
                  }}
                  selectedValue={language}
                  testID="settings-language-picker"
                >
                  {languageOptions.map((languageOption) => (
                    <Picker.Item
                      key={languageOption.code}
                      label={languageOption.nativeLabel}
                      value={languageOption.code}
                    />
                  ))}
                </Picker>
              </ListItem.Trailing>
            </ListItem>

            <ListItem
              onPress={() => {
                router.push("/settings/widget");
              }}
              supportingText={t("settings.widget.label")}
            >
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t("settings.widget.accessibilityLabel")}
                  color="#0a84ff"
                  name={widgetIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Icon name={chevronIcon} size={18} />
              </ListItem.Trailing>
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section title={t("settings.sections.privacy")}>
            <ListItem
              onPress={() => {
                router.push("/settings/tracking");
              }}
              supportingText={t("settings.appUsage.label")}
            >
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t("settings.appUsage.accessibilityLabel")}
                  color={isShareAppUsageEnabled ? "#30d158" : "#ff453a"}
                  name={appUsageIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Icon name={chevronIcon} size={18} />
              </ListItem.Trailing>
            </ListItem>

            <ListItem
              onPress={() => {
                router.push("/settings/location-sharing");
              }}
              supportingText={t("settings.locationSharing.label")}
            >
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t(
                    "settings.locationSharing.accessibilityLabel",
                  )}
                  color={isLocationSharingEnabled ? "#30d158" : "#ff453a"}
                  name={locationSharingIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Icon name={chevronIcon} size={18} />
              </ListItem.Trailing>
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section title={t("settings.sections.legal")}>
            <ListItem
              onPress={() => {
                void WebBrowser.openBrowserAsync(
                  getLegalDocumentUrl("privacy-policy"),
                );
              }}
              supportingText={t("settings.legal.privacyPolicy")}
            >
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t(
                    "settings.legal.privacyPolicyAccessibilityLabel",
                  )}
                  color="#5856d6"
                  name={privacyPolicyIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Icon name={externalLinkIcon} size={18} />
              </ListItem.Trailing>
            </ListItem>

            <ListItem
              onPress={() => {
                void WebBrowser.openBrowserAsync(getLegalDocumentUrl("terms"));
              }}
              supportingText={t("settings.legal.termsOfUse")}
            >
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t(
                    "settings.legal.termsOfUseAccessibilityLabel",
                  )}
                  color="#ff9f0a"
                  name={termsIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Icon name={externalLinkIcon} size={18} />
              </ListItem.Trailing>
            </ListItem>

            <ListItem
              onPress={() => {
                router.push("/settings/data-sources");
              }}
              supportingText={t("settings.legal.dataSources")}
            >
              <ListItem.Leading>
                <SettingIcon
                  accessibilityLabel={t(
                    "settings.legal.dataSourcesAccessibilityLabel",
                  )}
                  color="#32ade6"
                  name={dataSourcesIcon}
                />
              </ListItem.Leading>
              <ListItem.Trailing>
                <Icon name={chevronIcon} size={18} />
              </ListItem.Trailing>
            </ListItem>

            <FieldGroup.SectionFooter>
              <Column
                alignment="center"
                spacing={14}
                modifiers={fullWidthColumnModifiers}
              >
                <Text
                  textStyle={{
                    color: secondaryTextColor,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {t("settings.version", { version: appVersion })}
                </Text>

                {__DEV__ ? (
                  <Button
                    modifiers={fullWidthButtonModifiers}
                    onPress={() => {
                      void resetOnboarding();
                    }}
                    variant="outlined"
                  >
                    <Row spacing={6} alignment="center">
                      <Icon
                        accessibilityLabel={t(
                          "settings.developerTools.resetOnboardingAccessibilityLabel",
                        )}
                        name={resetOnboardingIcon}
                        size={16}
                      />
                      <Text>
                        {t("settings.developerTools.resetOnboarding")}
                      </Text>
                    </Row>
                  </Button>
                ) : null}
              </Column>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        </FieldGroup>
      </Column>
    </Host>
  );
}
