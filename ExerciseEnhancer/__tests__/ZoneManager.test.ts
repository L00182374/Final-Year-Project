import {
  defaultZoneManagerConfig,
  defaultZoneManagerState,
  getCadenceState,
  getZoneColour,
  isInZone,
  smoothSensorValue,
  stepZoneManager,
} from "../src/zone/ZoneManager";

describe("ZoneManager", () => {
  it("returns HR only when cadence is not required for the workout", () => {
    expect(
      getCadenceState({
        cadenceRequired: false,
        cadenceDeviceConnected: false,
        cadenceFresh: false,
        cadenceRpm: null,
        minActiveCadenceRpm: 40,
        stoppedCadenceRpm: 15,
      }),
    ).toEqual({
      ok: true,
      label: "HR only",
    });
  });

  it("returns Signal lost when cadence is required but no cadence device is connected", () => {
    expect(
      getCadenceState({
        cadenceRequired: true,
        cadenceDeviceConnected: false,
        cadenceFresh: false,
        cadenceRpm: null,
        minActiveCadenceRpm: 40,
        stoppedCadenceRpm: 15,
      }),
    ).toEqual({
      ok: false,
      label: "Signal lost",
    });
  });

  it("returns Signal lost when cadence data is stale", () => {
    expect(
      getCadenceState({
        cadenceRequired: true,
        cadenceDeviceConnected: true,
        cadenceFresh: false,
        cadenceRpm: null,
        minActiveCadenceRpm: 40,
        stoppedCadenceRpm: 15,
      }),
    ).toEqual({
      ok: false,
      label: "Signal lost",
    });
  });

  it("returns Stopped when cadence is extremely low", () => {
    expect(
      getCadenceState({
        cadenceRequired: true,
        cadenceDeviceConnected: true,
        cadenceFresh: true,
        cadenceRpm: 10,
        minActiveCadenceRpm: 40,
        stoppedCadenceRpm: 15,
      }),
    ).toEqual({
      ok: false,
      label: "Stopped",
    });
  });

  it("returns Too low when cadence is below the active threshold", () => {
    expect(
      getCadenceState({
        cadenceRequired: true,
        cadenceDeviceConnected: true,
        cadenceFresh: true,
        cadenceRpm: 30,
        minActiveCadenceRpm: 40,
        stoppedCadenceRpm: 15,
      }),
    ).toEqual({
      ok: false,
      label: "Too low",
    });
  });

  it("returns OK when cadence is high enough", () => {
    expect(
      getCadenceState({
        cadenceRequired: true,
        cadenceDeviceConnected: true,
        cadenceFresh: true,
        cadenceRpm: 75,
        minActiveCadenceRpm: 40,
        stoppedCadenceRpm: 15,
      }),
    ).toEqual({
      ok: true,
      label: "OK",
    });
  });

  it("smooths a sensor value when there is a previous reading", () => {
    expect(smoothSensorValue(100, 120, 0.25)).toBe(105);
  });

  it("returns the incoming value when there is no previous reading", () => {
    expect(smoothSensorValue(null, 120, 0.25)).toBe(120);
  });

  it("returns null when the incoming reading is null", () => {
    expect(smoothSensorValue(100, null, 0.25)).toBeNull();
  });

  // Cadence is not required here, so the zone decision should fall back to heart rate only.
  it("sets an initial valid zone immediately", () => {
    const next = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
    });

    expect(next.zone).toBe("ZONE 2");
    expect(next.inZone).toBe(true);
  });

  // Use hrAlpha 1 so this test isolates hysteresis rather than EMA smoothing.
  it("applies exit hysteresis before leaving Zone 2", () => {
    let state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    state = stepZoneManager({
      state,
      input: {
        nowMs: 1000,
        active: true,
        vt1: 150,
        heartRate: 156,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    expect(state.zone).toBe("ZONE 2");
    expect(state.candidateZone).toBe("ABOVE");

    state = stepZoneManager({
      state,
      input: {
        nowMs: 3200,
        active: true,
        vt1: 150,
        heartRate: 156,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    expect(state.zone).toBe("ABOVE");
    expect(state.inZone).toBe(false);
  });

  // Use hrAlpha 1 so this test isolates hysteresis rather than EMA smoothing.
  it("applies entry hysteresis before returning to Zone 2", () => {
    let state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 120,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    expect(state.zone).toBe("BELOW");

    state = stepZoneManager({
      state,
      input: {
        nowMs: 1000,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    expect(state.zone).toBe("BELOW");
    expect(state.candidateZone).toBe("ZONE 2");

    state = stepZoneManager({
      state,
      input: {
        nowMs: 4200,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    expect(state.zone).toBe("ZONE 2");
    expect(state.inZone).toBe(true);
  });

  // Cadence is required here so signal loss handling is tested in workout mode.
  it("holds the previous zone during a brief signal loss", () => {
    let state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: 80,
        hrFresh: true,
        cadenceFresh: true,
        cadenceDeviceConnected: true,
        cadenceRequired: true,
      },
    });

    expect(state.zone).toBe("ZONE 2");

    state = stepZoneManager({
      state,
      input: {
        nowMs: 1000,
        active: true,
        vt1: 150,
        heartRate: null,
        cadence: 80,
        hrFresh: false,
        cadenceFresh: true,
        cadenceDeviceConnected: true,
        cadenceRequired: true,
      },
    });

    expect(state.signalGraceActive).toBe(true);
    expect(state.zone).toBe("ZONE 2");
  });

  it("moves to N/A after the signal loss grace period expires", () => {
    let state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: 80,
        hrFresh: true,
        cadenceFresh: true,
        cadenceDeviceConnected: true,
        cadenceRequired: true,
      },
    });

    state = stepZoneManager({
      state,
      input: {
        nowMs: 1000,
        active: true,
        vt1: 150,
        heartRate: null,
        cadence: 80,
        hrFresh: false,
        cadenceFresh: true,
        cadenceDeviceConnected: true,
        cadenceRequired: true,
      },
    });

    state = stepZoneManager({
      state,
      input: {
        nowMs: 1000 + defaultZoneManagerConfig.signalLossGraceMs + 100,
        active: true,
        vt1: 150,
        heartRate: null,
        cadence: 80,
        hrFresh: false,
        cadenceFresh: true,
        cadenceDeviceConnected: true,
        cadenceRequired: true,
      },
    });

    expect(state.signalGraceActive).toBe(false);
    expect(state.zone).toBe("N/A");
    expect(state.inZone).toBe(false);
  });

  // Cadence is required here so low cadence forces a BELOW result.
  it("treats low cadence as BELOW", () => {
    const state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: 20,
        hrFresh: true,
        cadenceFresh: true,
        cadenceDeviceConnected: true,
        cadenceRequired: true,
      },
      config: {
        cadenceAlpha: 1,
      },
    });

    expect(state.cadenceState.label).toBe("Too low");
    expect(state.zone).toBe("BELOW");
  });

  // A stopped cadence should use the raw current cadence and not wait for smoothed values to decay.
  it("classifies a zero cadence as Stopped immediately", () => {
    const state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: 0,
        hrFresh: true,
        cadenceFresh: true,
        cadenceDeviceConnected: true,
        cadenceRequired: true,
      },
    });

    expect(state.cadenceState.label).toBe("Stopped");
    expect(state.rawZone).toBe("BELOW");
  });

  it("tracks time in zone and out of zone while active", () => {
    let state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    state = stepZoneManager({
      state,
      input: {
        nowMs: 1000,
        active: true,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    expect(state.timeInZoneMs).toBe(1000);
    expect(state.timeOutOfZoneMs).toBe(0);

    state = stepZoneManager({
      state,
      input: {
        nowMs: 2000,
        active: true,
        vt1: 150,
        heartRate: 156,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    state = stepZoneManager({
      state,
      input: {
        nowMs: 4200,
        active: true,
        vt1: 150,
        heartRate: 156,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    state = stepZoneManager({
      state,
      input: {
        nowMs: 5200,
        active: true,
        vt1: 150,
        heartRate: 156,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
      config: {
        hrAlpha: 1,
      },
    });

    expect(state.timeInZoneMs).toBe(2000);
    expect(state.timeOutOfZoneMs).toBe(3200);
  });

  it("does not add zone time while inactive", () => {
    let state = stepZoneManager({
      state: defaultZoneManagerState,
      input: {
        nowMs: 0,
        active: false,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
    });

    state = stepZoneManager({
      state,
      input: {
        nowMs: 3000,
        active: false,
        vt1: 150,
        heartRate: 140,
        cadence: null,
        hrFresh: true,
        cadenceFresh: false,
        cadenceDeviceConnected: false,
        cadenceRequired: false,
      },
    });

    expect(state.timeInZoneMs).toBe(0);
    expect(state.timeOutOfZoneMs).toBe(0);
  });

  it("returns the correct zone colour", () => {
    expect(getZoneColour("ZONE 2")).toBe("#16a34a");
    expect(getZoneColour("N/A")).toBe("#6b7280");
    expect(getZoneColour("ABOVE")).toBe("#ef4444");
  });

  it("reports inzone correctly", () => {
    expect(isInZone("ZONE 2")).toBe(true);
    expect(isInZone("BELOW")).toBe(false);
  });
});