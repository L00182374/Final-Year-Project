// src/ble/parsers.ts
import { Buffer } from "buffer";

// Cycling Speed and Cadence Measurement
export type CscMeasurement = {
  cumulativeCrankRevs: number;
  lastCrankEventTime: number;
};

// Parse the Heart Rate Measurement characteristic value. 
export function parseHeartRateMeasurement(base64Value: string): number | null {
  try {
    const bytes = Buffer.from(base64Value, "base64");
    const flags = bytes.readUInt8(0);
    const isHeartRate16Bit = (flags & 0x01) !== 0; //Bit 0 of the flags field shows whether 16 bit or 8 bit values are being used

    return isHeartRate16Bit ? bytes.readUInt16LE(1) : bytes.readUInt8(1);
  } catch (error) {
    console.warn("parseHeartRateMeasurement error", error);
    return null;
  }
}

// Parse the Cadence Measurement characteristic value
export function parseCscMeasurement(
  base64Value: string,
): CscMeasurement | null {
  try {
    const bytes = Buffer.from(base64Value, "base64");
    let offset = 0;

    const flags = bytes.readUInt8(offset);
    offset += 1;

    const wheelPresent = (flags & 0x01) !== 0; // Bit 0 indicates if wheel data is present
    const crankPresent = (flags & 0x02) !== 0; // Bit 1 indicates if crank data is present

    if (!crankPresent) return null;

    if (wheelPresent) {
      offset += 4; // cumulative wheel revolutions
      offset += 2; // last wheel event time
    }

    const cumulativeCrankRevs = bytes.readUInt16LE(offset);
    offset += 2;

    const lastCrankEventTime = bytes.readUInt16LE(offset);
    offset += 2;

    return {
      cumulativeCrankRevs,
      lastCrankEventTime,
    };
  } catch (error) {
    console.warn("parseCscMeasurement error", error);
    return null;
  }
}

// Calculate cadence in RPM from two from the difference between two crank samples.
export function calculateCadenceRpm(
  previous: CscMeasurement | null,
  current: CscMeasurement,
): number | null {
  if (!previous) return null;

  const sameRevs = current.cumulativeCrankRevs === previous.cumulativeCrankRevs; // Check if cumulative revolutions are the same

  const sameEventTime = current.lastCrankEventTime === previous.lastCrankEventTime; // Check if event times are the same

  if (sameRevs && sameEventTime) {
    return 0;
  }

  let deltaRevs = current.cumulativeCrankRevs - previous.cumulativeCrankRevs; // Calculate the difference in revolutions
  if (deltaRevs < 0) {
    deltaRevs += 0x10000;
  }

  let deltaTime = current.lastCrankEventTime - previous.lastCrankEventTime; // Calculate the difference in event times
  if (deltaTime < 0) {
    deltaTime += 0x10000;
  }

  if (deltaRevs === 0) {
    return 0;
  }

  const deltaSeconds = deltaTime / 1024; // The CSC event time is measured in units of 1/1024 of a second. So I Convert the time difference from 1/1024s to seconds

  if (deltaSeconds <= 0) {
    return null;
  }

  const rpm = (deltaRevs / deltaSeconds) * 60; // Calculate RPM
  return Math.max(0, Math.round(rpm));
}
