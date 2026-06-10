import type { WidgetEnvironment } from "expo-widgets";
import { createWidget } from "expo-widgets";
import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
} from "@expo/ui/swift-ui/modifiers";

export interface StopArrivalsWidgetRow {
  color: string;
  headsign: string;
  isLive: boolean;
  line: string;
  times: string[];
}

export interface StopArrivalsWidgetProps {
  inlineText: string;
  message: string | null;
  rows: StopArrivalsWidgetRow[];
  stopName: string;
  updatedText: string | null;
}

// All user-facing strings arrive pre-localized through props: the widget
// function body is serialized by the `'widget'` babel directive and runs in
// the widget extension, where i18next is not available. For the same reason
// every bit of logic has to live inside this single function — outer helpers
// are not part of the serialized code.
function StopArrivalsWidgetView(
  props: StopArrivalsWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const family = environment.widgetFamily;
  const liveColor = "#16a34a";
  const mutedColor = "#6b7280";

  if (family === "accessoryInline") {
    return <Text>{props.inlineText}</Text>;
  }

  if (family === "accessoryRectangular") {
    return (
      <VStack
        alignment="leading"
        spacing={1}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <Text
          modifiers={[font({ size: 13, weight: "semibold" }), lineLimit(1)]}
        >
          {props.stopName}
        </Text>
        {props.message !== null ? (
          <Text modifiers={[font({ size: 12 }), lineLimit(2)]}>
            {props.message}
          </Text>
        ) : (
          props.rows.slice(0, 2).map((row, index) => (
            <HStack key={`${row.line}:${index}`} spacing={4}>
              <Text modifiers={[font({ size: 12, weight: "bold" })]}>
                {row.line}
              </Text>
              <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>
                {row.times.join(" · ")}
              </Text>
              <Spacer />
            </HStack>
          ))
        )}
      </VStack>
    );
  }

  const maxRows = family === "systemSmall" ? 3 : 4;

  return (
    <VStack
      alignment="leading"
      spacing={family === "systemSmall" ? 4 : 6}
      modifiers={[
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
          alignment: "topLeading",
        }),
      ]}
    >
      <HStack spacing={4}>
        <Text
          modifiers={[font({ size: 14, weight: "semibold" }), lineLimit(1)]}
        >
          {props.stopName}
        </Text>
        <Spacer />
        {family !== "systemSmall" && props.updatedText !== null ? (
          <Text modifiers={[font({ size: 10 }), foregroundStyle(mutedColor)]}>
            {props.updatedText}
          </Text>
        ) : null}
      </HStack>
      {props.message !== null ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(mutedColor)]}>
          {props.message}
        </Text>
      ) : (
        props.rows.slice(0, maxRows).map((row, index) => (
          <HStack key={`${row.line}:${index}`} spacing={6}>
            <Text
              modifiers={[
                font({ size: 11, weight: "bold" }),
                foregroundStyle("#ffffff"),
                padding({ horizontal: 6, vertical: 2 }),
                background(row.color),
                cornerRadius(7),
                lineLimit(1),
              ]}
            >
              {row.line}
            </Text>
            {family === "systemSmall" ? (
              <>
                <Spacer />
                <Text
                  modifiers={[
                    font({ size: 12, weight: "semibold" }),
                    foregroundStyle(row.isLive ? liveColor : mutedColor),
                    lineLimit(1),
                  ]}
                >
                  {row.times[0] ?? ""}
                </Text>
              </>
            ) : (
              <>
                <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>
                  {row.headsign}
                </Text>
                <Spacer />
                <Text
                  modifiers={[
                    font({ size: 12, weight: "semibold" }),
                    foregroundStyle(row.isLive ? liveColor : mutedColor),
                    lineLimit(1),
                  ]}
                >
                  {row.times.join(" · ")}
                </Text>
              </>
            )}
          </HStack>
        ))
      )}
      <Spacer />
    </VStack>
  );
}

export const stopArrivalsWidget = createWidget<StopArrivalsWidgetProps>(
  "StopArrivals",
  StopArrivalsWidgetView,
);
