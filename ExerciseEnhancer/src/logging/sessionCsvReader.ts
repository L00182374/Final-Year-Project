// src/logging/sessionCsvReader.ts
import type { CadenceStateLabel, ZoneLabel } from "../zone/ZoneManager";

// Parsed session types are used when reading saved CSV workout files back into the app.
export type ParsedSessionSample = {
  recordedAtIso: string;
  elapsedMs: number;

  heartRateRaw: number | null;
  heartRateSmooth: number | null;
  hrFresh: boolean;

  cadenceRaw: number | null;
  cadenceSmooth: number | null;
  cadenceFresh: boolean;

  zone: ZoneLabel;
  cadenceState: CadenceStateLabel;
  inZone: boolean;
  signalGraceActive: boolean;

  timeInZoneMs: number;
  timeOutOfZoneMs: number;

  mediaPlaying: boolean;
};

export type ParsedSessionFile = {
  sessionId: string;
  startedAtIso: string;
  endedAtIso: string | null;
  vt1: number | null;
  samples: ParsedSessionSample[];
};

function toNumber(value: string | undefined): number | null {
  if (value == null || value === "") return null;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toBoolean(value: string | undefined): boolean {
  return value === "true";
}

function toZoneLabel(value: string | undefined): ZoneLabel {
  if (
    value === "ZONE 2" ||
    value === "BELOW" ||
    value === "ABOVE" ||
    value === "N/A"
  ) {
    return value;
  }

  return "N/A";
}

function toCadenceStateLabel(value: string | undefined): CadenceStateLabel {
  if (
    value === "HR only" ||
    value === "Signal lost" ||
    value === "Stopped" ||
    value === "Too low" ||
    value === "OK"
  ) {
    return value;
  }

  return "Signal lost";
}

// Parse CSV text produced by the app back into a typed session object.
// This reader assumes that the user is reading a CSV created by the app, so the CSV matches the apps saved session format.
export function parseSessionCsvText(text: string): ParsedSessionFile {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      sessionId: "",
      startedAtIso: "",
      endedAtIso: null,
      vt1: null,
      samples: [],
    };
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 2) {
    return {
      sessionId: "",
      startedAtIso: "",
      endedAtIso: null,
      vt1: null,
      samples: [],
    };
  }

  const headers = lines[0].split(",");

  const samples: ParsedSessionSample[] = lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return {
      recordedAtIso: row.recordedAtIso ?? "",
      elapsedMs: toNumber(row.elapsedMs) ?? 0,

      heartRateRaw: toNumber(row.heartRateRaw),
      heartRateSmooth: toNumber(row.heartRateSmooth),
      hrFresh: toBoolean(row.hrFresh),

      cadenceRaw: toNumber(row.cadenceRaw),
      cadenceSmooth: toNumber(row.cadenceSmooth),
      cadenceFresh: toBoolean(row.cadenceFresh),

      zone: toZoneLabel(row.zone),
      cadenceState: toCadenceStateLabel(row.cadenceState),
      inZone: toBoolean(row.inZone),
      signalGraceActive: toBoolean(row.signalGraceActive),

      timeInZoneMs: toNumber(row.timeInZoneMs) ?? 0,
      timeOutOfZoneMs: toNumber(row.timeOutOfZoneMs) ?? 0,

      mediaPlaying: toBoolean(row.mediaPlaying),
    };
  });

  const firstDataLine = lines[1]?.split(",") ?? [];

  const firstRow: Record<string, string> = {};
  headers.forEach((header, index) => {
    firstRow[header] = firstDataLine[index] ?? "";
  });

  return {
    sessionId: firstRow.sessionId ?? "",
    startedAtIso: firstRow.startedAtIso ?? "",
    endedAtIso: firstRow.endedAtIso || null,
    vt1: toNumber(firstRow.vt1),
    samples,
  };
}