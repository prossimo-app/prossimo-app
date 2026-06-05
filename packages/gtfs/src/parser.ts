import type { GtfsStaticTextEntry, GtfsStaticTextFile } from "./static.js";

export type GtfsRow = Record<string, string>;

export type GtfsParsedTextEntries = Partial<
  Record<GtfsStaticTextFile, GtfsRow[]>
>;

function pushRecord(records: string[][], record: string[], field: string) {
  records.push([...record, field]);
}

function parseCsvRecords(text: string) {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);

    if (inQuotes) {
      if (character === '"') {
        if (text.charAt(index + 1) === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      record.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      pushRecord(records, record, field);
      record = [];
      field = "";
      continue;
    }

    if (character === "\r") {
      if (text.charAt(index + 1) === "\n") {
        index += 1;
      }

      pushRecord(records, record, field);
      record = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new Error("Invalid GTFS CSV: unterminated quoted field");
  }

  if (field.length > 0 || record.length > 0) {
    pushRecord(records, record, field);
  }

  return records;
}

export function parseGtfsCsv(text: string) {
  const records = parseCsvRecords(text);
  const [rawHeaders, ...rows] = records;

  if (!rawHeaders) {
    return [];
  }

  const headers = rawHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "") : header,
  );

  return rows
    .filter((row) => row.some((value) => value.length > 0))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ""]),
      ),
    );
}

export function parseGtfsTextEntry(entry: GtfsStaticTextEntry) {
  return parseGtfsCsv(entry.contents);
}

export function parseGtfsTextEntries(entries: readonly GtfsStaticTextEntry[]) {
  const parsedEntries: GtfsParsedTextEntries = {};

  for (const entry of entries) {
    parsedEntries[entry.name] = parseGtfsTextEntry(entry);
  }

  return parsedEntries;
}
