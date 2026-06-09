import { Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";

import { i18n, normalizeLanguage } from "@prossimo-app/localization";

import type { StrikeTiming } from "~/news/strike-notices";
import { getStrikeTiming, isVisibleStrikeNotice } from "~/news/strike-notices";
import { trpcClient } from "~/utils/api";

const STRIKE_NOTIFICATIONS_TASK = "strike-notifications-check";
const STRIKE_CHANNEL_ID = "strike-alerts";
const enabledStorageKey = "notifications.strikeAlertsEnabled";
const notifiedStorageKey = "notifications.strikeAlertsNotified";
// Must match the key used by SettingsProvider to persist the app language.
const languageStorageKey = "settings.language";

const BACKGROUND_CHECK_INTERVAL_MINUTES = 12 * 60;
const NOTIFIED_RECORD_MAX_AGE_MS = 7 * 86_400_000;

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

TaskManager.defineTask(STRIKE_NOTIFICATIONS_TASK, async () => {
  try {
    const didRun = await checkStrikesAndNotifyAsync();

    return didRun
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export function isNotificationPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus,
) {
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function getStrikeNotificationsEnabledAsync() {
  const value = await SecureStore.getItemAsync(enabledStorageKey);

  return value === "true";
}

async function ensureStrikeNotificationChannelAsync() {
  if (Platform.OS !== "android") {
    return;
  }

  const t = await getFixedTranslatorAsync();

  await Notifications.setNotificationChannelAsync(STRIKE_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.HIGH,
    name: t("news.notifications.channelName"),
  });
}

async function getFixedTranslatorAsync() {
  const savedLanguage = await SecureStore.getItemAsync(languageStorageKey);

  return i18n.getFixedT(normalizeLanguage(savedLanguage ?? i18n.language));
}

type NotifiedRecord = Record<string, string>;

async function readNotifiedRecordAsync(): Promise<NotifiedRecord> {
  const raw = await SecureStore.getItemAsync(notifiedStorageKey);

  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as NotifiedRecord;
    }
  } catch {
    // Corrupted record; start fresh.
  }

  return {};
}

function pruneNotifiedRecord(record: NotifiedRecord, now: Date) {
  const pruned: NotifiedRecord = {};

  for (const [key, notifiedAt] of Object.entries(record)) {
    const notifiedTime = new Date(notifiedAt).getTime();

    if (
      Number.isFinite(notifiedTime) &&
      now.getTime() - notifiedTime < NOTIFIED_RECORD_MAX_AGE_MS
    ) {
      pruned[key] = notifiedAt;
    }
  }

  return pruned;
}

/**
 * Fetches the latest strike notices and presents a notification for every
 * definite strike happening today or tomorrow that has not been announced yet.
 * Returns false when notifications are disabled or permission was revoked.
 */
export async function checkStrikesAndNotifyAsync(now = new Date()) {
  const isEnabled = await getStrikeNotificationsEnabledAsync();

  if (!isEnabled) {
    return false;
  }

  const permission = await Notifications.getPermissionsAsync();

  if (!isNotificationPermissionGranted(permission)) {
    return false;
  }

  const { strikes } = await trpcClient.news.getLatest.query({});
  const upcomingStrikes = strikes.filter(
    (strike) =>
      isVisibleStrikeNotice(strike, now) &&
      (getStrikeTiming(strike, now) === "today" ||
        getStrikeTiming(strike, now) === "tomorrow"),
  );
  const notifiedRecord = pruneNotifiedRecord(
    await readNotifiedRecordAsync(),
    now,
  );
  const t = await getFixedTranslatorAsync();
  let hasNewNotifications = false;

  for (const strike of upcomingStrikes) {
    const timing = getStrikeTiming(strike, now) as Extract<
      StrikeTiming,
      "today" | "tomorrow"
    >;
    const strikeKey = `${strike.id}:${timing}`;

    if (notifiedRecord[strikeKey]) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        body: strike.title || t(`news.notifications.${timing}Body`),
        title: t(`news.notifications.${timing}Title`),
      },
      trigger:
        Platform.OS === "android" ? { channelId: STRIKE_CHANNEL_ID } : null,
    });

    notifiedRecord[strikeKey] = now.toISOString();
    hasNewNotifications = true;
  }

  if (hasNewNotifications || Object.keys(notifiedRecord).length > 0) {
    await SecureStore.setItemAsync(
      notifiedStorageKey,
      JSON.stringify(notifiedRecord),
    );
  }

  return true;
}

/**
 * Turns strike notifications on: persists the flag, ensures the Android
 * channel exists, registers the daily background check, and runs an immediate
 * check so a strike today/tomorrow is announced right away.
 *
 * Callers must have obtained notification permission beforehand.
 */
export async function enableStrikeNotificationsAsync() {
  await ensureStrikeNotificationChannelAsync();
  await SecureStore.setItemAsync(enabledStorageKey, "true");

  const status = await BackgroundTask.getStatusAsync();

  if (status === BackgroundTask.BackgroundTaskStatus.Available) {
    await BackgroundTask.registerTaskAsync(STRIKE_NOTIFICATIONS_TASK, {
      minimumInterval: BACKGROUND_CHECK_INTERVAL_MINUTES,
    });
  }

  await checkStrikesAndNotifyAsync();
}

export async function disableStrikeNotificationsAsync() {
  await SecureStore.setItemAsync(enabledStorageKey, "false");

  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    STRIKE_NOTIFICATIONS_TASK,
  );

  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(STRIKE_NOTIFICATIONS_TASK);
  }
}

/**
 * Keeps notifications healthy across app launches: re-registers the
 * background task if needed and runs a check, so opening the app also counts
 * as the daily strike check.
 */
export async function syncStrikeNotificationsAsync() {
  try {
    const isEnabled = await getStrikeNotificationsEnabledAsync();

    if (!isEnabled) {
      return;
    }

    const permission = await Notifications.getPermissionsAsync();

    if (!isNotificationPermissionGranted(permission)) {
      return;
    }

    const status = await BackgroundTask.getStatusAsync();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      STRIKE_NOTIFICATIONS_TASK,
    );

    if (
      !isRegistered &&
      status === BackgroundTask.BackgroundTaskStatus.Available
    ) {
      await BackgroundTask.registerTaskAsync(STRIKE_NOTIFICATIONS_TASK, {
        minimumInterval: BACKGROUND_CHECK_INTERVAL_MINUTES,
      });
    }

    await checkStrikesAndNotifyAsync();
  } catch {
    // Background sync is best-effort; the next launch or task run retries.
  }
}
