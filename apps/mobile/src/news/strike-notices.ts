import type { RouterOutputs } from "~/utils/api";

export type StrikeNotice =
  RouterOutputs["news"]["getLatest"]["strikes"][number];

export type StrikeTiming = "incoming" | "nextWeek" | "today" | "tomorrow";

function getValidDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDifference(left: Date, right: Date) {
  const leftDay = startOfLocalDay(left).getTime();
  const rightDay = startOfLocalDay(right).getTime();

  return Math.round((leftDay - rightDay) / 86_400_000);
}

function getWeekStart(date: Date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = startOfLocalDay(date);

  weekStart.setDate(weekStart.getDate() + mondayOffset);

  return weekStart;
}

export function getStrikeStartDate(strike: StrikeNotice) {
  return getValidDate(strike.startsAt);
}

export function isVisibleStrikeNotice(strike: StrikeNotice, now = new Date()) {
  if (strike.relevanceStatus !== "definite") {
    return false;
  }

  const startsAt = getStrikeStartDate(strike);
  const endsAt = getValidDate(strike.endsAt);

  if (endsAt) {
    return endsAt >= now;
  }

  return startsAt ? startsAt >= startOfLocalDay(now) : false;
}

export function isImminentStrikeNotice(strike: StrikeNotice, now = new Date()) {
  if (!isVisibleStrikeNotice(strike, now)) {
    return false;
  }

  const timing = getStrikeTiming(strike, now);

  return timing === "today" || timing === "tomorrow";
}

export function getStrikeTiming(strike: StrikeNotice, now = new Date()) {
  const startsAt = getStrikeStartDate(strike);

  if (!startsAt) {
    return "incoming";
  }

  const dayDifference = getDayDifference(startsAt, now);

  if (dayDifference === 0) {
    return "today";
  }

  if (dayDifference === 1) {
    return "tomorrow";
  }

  const nextWeekStart = getWeekStart(now);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  const followingWeekStart = new Date(nextWeekStart);
  followingWeekStart.setDate(followingWeekStart.getDate() + 7);

  if (startsAt >= nextWeekStart && startsAt < followingWeekStart) {
    return "nextWeek";
  }

  return "incoming";
}
