// src/logging/sessionCsvReader.ts
import type { CadenceStateLabel, ZoneLabel } from "../zone/ZoneManager";

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
      elapsedMs: Number(row.elapsedMs ?? 0),

      heartRateRaw: toNumber(row.heartRateRaw),
      heartRateSmooth: toNumber(row.heartRateSmooth),
      hrFresh: toBoolean(row.hrFresh),

      cadenceRaw: toNumber(row.cadenceRaw),
      cadenceSmooth: toNumber(row.cadenceSmooth),
      cadenceFresh: toBoolean(row.cadenceFresh),

      zone: (row.zone as ZoneLabel) ?? "N/A",
      cadenceState: (row.cadenceState as CadenceStateLabel) ?? "Signal lost",
      inZone: toBoolean(row.inZone),
      signalGraceActive: toBoolean(row.signalGraceActive),

      timeInZoneMs: Number(row.timeInZoneMs ?? 0),
      timeOutOfZoneMs: Number(row.timeOutOfZoneMs ?? 0),

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