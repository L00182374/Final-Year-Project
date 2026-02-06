// src/hooks/full-old.ts
import { useEffect, useRef, useState } from "react";
import { BleManager, Device } from "react-native-ble-plx";
import { Buffer } from "buffer";
import { requestBlePermissions } from "./useBLE"; //useBLE permission helper

// Standard BLE UUIDs
const HR_SERVICE = "180d";
const HR_MEASUREMENT_CHAR = "2a37";

const CSC_SERVICE = "1816";
const CSC_MEASUREMENT_CHAR = "2a5b";

/**
 * parseHeartRate(characteristicValueBase64) - bpm:number
 *
 */
function parseHeartRate(base64Value: string): number | null {
  try {
    const b = Buffer.from(base64Value, "base64");
    const flag = b.readUInt8(0);
    const hr16 = (flag & 0x01) !== 0;
    if (hr16) {
      return b.readUInt16LE(1);
    } else {
      return b.readUInt8(1);
    }
  } catch (e) {
    console.warn("parseHeartRate error", e);
    return null;
  }
}

/**
 * parseCSC(characteristicValueBase64)
 * 
 */
function parseCSC(base64Value: string) {
  try {
    const b = Buffer.from(base64Value, "base64");
    let offset = 0;
    const flags = b.readUInt8(offset); offset += 1;
    const wheelPresent = (flags & 0x01) !== 0;
    const crankPresent = (flags & 0x02) !== 0;

    const out: any = { wheelPresent, crankPresent };

    if (wheelPresent) {
      out.cumulativeWheelRevs = b.readUInt32LE(offset); offset += 4;
      out.lastWheelEventTime = b.readUInt32LE(offset); offset += 4; // in 1/1024s
    }
    if (crankPresent) {
      out.cumulativeCrankRevs = b.readUInt16LE(offset); offset += 2;
      out.lastCrankEventTime = b.readUInt16LE(offset); offset += 2; // in 1/1024s
    }
    return out;
  } catch (e) {
    console.warn("parseCSC error", e);
    return null;
  }
}

/**
 * useBle hook
 */
export function useBle() {
  // make manager single instance for the hook lifetime
  const managerRef = useRef<BleManager | null>(null);
  if (!managerRef.current) managerRef.current = new BleManager();

  const manager = managerRef.current;

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);

  // for cadence calculation
  const lastCrankRef = useRef<{ revs: number; eventTime: number } | null>(null);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      try {
        manager.stopDeviceScan();
        if (connectedDevice) {
          connectedDevice.cancelConnection();
        }
        manager.destroy();
      } catch (e) {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // scan and connect convenience function
  const scanAndConnect = async (options?: { name?: string; allowDuplicates?: boolean }) => {
    const ok = await requestBlePermissions();
    if (!ok) {
      console.warn("BLE permissions not granted");
      return;
    }

    setDevices([]);
    setIsScanning(true);

    // Filter for HR or CSC service UUIDs
    const serviceUUIDs = [HR_SERVICE, CSC_SERVICE];

    manager.startDeviceScan(serviceUUIDs, { allowDuplicates: false }, async (error, device) => {
      if (error) {
        console.warn("scan error", error);
        setIsScanning(false);
        return;
      }
      if (!device) return;

      // name filter
      if (options?.name && device.name !== options.name) {
        return;
      }

      // add device to list for UI
      setDevices(prev => {
        if (prev.find(d => d.id === device.id)) return prev;
        return [...prev, device];
      });

      
      if (device.name && (device.name.toLowerCase().includes("garmin") || device.name.toLowerCase().includes("wahoo") || device.serviceUUIDs?.some(s => s.includes(HR_SERVICE) || s.includes(CSC_SERVICE)))) {
        manager.stopDeviceScan();
        setIsScanning(false);
        try {
          const connected = await device.connect();
          await connected.discoverAllServicesAndCharacteristics();
          setConnectedDevice(connected);

          // subscribe to heart rate if it is available
          try {
            connected.monitorCharacteristicForService(
              HR_SERVICE,
              HR_MEASUREMENT_CHAR,
              (err, char) => {
                if (err) {
                  console.warn("HR monitor error", err);
                  return;
                }
                if (char?.value) {
                  const bpm = parseHeartRate(char.value);
                  if (bpm !== null) setHeartRate(bpm);
                }
              }
            );
          } catch (e) {
            //
            // console.warn("subscribe HR failed", e);
          }

          // subscribe to CSC (cadence)
          try {
            connected.monitorCharacteristicForService(
              CSC_SERVICE,
              CSC_MEASUREMENT_CHAR,
              (err, char) => {
                if (err) {
                  console.warn("CSC monitor error", err);
                  return;
                }
                if (char?.value) {
                  const parsed = parseCSC(char.value);
                  if (parsed && parsed.crankPresent) {
                    const currRevs = parsed.cumulativeCrankRevs;
                    const currEventTime = parsed.lastCrankEventTime; // 1/1024s
                    const prev = lastCrankRef.current;
                    if (prev) {
                      // handle wraparound for uint16
                      let deltaRevs = currRevs - prev.revs;
                      if (deltaRevs < 0) deltaRevs += 0x10000;
                      let deltaTimeRaw = currEventTime - prev.eventTime;
                      if (deltaTimeRaw < 0) deltaTimeRaw += 0x10000;
                      const deltaTimeSec = deltaTimeRaw / 1024.0;
                      // rpm = (revs / sec) * 60
                      if (deltaTimeSec > 0) {
                        const rpm = (deltaRevs / deltaTimeSec) * 60.0;
                        setCadence(Math.round(rpm));
                      }
                    }
                    lastCrankRef.current = { revs: currRevs, eventTime: currEventTime };
                  }
                }
              }
            );
          } catch (e) {
            // 
            // console.warn("subscribe CSC failed", e);
          }
        } catch (e) {
          console.warn("connect failed", e);
        }
      }
    });
  };

  const stopScan = () => {
    try {
      manager.stopDeviceScan();
    } catch (e) {}
    setIsScanning(false);
  };

  const connectToDevice = async (device: Device) => {
    try {
      const ok = await requestBlePermissions();
      if (!ok) throw new Error("permissions");
      stopScan();
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);

      // subscribe to HR/csc similar as above 
      //
      return connected;
    } catch (e) {
      console.warn("manual connect failed", e);
      return null;
    }
  };

  const disconnect = async () => {
    try {
      if (connectedDevice) {
        await connectedDevice.cancelConnection();
        setConnectedDevice(null);
      }
    } catch (e) {
      console.warn("disconnect failed", e);
    }
  };

  return {
    manager,
    isScanning,
    devices,
    scanAndConnect,
    stopScan,
    connectToDevice,
    disconnect,
    connectedDevice,
    heartRate,
    cadence,
  };
}
