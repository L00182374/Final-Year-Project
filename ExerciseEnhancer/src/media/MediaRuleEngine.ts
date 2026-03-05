// /src/media/MediaRuleEngine.ts

export type MediaIntent = "PLAY" | "PAUSE" | null;

export type MediaRuleConfig = {
  pauseAfterMs: number; // such as 10_000
  resumeAfterMs: number; // such as 2_000
  enabled: boolean;
};

export type MediaRuleState = {
  mode: "PLAYING" | "PAUSED";
  outSinceMs: number | null;
  inSinceMs: number | null;
};

export const defaultMediaRuleConfig: MediaRuleConfig = {
  pauseAfterMs: 10_000,
  resumeAfterMs: 2_000,
  enabled: true,
};

export const defaultMediaRuleState: MediaRuleState = {
  mode: "PLAYING",
  outSinceMs: null,
  inSinceMs: null,
};

/**
 * step function.
 * - inZone=true means, keep playing / resume
 * - inZone=false means out-of-zone, start the pause timer
 */
export function stepMediaRule(params: {
  nowMs: number;
  inZone: boolean;
  config: MediaRuleConfig;
  state: MediaRuleState;
}): { nextState: MediaRuleState; intent: MediaIntent } {
  const { nowMs, inZone, config, state } = params;

  if (!config.enabled) {
    // rule disabled, clear timers, do nothing
    return {
      nextState: { ...state, outSinceMs: null, inSinceMs: null },
      intent: null,
    };
  }

  // in zone logic, resumes after stable inZone duration if currently paused
  if (inZone) {
    const next: MediaRuleState = {
      ...state,
      outSinceMs: null,
      inSinceMs: state.inSinceMs ?? nowMs, // ?? means if the first thing is null then assign the second
    };

    if (state.mode === "PAUSED") {
      const inFor = nowMs - (next.inSinceMs ?? nowMs);
      if (inFor >= config.resumeAfterMs) {
        return {
          nextState: { ...next, mode: "PLAYING", inSinceMs: null },
          intent: "PLAY",
        };
      }
    }

    // already playing or not yet stable
    if (state.mode === "PLAYING") {
      return { nextState: { ...next, inSinceMs: null }, intent: null };
    }
    return { nextState: next, intent: null };
  }

  // out of zone logic, pause after out-of-zone duration , if currently playing
  const next: MediaRuleState = {
    ...state,
    inSinceMs: null,
    outSinceMs: state.outSinceMs ?? nowMs,
  };

  if (state.mode === "PLAYING") {
    const outFor = nowMs - (next.outSinceMs ?? nowMs);
    if (outFor >= config.pauseAfterMs) {
      return {
        nextState: { ...next, mode: "PAUSED", outSinceMs: null },
        intent: "PAUSE",
      };
    }
  }

  // already paused or not yet timed out
  if (state.mode === "PAUSED") {
    return { nextState: { ...next, outSinceMs: null }, intent: null };
  }
  return { nextState: next, intent: null };
}
