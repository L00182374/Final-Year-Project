// Zone labels used by the workout screen and media logic.
export type ZoneLabel = "ZONE 2" | "BELOW" | "ABOVE" | "N/A";

// Cadence state is used to decide whether the cadence aligns with the current Zone.
export type CadenceStateLabel = "HR only" | "Signal lost" | "Stopped" | "Too low" | "OK";

export type CadenceStateResult = {
  ok: boolean;
  label: CadenceStateLabel;
};

export type ZoneManagerConfig = {
  hrAlpha: number;
  cadenceAlpha: number;
  zoneTwoLowFactor: number;
  minActiveCadenceRpm: number;
  stoppedCadenceRpm: number;
  enterHysteresisMs: number;
  exitHysteresisMs: number;
  signalLossGraceMs: number;
};

export type ZoneManagerInput = {
  nowMs: number;
  active: boolean;
  vt1: number | null;
  heartRate: number | null;
  cadence: number | null;
  hrFresh: boolean;
  cadenceFresh: boolean;
  cadenceDeviceConnected: boolean;
};

export type ZoneManagerState = {
  hrEma: number | null;
  cadenceEma: number | null;

  hrSmooth: number | null;
  cadenceSmooth: number | null;

  cadenceState: CadenceStateResult;
  rawZone: ZoneLabel;   // rawZone is the zone decision made before hysteresis is applied.
  zone: ZoneLabel;

  candidateZone: ZoneLabel | null;
  candidateSinceMs: number | null;

  signalLossSinceMs: number | null;
  signalGraceActive: boolean;

  inZone: boolean;
  timeInZoneMs: number;
  timeOutOfZoneMs: number;

  lastTickMs: number | null;
};

export const defaultZoneManagerConfig: ZoneManagerConfig = {
  hrAlpha: 0.25,
  cadenceAlpha: 0.25,
  zoneTwoLowFactor: 0.85,
  minActiveCadenceRpm: 40,
  stoppedCadenceRpm: 15,
  enterHysteresisMs: 3000,
  exitHysteresisMs: 2000,
  signalLossGraceMs: 2000,
};

export const defaultZoneManagerState: ZoneManagerState = {
  hrEma: null,
  cadenceEma: null,

  hrSmooth: null,
  cadenceSmooth: null,

  cadenceState: {
    ok: true,
    label: "HR only",
  },
  rawZone: "N/A",
  zone: "N/A",

  candidateZone: null,
  candidateSinceMs: null,

  signalLossSinceMs: null,
  signalGraceActive: false,

  inZone: false,
  timeInZoneMs: 0,
  timeOutOfZoneMs: 0,

  lastTickMs: null,
};

// Smooth noisy sensor values using exponential moving average EMA smoothing.
export function smoothSensorValue(
  previous: number | null,
  next: number | null,
  alpha: number,
): number | null {
  if (next == null) return null;
  if (previous == null) return next;
  return previous * (1 - alpha) + next * alpha;
}

export function getCadenceState(params: {
  cadenceDeviceConnected: boolean;
  cadenceFresh: boolean;
  cadenceRpm: number | null;
  minActiveCadenceRpm: number;
  stoppedCadenceRpm: number;
}): CadenceStateResult {
  const {
    cadenceDeviceConnected,
    cadenceFresh,
    cadenceRpm,
    minActiveCadenceRpm,
    stoppedCadenceRpm,
  } = params;

  // If no cadence sensor is connected, fall back to heart rate only for zone decisions.
  if (!cadenceDeviceConnected) {
    return {
      ok: true,
      label: "HR only",
    };
  }

  if (!cadenceFresh || cadenceRpm == null) {
    return {
      ok: false,
      label: "Signal lost",
    };
  }

  if (cadenceRpm < stoppedCadenceRpm) {
    return {
      ok: false,
      label: "Stopped",
    };
  }

  if (cadenceRpm < minActiveCadenceRpm) {
    return {
      ok: false,
      label: "Too low",
    };
  }

  return {
    ok: true,
    label: "OK",
  };
}

export function getZoneColour(zone: ZoneLabel): string {
  if (zone === "ZONE 2") return "#16a34a";
  if (zone === "N/A") return "#6b7280";
  return "#ef4444";
}

export function isInZone(zone: ZoneLabel): boolean {
  return zone === "ZONE 2";
}

