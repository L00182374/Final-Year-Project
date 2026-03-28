import { Buffer } from "buffer";
import {
  calculateCadenceRpm,
  parseCscMeasurement,
  parseHeartRateMeasurement,
} from "../src/ble/parsers";

describe("BLE parsers", () => {
  it("parses 8 bit heart rate", () => {
    const value = Buffer.from([0x00, 72]).toString("base64");
    expect(parseHeartRateMeasurement(value)).toBe(72);
  });

  it("parses 16 bit heart rate", () => {
    const value = Buffer.from([0x01, 0x2c, 0x01]).toString("base64");
    expect(parseHeartRateMeasurement(value)).toBe(300);
  });

  it("parses CSC crank only measurement", () => {
    const value = Buffer.from([0x02, 0x10, 0x00, 0x00, 0x04]).toString("base64");

    expect(parseCscMeasurement(value)).toEqual({
      cumulativeCrankRevs: 16,
      lastCrankEventTime: 1024,
    });
  });

  it("calculates cadence RPM from two crank measurements", () => {
    const previous = {
      cumulativeCrankRevs: 10,
      lastCrankEventTime: 0,
    };

    const current = {
      cumulativeCrankRevs: 11,
      lastCrankEventTime: 1024,
    };

    expect(calculateCadenceRpm(previous, current)).toBe(60);
  });

  it("returns null when there is no previous crank sample", () => {
    const current = {
      cumulativeCrankRevs: 11,
      lastCrankEventTime: 1024,
    };

    expect(calculateCadenceRpm(null, current)).toBeNull();
  });
});