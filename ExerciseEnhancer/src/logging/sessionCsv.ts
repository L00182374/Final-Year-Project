// src/logging/sessionCsv.ts
import type { SessionRecord } from "./sessionTypes";

// I enforce a specific column order for the CSV file, which is important for consistency and in order to parse correctly
const HEADER = [
  "sessionId",
  "startedAtIso",
  "endedAtIso",
  "vt1",
  "recordedAtIso",
  "elapsedMs",
  "heartRateRaw",
  "heartRateSmooth",
  "hrFresh",
  "cadenceRaw",
  "cadenceSmooth",
  "cadenceFresh",
  "zone",
  "cadenceState",
  "inZone",
  "signalGraceActive",
  "timeInZoneMs",
  "timeOutOfZoneMs",
  "mediaPlaying",
];

// escape values so any commas, quotes, or line breaks remain valid in the CSV output.
function escapeCsvValue(value: string | number | boolean | null): string {
  if (value == null) return "";
  const text = String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

// Build a readable filename based on the session start time.
export function buildSessionCsvFilename(record: SessionRecord): string {
  const safeTimestamp = record.startedAtIso.replace(/[:.]/g, "-");
  return `workout-${safeTimestamp}.csv`;
}

// Serialise a full session record to CSV text.
// Session level fields are repeated on each row so every sample stays self contained.
export function serialiseSessionToCsv(record: SessionRecord): string {
  const lines = [HEADER.join(",")];

  for (const sample of record.samples) {
    const row = [
      record.sessionId,
      record.startedAtIso,
      record.endedAtIso,
      record.vt1,
      sample.recordedAtIso,
      sample.elapsedMs,
      sample.heartRateRaw,
      sample.heartRateSmooth,
      sample.hrFresh,
      sample.cadenceRaw,
      sample.cadenceSmooth,
      sample.cadenceFresh,
      sample.zone,
      sample.cadenceState,
      sample.inZone,
      sample.signalGraceActive,
      sample.timeInZoneMs,
      sample.timeOutOfZoneMs,
      sample.mediaPlaying,
    ].map(escapeCsvValue);

    lines.push(row.join(","));
  }

  return lines.join("\n");
}