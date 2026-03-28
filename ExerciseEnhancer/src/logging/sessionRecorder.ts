// src/logging/sessionRecorder.ts
import type { SessionRecord, SessionSample } from "./sessionTypes";

type CreateSessionRecordInput = {
  startedAtMs: number;
  vt1: number | null;
};

type AppendSessionSampleInput = Omit<SessionSample, "recordedAtIso">;

// create a session id from the workout start time.
function buildSessionId(startedAtMs: number): string {
  return `session-${startedAtMs}`;
}


// Create a new session record when a workout starts.
export function createSessionRecord({
  startedAtMs,
  vt1,
}: CreateSessionRecordInput): SessionRecord {
  return {
    sessionId: buildSessionId(startedAtMs),
    startedAtMs,
    startedAtIso: new Date(startedAtMs).toISOString(),
    endedAtMs: null,
    endedAtIso: null,
    vt1,
    samples: [],
  };
}

// Append one sample to the current session.
// recordedAtIso is created from recordedAtMs so that both formats stay the same.
export function appendSessionSample(
  record: SessionRecord,
  sample: AppendSessionSampleInput,
): void {
  record.samples.push({
    ...sample,
    recordedAtIso: new Date(sample.recordedAtMs).toISOString(),
  });
}

// finish the session with an end time before saving or exporting.
export function finishSessionRecord(
  record: SessionRecord,
  endedAtMs: number,
): SessionRecord {
  return {
    ...record,
    endedAtMs,
    endedAtIso: new Date(endedAtMs).toISOString(),
  };
}