// ble.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BleManager, Device } from "react-native-ble-plx";
import { Buffer } from "buffer";
import { requestBlePermissions } from "./permissions";
import { Alert } from "react-native";

// Standard BLE Heart Rate service and measurement characteristic.
const HR_SERVICE = "180d";
const HR_MEASUREMENT_CHAR = "2a37";

// Standard BLE Cycling Speed and Cadence service and measurement characteristic.
const CSC_SERVICE = "1816";
const CSC_MEASUREMENT_CHAR = "2a5b";

// Readings older than these thresholds are treated as stale.
const HR_STALE_MS = 5000;

// Show 0 rpm after no crank movement for this long.
const CADENCE_STOPPED_MS = 2000;

// Treat cadence as lost only after no packets for longer than the stopped timeout.
const CADENCE_SIGNAL_LOSS_MS = 7000;

// Delay before retrying a connection after an unexpected disconnect.
const RECONNECT_DELAY_MS = 2000;

type Removable = { remove: () => void };

type CrankSample = {
  cumulativeCrankRevs: number;
  lastCrankEventTime: number;
};

/**
 * Parse a Heart Rate Measurement packet.
 * The flags byte tells me whether the HR value is 8 bit or 16 bit.
 */
function parseHeartRate(base64Value: string): number | null {
  try {
    const b = Buffer.from(base64Value, "base64");
    const flag = b.readUInt8(0);
    const hr16 = (flag & 0x01) !== 0;
    return hr16 ? b.readUInt16LE(1) : b.readUInt8(1);
  } catch (e) {
    console.warn("parseHeartRate error", e);
    return null;
  }
}

/**
 * Parse a Cycling Speed and Cadence packet.
 * This project uses crank data for cadence and ignores wheel only data.
 */
function parseCSC(base64Value: string): CrankSample | null {
  try {
    const b = Buffer.from(base64Value, "base64");
    let offset = 0;

    const flags = b.readUInt8(offset);
    offset += 1;

    const crankPresent = (flags & 0x02) !== 0;
    if (!crankPresent) return null;

    // Skip wheel data when it is present so I can move to the crank fields.
    const wheelPresent = (flags & 0x01) !== 0;
    if (wheelPresent) {
      offset += 4;
      offset += 2;
    }

    const cumulativeCrankRevs = b.readUInt16LE(offset);
    offset += 2;

    const lastCrankEventTime = b.readUInt16LE(offset);
    offset += 2;

    return { cumulativeCrankRevs, lastCrankEventTime };
  } catch (e) {
    console.warn("parseCSC error", e);
    return null;
  }
}

type BleState = {
  isScanning: boolean;
  devices: Device[];

  hrDevice: Device | null;
  cadenceDevice: Device | null;

  heartRate: number | null;
  cadence: number | null;

  hrFresh: boolean;
  cadenceFresh: boolean;

  startScan: () => Promise<void>;
  stopScan: () => void;

  connectAsHeartRate: (device: Device) => Promise<void>;
  connectAsCadence: (device: Device) => Promise<void>;

  disconnectAll: () => Promise<void>;
};

const BleContext = createContext<BleState | null>(null);

