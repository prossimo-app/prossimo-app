import {
  Linking,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import {
  Button,
  Card,
  Column,
  Host,
  RNHostView,
  Row,
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
  weight,
} from "@expo/ui/jetpack-compose/modifiers";

// Material 3 detail screen shared by the Android location-sharing and
// tracking settings screens: a permission status card, illustrated
// how-to steps, and a button that opens the system settings. Only import
// this module from `.android.tsx` files — it pulls in
// `@expo/ui/jetpack-compose`, which requires the Android-only Compose
// native views.

export interface MaterialPermissionStep {
  image: React.ComponentProps<typeof Image>["source"];
  imageAspectRatio: number;
  title: string;
}

export interface MaterialPermissionDetailProps {
  currentOptionTitle: string;
  currentOptionValue: string;
  description: string;
  isEnabled: boolean;
  screenTestID: string;
  settingsActionLabel: string;
  statusText: string;
  steps: MaterialPermissionStep[];
}

export function MaterialPermissionDetail({
  currentOptionTitle,
  currentOptionValue,
  description,
  isEnabled,
  screenTestID,
  settingsActionLabel,
  statusText,
  steps,
}: MaterialPermissionDetailProps) {
  const colorScheme = useColorScheme();
  const colors = useMaterialColors({ colorScheme });
  const { width } = useWindowDimensions();
  const imageWidth = Math.min(width - 88, 360);
  const statusColor = isEnabled ? colors.primary : colors.error;

  return (
    <Host
      colorScheme={colorScheme}
      style={{
        backgroundColor: colors.surface,
        flex: 1,
      }}
    >
      <Column
        modifiers={[
          fillMaxSize(),
          verticalScroll(),
          padding(16, 0, 16, 24),
          testID(screenTestID),
        ]}
        verticalArrangement={{ spacedBy: 16 }}
      >
        <Card
          colors={{ containerColor: colors.surfaceContainer }}
          modifiers={[fillMaxWidth()]}
        >
          <Column
            modifiers={[paddingAll(16)]}
            verticalArrangement={{ spacedBy: 8 }}
          >
            <Text color={statusColor} style={{ typography: "titleMedium" }}>
              {statusText}
            </Text>
            <Text
              color={colors.onSurfaceVariant}
              style={{ typography: "bodyMedium" }}
            >
              {description}
            </Text>
            <Row
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}
              verticalAlignment="center"
            >
              <Text
                color={colors.onSurface}
                modifiers={[weight(1)]}
                style={{ typography: "titleSmall" }}
              >
                {currentOptionTitle}
              </Text>
              <Text color={statusColor} style={{ typography: "titleSmall" }}>
                {currentOptionValue}
              </Text>
            </Row>
          </Column>
        </Card>

        {steps.map((step, index) => (
          <Card
            colors={{ containerColor: colors.surfaceContainer }}
            key={step.title}
            modifiers={[fillMaxWidth()]}
          >
            <Column
              horizontalAlignment="center"
              modifiers={[fillMaxWidth(), paddingAll(12)]}
              verticalArrangement={{ spacedBy: 12 }}
            >
              <Text
                color={colors.onSurface}
                modifiers={[fillMaxWidth()]}
                style={{ typography: "titleSmall" }}
              >
                {`${index + 1}. ${step.title}`}
              </Text>
              <RNHostView matchContents>
                <View
                  style={{
                    aspectRatio: step.imageAspectRatio,
                    borderRadius: 12,
                    overflow: "hidden",
                    width: imageWidth,
                  }}
                >
                  <Image
                    accessibilityLabel={step.title}
                    contentFit="contain"
                    source={step.image}
                    style={{ height: "100%", width: "100%" }}
                  />
                </View>
              </RNHostView>
            </Column>
          </Card>
        ))}

        <Button
          modifiers={[fillMaxWidth()]}
          onClick={() => {
            void Linking.openSettings();
          }}
        >
          <Text>{settingsActionLabel}</Text>
        </Button>
      </Column>
    </Host>
  );
}
