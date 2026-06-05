export const italianTimeZone = "Europe/Rome";

export interface ItalianTimeSnapshot {
  date: string;
  daySeconds: number;
  iso: string;
  timeZone: typeof italianTimeZone;
}

export function getItalianTimeSnapshot(date = new Date()): ItalianTimeSnapshot {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: italianTimeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const hour = Number(values.hour ?? 0);
  const minute = Number(values.minute ?? 0);
  const second = Number(values.second ?? 0);

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    daySeconds: hour * 3_600 + minute * 60 + second,
    iso: date.toISOString(),
    timeZone: italianTimeZone,
  };
}