// This provider owns a single BLE manager instance and shares BLE state across the app.
export function BleProvider({ children }: { children: React.ReactNode }) {

  // Keep one BleManager instance alive for the lifetime of the provider.
  const managerRef = useRef<BleManager | null>(null);

  if (!managerRef.current) managerRef.current = new BleManager();
  const manager = managerRef.current;

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  const [hrDevice, setHrDevice] = useState<Device | null>(null);
  const [cadenceDevice, setCadenceDevice] = useState<Device | null>(null);

  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);

  const [hrFresh, setHrFresh] = useState(false);
  const [cadenceFresh, setCadenceFresh] = useState(false);

  // Refs are used so async BLE callbacks always have access to the latest device state.
  const hrDeviceRef = useRef<Device | null>(null);
  const cadenceDeviceRef = useRef<Device | null>(null);

  const hrConnectingRef = useRef(false);
  const cadenceConnectingRef = useRef(false);
  const manualDisconnectRef = useRef(false);

  // These track the devices I want to reconnect to after unexpected disconnects.
  const hrTargetIdRef = useRef<string | null>(null);
  const cadenceTargetIdRef = useRef<string | null>(null);

  // Timestamps of the last valid reading received from each sensor.
  const hrLastSeenAtRef = useRef<number | null>(null);
  const cadenceLastSeenAtRef = useRef<number | null>(null);
  const cadenceLastMovementAtRef = useRef<number | null>(null);

  // Used to calculate cadence from successive crank revolution samples.
  const lastCrankRef = useRef<{ revs: number; time: number } | null>(null);
  const cadenceStoppedRef = useRef(false);

  const hrMonitorSubRef = useRef<Removable | null>(null);
  const cadenceMonitorSubRef = useRef<Removable | null>(null);

  const hrDisconnectSubRef = useRef<Removable | null>(null);
  const cadenceDisconnectSubRef = useRef<Removable | null>(null);

  const hrReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cadenceReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hrDeviceRef.current = hrDevice;
  }, [hrDevice]);

  useEffect(() => {
    cadenceDeviceRef.current = cadenceDevice;
  }, [cadenceDevice]);

  // Clear the current HR value and mark it as stale.
  function clearHeartRateReading() {
    hrLastSeenAtRef.current = null;
    setHrFresh(false);
    setHeartRate(null);
  }

  // Clear the current cadence value and reset the previous crank sample.
  function clearCadenceReading() {
    cadenceLastSeenAtRef.current = null;
    cadenceLastMovementAtRef.current = null;
    setCadenceFresh(false);
    setCadence(null);
    lastCrankRef.current = null;
    cadenceStoppedRef.current = false;
  }

  function markCadenceStopped() {
    setCadence(0);
    setCadenceFresh(true);
    cadenceStoppedRef.current = true;

    // Reset the previous crank sample so resumed pedalling starts from a fresh baseline.
    lastCrankRef.current = null;
  }

  // Remove active HR monitor and disconnect listeners.
  function teardownHeartRateSubscriptions() {
    hrMonitorSubRef.current?.remove();
    hrMonitorSubRef.current = null;

    hrDisconnectSubRef.current?.remove();
    hrDisconnectSubRef.current = null;
  }

  // Same here remove active cadence monitor and disconnect listeners.
  function teardownCadenceSubscriptions() {
    cadenceMonitorSubRef.current?.remove();
    cadenceMonitorSubRef.current = null;

    cadenceDisconnectSubRef.current?.remove();
    cadenceDisconnectSubRef.current = null;
  }

  // Reconnect to the previously selected HR device after an unexpected disconnect.
  async function reconnectHeartRateById(deviceId: string) {
    if (hrConnectingRef.current) return;

    const ok = await requestBlePermissions();
    if (!ok) return;

    hrConnectingRef.current = true;

    try {
      const connected = await manager.connectToDevice(deviceId);
      const ready = await connected.discoverAllServicesAndCharacteristics();

      teardownHeartRateSubscriptions();
      clearHeartRateReading();

      hrDeviceRef.current = ready;
      setHrDevice(ready);

      hrDisconnectSubRef.current = manager.onDeviceDisconnected(
        ready.id,
        (error) => {
          console.warn("HR device disconnected", error);
          teardownHeartRateSubscriptions();
          hrDeviceRef.current = null;
          setHrDevice(null);
          clearHeartRateReading();

          if (!manualDisconnectRef.current && hrTargetIdRef.current === ready.id) {
            scheduleHeartRateReconnect(ready.id);
          }
        }
      );

      hrMonitorSubRef.current = ready.monitorCharacteristicForService(
        HR_SERVICE,
        HR_MEASUREMENT_CHAR,
        (err, char) => {
          if (err) {
            console.warn("HR monitor error", err);
            return;
          }
          if (!char?.value) return;

          const bpm = parseHeartRate(char.value);
          if (bpm == null) return;

          hrLastSeenAtRef.current = Date.now();
          setHrFresh(true);
          setHeartRate(bpm);
        }
      );
    } catch (e) {
      console.warn("reconnectHeartRateById failed", e);
    } finally {
      hrConnectingRef.current = false;
    }
  }

  // Same as above, reconnect to the previously selected cadence device after an unexpected disconnect.
  async function reconnectCadenceById(deviceId: string) {
    if (cadenceConnectingRef.current) return;

    const ok = await requestBlePermissions();
    if (!ok) return;

    cadenceConnectingRef.current = true;

    try {
      const connected = await manager.connectToDevice(deviceId);
      const ready = await connected.discoverAllServicesAndCharacteristics();

      teardownCadenceSubscriptions();
      clearCadenceReading();

      cadenceDeviceRef.current = ready;
      setCadenceDevice(ready);

      cadenceDisconnectSubRef.current = manager.onDeviceDisconnected(
        ready.id,
        (error) => {
          console.warn("Cadence device disconnected", error);
          teardownCadenceSubscriptions();
          cadenceDeviceRef.current = null;
          setCadenceDevice(null);
          clearCadenceReading();

          if (
            !manualDisconnectRef.current &&
            cadenceTargetIdRef.current === ready.id
          ) {
            scheduleCadenceReconnect(ready.id);
          }
        }
      );

      cadenceMonitorSubRef.current = ready.monitorCharacteristicForService(
        CSC_SERVICE,
        CSC_MEASUREMENT_CHAR,
        (err, char) => {
          if (err) {
            console.warn("CSC monitor error", err);
            return;
          }
          if (!char?.value) return;

          const nowMs = Date.now();
          cadenceLastSeenAtRef.current = nowMs;
          setCadenceFresh(true);

          const parsed = parseCSC(char.value);
          if (!parsed) return;

          const currRevs = parsed.cumulativeCrankRevs;
          const currTime = parsed.lastCrankEventTime;

          const prev = lastCrankRef.current;

          // The first crank packet is only used as the starting point for the next calculation.
          if (!prev) {
            lastCrankRef.current = { revs: currRevs, time: currTime };
            cadenceLastMovementAtRef.current = nowMs;
            cadenceStoppedRef.current = false;
            return;
          }

          // Cadence is calculated from the change in crank revolutions over the change in event time.
          let dRevs = currRevs - prev.revs;
          if (dRevs < 0) dRevs += 0x10000;

          let dTimeRaw = currTime - prev.time;
          if (dTimeRaw < 0) dTimeRaw += 0x10000;

          // Only update cadence when actual crank movement has occurred.
          if (dRevs > 0 && dTimeRaw > 0) {
            const dSec = dTimeRaw / 1024.0;

            if (dSec > 0) {
              const rpm = (dRevs / dSec) * 60.0;
              setCadence(Math.max(0, Math.round(rpm)));
              cadenceLastMovementAtRef.current = nowMs;
              cadenceStoppedRef.current = false;
            }
          }

          lastCrankRef.current = { revs: currRevs, time: currTime };
        }
      );
    } catch (e) {
      console.warn("reconnectCadenceById failed", e);
    } finally {
      cadenceConnectingRef.current = false;
    }
  }

  // Queue a reconnect attempt for the HR device if one is not already pending.
  function scheduleHeartRateReconnect(deviceId: string) {
    if (hrReconnectTimerRef.current) return;

    hrReconnectTimerRef.current = setTimeout(() => {
      hrReconnectTimerRef.current = null;

      if (manualDisconnectRef.current) return;
      if (hrDeviceRef.current) return;
      if (hrTargetIdRef.current !== deviceId) return;

      void reconnectHeartRateById(deviceId);
    }, RECONNECT_DELAY_MS);
  }

  //same for cadence, queue a reconnect attempt if one is not already pending.
  function scheduleCadenceReconnect(deviceId: string) {
    if (cadenceReconnectTimerRef.current) return;

    cadenceReconnectTimerRef.current = setTimeout(() => {
      cadenceReconnectTimerRef.current = null;

      if (manualDisconnectRef.current) return;
      if (cadenceDeviceRef.current) return;
      if (cadenceTargetIdRef.current !== deviceId) return;

      void reconnectCadenceById(deviceId);
    }, RECONNECT_DELAY_MS);
  }

  // Periodically check whether readings have gone stale and clear them if needed.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();

      if (
        hrLastSeenAtRef.current != null &&
        now - hrLastSeenAtRef.current > HR_STALE_MS
      ) {
        clearHeartRateReading();
      }

      if (
        cadenceLastMovementAtRef.current != null &&
        now - cadenceLastMovementAtRef.current > CADENCE_STOPPED_MS &&
        !cadenceStoppedRef.current
      ) {
        markCadenceStopped();
      }

      if (
        cadenceLastSeenAtRef.current != null &&
        now - cadenceLastSeenAtRef.current > CADENCE_SIGNAL_LOSS_MS
      ) {
        clearCadenceReading();
      }
    }, 1000);

    return () => clearInterval(t);
  }, []);

  // Stop scanning once both target sensors are connected.
  useEffect(() => {
    if (hrDevice && cadenceDevice) {
      stopScan();
    }
  }, [hrDevice, cadenceDevice]);

  // Clean up timers, subscriptions, scans and the BLE manager when the provider unmounts.
  useEffect(() => {
    return () => {
      if (hrReconnectTimerRef.current) clearTimeout(hrReconnectTimerRef.current);
      if (cadenceReconnectTimerRef.current) {
        clearTimeout(cadenceReconnectTimerRef.current);
      }

      teardownHeartRateSubscriptions();
      teardownCadenceSubscriptions();

      try {
        manager.stopDeviceScan();
      } catch { }

      try {
        manager.destroy();
      } catch { }
    };
  }, [manager]);

  // Start scanning for nearby BLE devices and auto detect likely HR and cadence sensors. 
  const startScan = async () => {
    if (isScanning) return;

    const ok = await requestBlePermissions();
    if (!ok) {
      console.warn("BLE permissions not granted");
      return;
    }

    //Warn if permissions are not granted or bluetooth is off.
    const bluetoothState = await manager.state();

    if (bluetoothState !== "PoweredOn") {
      if (bluetoothState === "PoweredOff") {
        Alert.alert(
          "Bluetooth is off",
          "Turn on Bluetooth and try scanning again.",
        );
      } else {
        Alert.alert(
          "Bluetooth unavailable",
          `Bluetooth is currently in state: ${bluetoothState}.`,
        );
      }
      return;
    }

    setDevices([]);
    setIsScanning(true);

    manager.startDeviceScan(
      [HR_SERVICE, CSC_SERVICE],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.warn("scan error", error);
          setIsScanning(false);
          return;
        }

        if (!device) return;

        // Keep only one copy of each discovered device in the scan results.
        setDevices((prev) => {
          if (prev.some((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });

        const name = (device.name ?? "").toLowerCase();

        const looksLikeHr =
          name.includes("pixel") ||
          name.includes("garmin") ||
          name.includes("polar") ||
          name.includes("hrm");

        const looksLikeCadence =
          name.includes("wahoo") || name.includes("rpm");

        if (
          looksLikeHr &&
          !hrDeviceRef.current &&
          !hrConnectingRef.current
        ) {
          void connectAsHeartRate(device);
        }

        if (
          looksLikeCadence &&
          !cadenceDeviceRef.current &&
          !cadenceConnectingRef.current
        ) {
          void connectAsCadence(device);
        }
      }
    );
  };

  // Stop the current BLE scan if one is running.
  const stopScan = () => {
    try {
      manager.stopDeviceScan();
    } catch { }
    setIsScanning(false);
  };

  // Connect the selected device as the heart rate source and start notifications.
  const connectAsHeartRate = async (device: Device) => {
    if (hrConnectingRef.current) return;

    const ok = await requestBlePermissions();
    if (!ok) return;

    hrConnectingRef.current = true;
    hrTargetIdRef.current = device.id;

    try {
      const alreadyConnected = await device.isConnected();
      const connected = alreadyConnected ? device : await device.connect();
      const ready = await connected.discoverAllServicesAndCharacteristics();

      teardownHeartRateSubscriptions();
      clearHeartRateReading();

      hrDeviceRef.current = ready;
      setHrDevice(ready);

      hrDisconnectSubRef.current = manager.onDeviceDisconnected(
        ready.id,
        (error) => {
          console.warn("HR device disconnected", error);
          teardownHeartRateSubscriptions();
          hrDeviceRef.current = null;
          setHrDevice(null);
          clearHeartRateReading();

          if (!manualDisconnectRef.current && hrTargetIdRef.current === ready.id) {
            scheduleHeartRateReconnect(ready.id);
          }
        }
      );

      hrMonitorSubRef.current = ready.monitorCharacteristicForService(
        HR_SERVICE,
        HR_MEASUREMENT_CHAR,
        (err, char) => {
          if (err) {
            console.warn("HR monitor error", err);
            return;
          }
          if (!char?.value) return;

          const bpm = parseHeartRate(char.value);
          if (bpm == null) return;

          hrLastSeenAtRef.current = Date.now();
          setHrFresh(true);
          setHeartRate(bpm);
        }
      );
    } catch (e) {
      console.warn("connectAsHeartRate failed", e);
    } finally {
      hrConnectingRef.current = false;
    }
  };

  // Connect the selected device as the cadence source and start notifications.
  const connectAsCadence = async (device: Device) => {
    if (cadenceConnectingRef.current) return;

    const ok = await requestBlePermissions();
    if (!ok) return;

    cadenceConnectingRef.current = true;
    cadenceTargetIdRef.current = device.id;

    try {
      const alreadyConnected = await device.isConnected();
      const connected = alreadyConnected ? device : await device.connect();
      const ready = await connected.discoverAllServicesAndCharacteristics();

      teardownCadenceSubscriptions();
      clearCadenceReading();

      cadenceDeviceRef.current = ready;
      setCadenceDevice(ready);

      cadenceDisconnectSubRef.current = manager.onDeviceDisconnected(
        ready.id,
        (error) => {
          console.warn("Cadence device disconnected", error);
          teardownCadenceSubscriptions();
          cadenceDeviceRef.current = null;
          setCadenceDevice(null);
          clearCadenceReading();

          if (
            !manualDisconnectRef.current &&
            cadenceTargetIdRef.current === ready.id
          ) {
            scheduleCadenceReconnect(ready.id);
          }
        }
      );

      cadenceMonitorSubRef.current = ready.monitorCharacteristicForService(
        CSC_SERVICE,
        CSC_MEASUREMENT_CHAR,
        (err, char) => {
          if (err) {
            console.warn("CSC monitor error", err);
            return;
          }
          if (!char?.value) return;

          const nowMs = Date.now();
          cadenceLastSeenAtRef.current = nowMs;
          setCadenceFresh(true);

          const parsed = parseCSC(char.value);
          if (!parsed) return;

          const currRevs = parsed.cumulativeCrankRevs;
          const currTime = parsed.lastCrankEventTime;

          const prev = lastCrankRef.current;

          // The first crank packet is only used as the starting point for the next calculation.
          if (!prev) {
            lastCrankRef.current = { revs: currRevs, time: currTime };
            cadenceLastMovementAtRef.current = nowMs;
            cadenceStoppedRef.current = false;
            return;
          }

          // Cadence is calculated from the change in crank revolutions over the change in event time.
          let dRevs = currRevs - prev.revs;
          if (dRevs < 0) dRevs += 0x10000;

          let dTimeRaw = currTime - prev.time;
          if (dTimeRaw < 0) dTimeRaw += 0x10000;

          // Only update cadence when actual crank movement has occurred.
          if (dRevs > 0 && dTimeRaw > 0) {
            const dSec = dTimeRaw / 1024.0;

            if (dSec > 0) {
              const rpm = (dRevs / dSec) * 60.0;
              setCadence(Math.max(0, Math.round(rpm)));
              cadenceLastMovementAtRef.current = nowMs;
              cadenceStoppedRef.current = false;
            }
          }

          lastCrankRef.current = { revs: currRevs, time: currTime };
        }
      );
    } catch (e) {
      console.warn("connectAsCadence failed", e);
    } finally {
      cadenceConnectingRef.current = false;
    }
  };

  // Disconnect all sensors and clear local BLE state.
  const disconnectAll = async () => {
    manualDisconnectRef.current = true;
    hrTargetIdRef.current = null;
    cadenceTargetIdRef.current = null;

    try {
      stopScan();

      if (hrReconnectTimerRef.current) clearTimeout(hrReconnectTimerRef.current);
      if (cadenceReconnectTimerRef.current) {
        clearTimeout(cadenceReconnectTimerRef.current);
      }

      teardownHeartRateSubscriptions();
      teardownCadenceSubscriptions();

      if (hrDeviceRef.current) {
        await hrDeviceRef.current.cancelConnection();
      }

      if (cadenceDeviceRef.current) {
        await cadenceDeviceRef.current.cancelConnection();
      }
    } catch (e) {
      console.warn("disconnectAll failed", e);
    } finally {
      hrDeviceRef.current = null;
      cadenceDeviceRef.current = null;

      setHrDevice(null);
      setCadenceDevice(null);

      clearHeartRateReading();
      clearCadenceReading();

      manualDisconnectRef.current = false;
    }
  };

  // Memoise the context value so thigns only re render when BLE state actually changes.
  const value: BleState = useMemo(
    () => ({
      isScanning,
      devices,
      hrDevice,
      cadenceDevice,
      heartRate,
      cadence,
      hrFresh,
      cadenceFresh,
      startScan,
      stopScan,
      connectAsHeartRate,
      connectAsCadence,
      disconnectAll,
    }),
    [
      isScanning,
      devices,
      hrDevice,
      cadenceDevice,
      heartRate,
      cadence,
      hrFresh,
      cadenceFresh,
    ]
  );

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
}

// Helper for accessing shared BLE state and actions.
export function useBle() {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error("useBle must be used inside BleProvider");
  return ctx;
}