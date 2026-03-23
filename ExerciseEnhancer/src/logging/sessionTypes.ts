// src/logging/SessionTypes.ts
import type { CadenceStateLabel, ZoneLabel } from "../zone/ZoneManager";

// A single recorded point within a workout session
export type SessionSample = {
  recordedAtMs: number;
  recordedAtIso: string;
  elapsedMs: number;

  // Raw sensor values are the actual BLE readings and Smoothed values are the filtered values that are used by the app logic
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

    // A total time in zone saved at the moment this sample was recorded
  timeInZoneMs: number;
  timeOutOfZoneMs: number;

  mediaPlaying: boolean;
};

export type SessionRecord = {
  sessionId: string;
  startedAtMs: number;
  startedAtIso: string;
  endedAtMs: number | null;
  endedAtIso: string | null;
  vt1: number | null;
  samples: SessionSample[];
};