function getRawZone(params: {
  vt1: number | null;
  hrFresh: boolean;
  hrBpm: number | null;
  cadenceStateOk: boolean;
  zoneTwoLowFactor: number;
}): ZoneLabel {
  const { vt1, hrFresh, hrBpm, cadenceStateOk, zoneTwoLowFactor } = params;

  if (vt1 == null || !hrFresh || hrBpm == null) {
    return "N/A";
  }

  if (!cadenceStateOk) {
    return "BELOW";
  }

  const zoneTwoHigh = vt1;
  const zoneTwoLow = Math.round(vt1 * zoneTwoLowFactor);

  if (hrBpm >= zoneTwoLow && hrBpm <= zoneTwoHigh) {
    return "ZONE 2";
  }

  if (hrBpm < zoneTwoLow) {
    return "BELOW";
  }

  return "ABOVE";
}

// Step the zone manager forward using the latest sensor state.
// Hysteresis is used to reduce flicker around zone boundaries.
// A grace period is used to avoid drops due to any brief signal loss.
export function stepZoneManager(params: {
  input: ZoneManagerInput;
  state: ZoneManagerState;
  config?: Partial<ZoneManagerConfig>;
}): ZoneManagerState {
  const config: ZoneManagerConfig = {
    ...defaultZoneManagerConfig,
    ...params.config,
  };

  const { input, state } = params;

  const hrNext = smoothSensorValue(
    state.hrEma,
    input.hrFresh ? input.heartRate : null,
    config.hrAlpha,
  );

  const cadenceNext = smoothSensorValue(
    state.cadenceEma,
    input.cadenceFresh ? input.cadence : null,
    config.cadenceAlpha,
  );

  const hrSmooth = hrNext == null ? null : Math.round(hrNext);
  const cadenceSmooth = cadenceNext == null ? null : Math.round(cadenceNext);

  const cadenceState = getCadenceState({
    cadenceDeviceConnected: input.cadenceDeviceConnected,
    cadenceFresh: input.cadenceFresh,
    cadenceRpm: cadenceSmooth,
    minActiveCadenceRpm: config.minActiveCadenceRpm,
    stoppedCadenceRpm: config.stoppedCadenceRpm,
  });

  const hrSignalLost = !input.hrFresh || hrSmooth == null;
  const cadenceSignalLost =
    input.cadenceDeviceConnected &&
    (!input.cadenceFresh || cadenceSmooth == null);

  const hasSignalLoss = hrSignalLost || cadenceSignalLost;

  let signalLossSinceMs = state.signalLossSinceMs;
  let signalGraceActive = false;

  if (hasSignalLoss) {
    if (signalLossSinceMs == null) {
      signalLossSinceMs = input.nowMs;
    }

    signalGraceActive =
      input.nowMs - signalLossSinceMs < config.signalLossGraceMs;
  } else {
    signalLossSinceMs = null;
    signalGraceActive = false;
  }

  const rawZone = hasSignalLoss
    ? "N/A"
    : getRawZone({
        vt1: input.vt1,
        hrFresh: input.hrFresh,
        hrBpm: hrSmooth,
        cadenceStateOk: cadenceState.ok,
        zoneTwoLowFactor: config.zoneTwoLowFactor,
      });

  let zone = state.zone;
  let candidateZone = state.candidateZone;
  let candidateSinceMs = state.candidateSinceMs;

  if (signalGraceActive) {
    candidateZone = null;
    candidateSinceMs = null;
  } else if (hasSignalLoss) {
    zone = "N/A";
    candidateZone = null;
    candidateSinceMs = null;
  } else if (zone === "N/A") {
    zone = rawZone;
    candidateZone = null;
    candidateSinceMs = null;
  } else if (rawZone === zone) {
    candidateZone = null;
    candidateSinceMs = null;
  } else {
    const requiredMs =
      rawZone === "ZONE 2"
        ? config.enterHysteresisMs
        : config.exitHysteresisMs;

    if (candidateZone !== rawZone) {
      candidateZone = rawZone;
      candidateSinceMs = input.nowMs;
    } else if (
      candidateSinceMs != null &&
      input.nowMs - candidateSinceMs >= requiredMs
    ) {
      zone = rawZone;
      candidateZone = null;
      candidateSinceMs = null;
    }
  }

  const deltaMs =
    state.lastTickMs == null ? 0 : Math.max(0, input.nowMs - state.lastTickMs);

  let timeInZoneMs = state.timeInZoneMs;
  let timeOutOfZoneMs = state.timeOutOfZoneMs;

  if (input.active) {
    if (zone === "ZONE 2") {
      timeInZoneMs += deltaMs;
    } else {
      timeOutOfZoneMs += deltaMs;
    }
  }

  return {
    hrEma: hrNext,
    cadenceEma: cadenceNext,

    hrSmooth,
    cadenceSmooth,

    cadenceState,
    rawZone,
    zone,

    candidateZone,
    candidateSinceMs,

    signalLossSinceMs,
    signalGraceActive,

    inZone: isInZone(zone),
    timeInZoneMs,
    timeOutOfZoneMs,

    lastTickMs: input.nowMs,
  };
}