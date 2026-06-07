import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { skipToken, useQuery } from "@tanstack/react-query";

import { useTranslation } from "@prossimo-app/localization";

import type { RouterOutputs } from "~/utils/api";
import { settingsScreenBackgroundColor } from "~/theme/native-colors";
import { trpc } from "~/utils/api";

type ServiceAlert = RouterOutputs["alerts"]["getForStop"]["alerts"][number];
type RouteType = "bus" | "metro" | "rail" | "tram" | "unknown";

export default function StopAlertsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    routeId?: string;
    routeLabel?: string;
    routeType?: string;
    stopCode?: string;
    stopId?: string;
    stopName?: string;
  }>();
  const routeId = getParamValue(params.routeId);
  const routeLabel = getParamValue(params.routeLabel);
  const routeType = getRouteTypeParam(params.routeType);
  const stopId = getParamValue(params.stopId);
  const stopCode = getParamValue(params.stopCode);
  const stopName = getParamValue(params.stopName);
  const stopAlertsQuery = useQuery({
    ...trpc.alerts.getForStop.queryOptions(
      stopId && !routeId
        ? {
            limit: 50,
            source: "gtt",
            stopCode,
            stopId,
          }
        : skipToken,
    ),
    staleTime: 60_000,
  });
  const routeAlertsQuery = useQuery({
    ...trpc.alerts.getForRoute.queryOptions(
      routeId
        ? {
            limit: 50,
            routeId,
            routeType,
            source: "gtt",
          }
        : skipToken,
    ),
    staleTime: 60_000,
  });
  const isLoading = routeId
    ? routeAlertsQuery.isLoading
    : stopAlertsQuery.isLoading;
  const alerts = sortServiceAlerts(
    routeId
      ? (routeAlertsQuery.data?.alerts ?? [])
      : (stopAlertsQuery.data?.alerts ?? []),
  );
  const title = routeId
    ? routeLabel
      ? t("home.drawer.arrivals.line", { line: routeLabel })
      : routeId
    : stopName;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: routeId
            ? t("home.drawer.alerts.lineModalTitle")
            : t("home.drawer.alerts.modalTitle"),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          padding: 16,
          paddingBottom: 32,
        }}
        style={{ backgroundColor: settingsScreenBackgroundColor, flex: 1 }}
      >
        {title ? (
          <Text className="text-muted-foreground px-1 font-sans text-sm">
            {title}
          </Text>
        ) : null}

        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : alerts.length > 0 ? (
          alerts.map((alert) => (
            <ServiceAlertCard alert={alert} key={alert.id} />
          ))
        ) : (
          <View className="bg-card rounded-2xl p-4">
            <Text className="text-foreground font-sans text-base font-bold">
              {t("home.drawer.alerts.emptyTitle")}
            </Text>
            <Text className="text-muted-foreground mt-1 font-sans text-sm">
              {t("home.drawer.alerts.emptyDescription")}
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function getRouteTypeParam(
  value: string | string[] | undefined,
): RouteType | null {
  const routeType = getParamValue(value);

  return routeType === "bus" ||
    routeType === "metro" ||
    routeType === "rail" ||
    routeType === "tram" ||
    routeType === "unknown"
    ? routeType
    : null;
}

function sortServiceAlerts(alerts: ServiceAlert[]) {
  return [...alerts].sort(
    (left, right) =>
      (right.severityLevel ?? 0) - (left.severityLevel ?? 0) ||
      right.lastSeenAt.localeCompare(left.lastSeenAt) ||
      left.id.localeCompare(right.id),
  );
}

function ServiceAlertCard({ alert }: { alert: ServiceAlert }) {
  const { t } = useTranslation();
  const style = getServiceAlertStyle(alert.severityLevel);
  const title = alert.title || t("home.drawer.alerts.title");

  return (
    <View
      className={`flex-row items-start gap-3 rounded-2xl border p-4 ${style.containerClassName}`}
    >
      <SymbolView
        name={{ ios: style.iconName, android: "warning" }}
        size={20}
        tintColor={style.iconColor}
      />
      <View className="min-w-0 flex-1 gap-1">
        <Text className={`font-sans text-base font-bold ${style.titleClassName}`}>
          {title}
        </Text>
        {alert.description ? (
          <Text className={`font-sans text-sm ${style.bodyClassName}`}>
            {alert.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function getServiceAlertStyle(severityLevel: number | null) {
  if (severityLevel === 4) {
    return {
      bodyClassName: "text-red-900 dark:text-red-100",
      containerClassName:
        "border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-950",
      iconColor: "#dc2626",
      iconName: "exclamationmark.octagon.fill" as const,
      titleClassName: "text-red-950 dark:text-red-50",
    };
  }

  if (severityLevel === 2) {
    return {
      bodyClassName: "text-blue-900 dark:text-blue-100",
      containerClassName:
        "border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-950",
      iconColor: "#2563eb",
      iconName: "info.circle.fill" as const,
      titleClassName: "text-blue-950 dark:text-blue-50",
    };
  }

  return {
    bodyClassName: "text-amber-900 dark:text-amber-100",
    containerClassName:
      "border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-900",
    iconColor: "#d97706",
    iconName: "exclamationmark.triangle.fill" as const,
    titleClassName: "text-amber-950 dark:text-amber-50",
  };
}
