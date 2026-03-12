// /__tests__/MediaRuleEngine.test.ts

import {
  defaultMediaRuleConfig,
  defaultMediaRuleState,
  stepMediaRule,
  type MediaRuleState,
} from "../src/media/MediaRuleEngine";

describe("stepMediaRule", () => {
  it("does not output PLAY immediately on the first second inZone is true", () => {
    const result = stepMediaRule({
      nowMs: 0,
      inZone: true,
      config: defaultMediaRuleConfig,
      state: { ...defaultMediaRuleState },
    });

    // The Expectations, what should happen
    expect(result.intent).toBeNull();
    expect(result.nextState.mode).toBe("PAUSED");
    expect(result.nextState.inSinceMs).toBe(0);
  });

  it("outputs PLAY after the resume delay", () => {
    let state: MediaRuleState = { ...defaultMediaRuleState };

    const first = stepMediaRule({
      nowMs: 0,
      inZone: true,
      config: defaultMediaRuleConfig,
      state,
    });
    state = first.nextState;

    const second = stepMediaRule({
      nowMs: defaultMediaRuleConfig.resumeAfterMs,
      inZone: true,
      config: defaultMediaRuleConfig,
      state,
    });

    expect(second.intent).toBe("PLAY");
    expect(second.nextState.mode).toBe("PLAYING");
    expect(second.nextState.inSinceMs).toBeNull();
  });

  it("outputs PAUSE after the pause delay", () => {
    let state: MediaRuleState = {
      ...defaultMediaRuleState,
      mode: "PLAYING",
    };

    const first = stepMediaRule({
      nowMs: 0,
      inZone: false,
      config: defaultMediaRuleConfig,
      state,
    });
    state = first.nextState;

    const second = stepMediaRule({
      nowMs: defaultMediaRuleConfig.pauseAfterMs,
      inZone: false,
      config: defaultMediaRuleConfig,
      state,
    });

    expect(second.intent).toBe("PAUSE");
    expect(second.nextState.mode).toBe("PAUSED");
    expect(second.nextState.outSinceMs).toBeNull();
  });

  it("does nothing when the rule is disabled", () => {
    const result = stepMediaRule({
      nowMs: 5000,
      inZone: false,
      config: {
        ...defaultMediaRuleConfig,
        enabled: false,
      },
      state: {
        ...defaultMediaRuleState,
        mode: "PLAYING",
        outSinceMs: 1000,
      },
    });

    expect(result.intent).toBeNull();
    expect(result.nextState.outSinceMs).toBeNull();
    expect(result.nextState.inSinceMs).toBeNull();
  });
});
