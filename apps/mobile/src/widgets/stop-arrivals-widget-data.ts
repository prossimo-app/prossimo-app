import { Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";

import { i18n, normalizeLanguage } from "@prossimo-app/localization";

import type {
  PlannedUpcomingTripsOutput,
  StopArrivalsPayload,
  Translate,
} from "~/components/home-bottom-drawer/types";
import type { FavoriteStop } from "~/favorites/favorites-provider";
import type { StopArrivalsWidgetProps } from "~/widgets/stop-arrivals-widget";
import {
  createArrivalGroups,
  createDisplayArrivals,
  formatArrivalMinutes,
  getArrivalDetail,
  normalizeRouteColor,
  parseStopArrivalsPayload,
} from "~/components/home-bottom-drawer/arrival-model";
import { trpcClient } from "~/utils/api";
import { stopArrivalsWidget } from "~/widgets/stop-arrivals-widget";

const STOP_ARRIVALS_WIDGET_TASK = "stop-arrivals-widget-refresh";
const selectedStopStorageKey = "widgets.stopArrivals.selectedStop";
// Must match the key used by SettingsProvider to persist the app language.
const languageStorageKey = "settings.language";

const BACKGROUND_REFRESH_INTERVAL_MINUTES = 15;
const TIMELINE_STEP_MS = 60_000;
const TIMELINE_ENTRY_COUNT = 31;
const MAX_WIDGET_ROWS = 6;
const MAX_TIMES_PER_ROW = 2;

TaskManager.defineTask(STOP_ARRIVALS_WIDGET_TASK, async () => {
  try {
    await refreshStopArrivalsWidgetAsync();

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function getWidgetSelectedStopAsync(): Promise<FavoriteStop | null> {
  const raw = await SecureStore.getItemAsync(selectedStopStorageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Partial<FavoriteStop>).stopId !== "string" ||
      typeof (parsed as Partial<FavoriteStop>).stopName !== "string"
    ) {
      return null;
    }

    const stop = parsed as Partial<FavoriteStop>;

    return {
      stopCode: typeof stop.stopCode === "string" ? stop.stopCode : null,
      stopId: stop.stopId ?? "",
      stopName: stop.stopName ?? "",
    };
  } catch {
    return null;
  }
}

export async function setWidgetSelectedStopAsync(stop: FavoriteStop | null) {
  if (stop) {
    await SecureStore.setItemAsync(
      selectedStopStorageKey,
      JSON.stringify(stop),
    );
  } else {
    await SecureStore.deleteItemAsync(selectedStopStorageKey);
  }

  await refreshStopArrivalsWidgetAsync();
}

/**
 * Recomputes the widget timeline from the selected stop's planned trips and
 * the cached realtime arrivals, then hands it to WidgetKit. One entry per
 * minute keeps the countdowns ticking between refreshes without the widget
 * needing network access of its own.
 */
export async function refreshStopArrivalsWidgetAsync() {
  if (Platform.OS !== "ios") {
    return;
  }

  const t = await getFixedTranslatorAsync();
  const selectedStop = await getWidgetSelectedStopAsync();

  if (!selectedStop) {
    stopArrivalsWidget.updateSnapshot({
      inlineText: t("widgets.stopArrivals.inlineEmpty"),
      message: t("widgets.stopArrivals.noStopSelected"),
      rows: [],
      stopName: t("settings.widget.noneSelected"),
      updatedText: null,
    });

    return;
  }

  const [plannedTripsData, realtimeResult] = await Promise.all([
    trpcClient.transit.getPlannedUpcomingTrips.query({
      stopId: selectedStop.stopId,
    }),
    selectedStop.stopCode
      ? trpcClient.realtime.getTopic
          .query({
            topic: {
              id: selectedStop.stopCode,
              stopCode: selectedStop.stopCode,
              type: "stop",
            },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const realtimePayload = realtimeResult
    ? parseStopArrivalsPayload(realtimeResult.data)
    : null;
  const updatedText = t("widgets.stopArrivals.updatedAt", {
    time: new Intl.DateTimeFormat(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date()),
  });
  const startTimeMs = Date.now();

  stopArrivalsWidget.updateTimeline(
    Array.from({ length: TIMELINE_ENTRY_COUNT }, (_, index) => {
      const entryTimeMs = startTimeMs + index * TIMELINE_STEP_MS;

      return {
        date: new Date(entryTimeMs),
        props: buildWidgetProps({
          entryTimeMs,
          plannedTripsData,
          realtimePayload,
          stopName: selectedStop.stopName,
          t,
          updatedText,
        }),
      };
    }),
  );
}

/**
 * Keeps the widget healthy across app launches: re-registers the background
 * refresh task if needed and pushes a fresh timeline.
 */
export async function syncStopArrivalsWidgetAsync() {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    const status = await BackgroundTask.getStatusAsync();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      STOP_ARRIVALS_WIDGET_TASK,
    );

    if (
      !isRegistered &&
      status === BackgroundTask.BackgroundTaskStatus.Available
    ) {
      await BackgroundTask.registerTaskAsync(STOP_ARRIVALS_WIDGET_TASK, {
        minimumInterval: BACKGROUND_REFRESH_INTERVAL_MINUTES,
      });
    }

    await refreshStopArrivalsWidgetAsync();
  } catch {
    // Widget refresh is best-effort; the next launch or task run retries.
  }
}

async function getFixedTranslatorAsync() {
  const savedLanguage = await SecureStore.getItemAsync(languageStorageKey);

  return i18n.getFixedT(normalizeLanguage(savedLanguage ?? i18n.language));
}

function buildWidgetProps({
  entryTimeMs,
  plannedTripsData,
  realtimePayload,
  stopName,
  t,
  updatedText,
}: {
  entryTimeMs: number;
  plannedTripsData: PlannedUpcomingTripsOutput;
  realtimePayload: StopArrivalsPayload | null;
  stopName: string;
  t: Translate;
  updatedText: string;
}): StopArrivalsWidgetProps {
  const displayArrivals = createDisplayArrivals({
    currentTimeMs: entryTimeMs,
    plannedTripsData,
    realtimePayload,
    selectedStop: null,
  });
  const groups = createArrivalGroups(displayArrivals);
  const rows = groups.slice(0, MAX_WIDGET_ROWS).map((group) => {
    const firstArrival = group.arrivals[0];

    return {
      color: normalizeRouteColor(group.color),
      headsign: firstArrival ? getArrivalDetail(firstArrival, t) : "",
      isLive: firstArrival?.isRealtime ?? false,
      line: group.label,
      times: group.arrivals
        .slice(0, MAX_TIMES_PER_ROW)
        .map((arrival) =>
          formatArrivalMinutes(arrival.arrivalInSeconds, arrival.isRealtime, t),
        ),
    };
  });
  const firstRow = rows[0];

  return {
    inlineText: firstRow
      ? `${firstRow.line} · ${firstRow.times[0] ?? ""}`
      : t("widgets.stopArrivals.inlineEmpty"),
    message: rows.length > 0 ? null : t("widgets.stopArrivals.empty"),
    rows,
    stopName,
    updatedText,
  };
}
