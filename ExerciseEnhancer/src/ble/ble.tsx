// ble.tsx  

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"; 

import { BleManager, Device } from "react-native-ble-plx"; 

import { Buffer } from "buffer"; 

import { requestBlePermissions } from "./permissions"; 

 

const HR_SERVICE = "180d"; 

const HR_MEASUREMENT_CHAR = "2a37"; 

 

const CSC_SERVICE = "1816"; 

const CSC_MEASUREMENT_CHAR = "2a5b"; 

 

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

 

function parseCSC(base64Value: string) { 

  try { 

    const b = Buffer.from(base64Value, "base64"); 

    let offset = 0; 

 

    const flags = b.readUInt8(offset); 

    offset += 1; 

 

    const crankPresent = (flags & 0x02) !== 0; 

    if (!crankPresent) return null; 

 

    // skip wheel if present 

    const wheelPresent = (flags & 0x01) !== 0; 

    if (wheelPresent) { 

      offset += 4; // cumulative wheel revs 

      offset += 4; // last wheel event time 

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

 

  startScan: () => Promise<void>; 

  stopScan: () => void; 

 

  connectAsHeartRate: (device: Device) => Promise<void>; 

  connectAsCadence: (device: Device) => Promise<void>; 

 

  disconnectAll: () => Promise<void>; 

}; 

 

const BleContext = createContext<BleState | null>(null); 

 

export function BleProvider({ children }: { children: React.ReactNode }) { 

  const managerRef = useRef<BleManager | null>(null); 

  if (!managerRef.current) managerRef.current = new BleManager(); 

  const manager = managerRef.current; 

 

  const [isScanning, setIsScanning] = useState(false); 

  const [devices, setDevices] = useState<Device[]>([]); 

 

  const [hrDevice, setHrDevice] = useState<Device | null>(null); 

  const [cadenceDevice, setCadenceDevice] = useState<Device | null>(null); 

 

  const [heartRate, setHeartRate] = useState<number | null>(null); 

  const [cadence, setCadence] = useState<number | null>(null); 

 

  const lastCrankRef = useRef<{ revs: number; time: number } | null>(null); 

 

  useEffect(() => { 

    return () => { 

      try { 

        manager.stopDeviceScan(); 

        manager.destroy(); 

      } catch (e) {} 

    }; 

  }, [manager]); 

 

  const startScan = async () => { 

    const ok = await requestBlePermissions(); 

    if (!ok) { 

      console.warn("BLE permissions not granted"); 

      return; 

    } 

 

    setDevices([]); 

    setIsScanning(true); 

 

    const serviceUUIDs = [HR_SERVICE, CSC_SERVICE]; 

 

    manager.startDeviceScan(serviceUUIDs, { allowDuplicates: false }, (error, device) => { 

      if (error) { 

        console.warn("scan error", error); 

        setIsScanning(false); 

        return; 

      } 

      if (!device) return; 

 

      setDevices((prev) => { 

        if (prev.find((d) => d.id === device.id)) return prev; 

        return [...prev, device]; 

      }); 

 

      // auto connect  

      const name = (device.name ?? "").toLowerCase(); 

      if (!hrDevice && (name.includes("pixel") || name.includes("garmin") || name.includes("polar"))) { 

        void connectAsHeartRate(device); 

      } 

      if (!cadenceDevice && (name.includes("wahoo") || name.includes("rpm"))) { 

        void connectAsCadence(device); 

      } 

 

      // stop once both are connected 

      if (hrDevice && cadenceDevice) { 

        stopScan(); 

      } 

    }); 

  }; 

 

  const stopScan = () => { 

    try { 

      manager.stopDeviceScan(); 

    } catch (e) {} 

    setIsScanning(false); 

  }; 

 

  const connectAsHeartRate = async (device: Device) => { 

    try { 

      const ok = await requestBlePermissions(); 

      if (!ok) return; 

 

      const connected = await device.connect(); 

      await connected.discoverAllServicesAndCharacteristics(); 

      setHrDevice(connected); 

 

      // monitor HR characteristic 

      connected.monitorCharacteristicForService(HR_SERVICE, HR_MEASUREMENT_CHAR, (err, char) => { 

        if (err) { 

          console.warn("HR monitor error", err); 

          return; 

        } 

        if (!char?.value) return; 

 

        const bpm = parseHeartRate(char.value); 

        if (bpm != null) setHeartRate(bpm); 

      }); 

    } catch (e) { 

      console.warn("connectAsHeartRate failed", e); 

    } 

  }; 

 

  const connectAsCadence = async (device: Device) => { 

    try { 

      const ok = await requestBlePermissions(); 

      if (!ok) return; 

 

      const connected = await device.connect(); 

      await connected.discoverAllServicesAndCharacteristics(); 

      setCadenceDevice(connected); 

 

      connected.monitorCharacteristicForService(CSC_SERVICE, CSC_MEASUREMENT_CHAR, (err, char) => { 

        if (err) { 

          console.warn("CSC monitor error", err); 

          return; 

        } 

        if (!char?.value) return; 

 

        const parsed = parseCSC(char.value); 

        if (!parsed) return; 

 

        const currRevs = parsed.cumulativeCrankRevs; 

        const currTime = parsed.lastCrankEventTime; // 1/1024s uint16 

 

        const prev = lastCrankRef.current; 

        if (prev) { 

          let dRevs = currRevs - prev.revs; 

          if (dRevs < 0) dRevs += 0x10000; 

 

          let dTimeRaw = currTime - prev.time; 

          if (dTimeRaw < 0) dTimeRaw += 0x10000; 

 

          const dSec = dTimeRaw / 1024.0; 

          if (dSec > 0) { 

            const rpm = (dRevs / dSec) * 60.0; 

            setCadence(Math.round(rpm)); 

          } 

        } 

 

        lastCrankRef.current = { revs: currRevs, time: currTime }; 

      }); 

    } catch (e) { 

      console.warn("connectAsCadence failed", e); 

    } 

  }; 

 

  const disconnectAll = async () => { 

    try { 

      stopScan(); 

 

      if (hrDevice) { 

        await hrDevice.cancelConnection(); 

        setHrDevice(null); 

      } 

 

      if (cadenceDevice) { 

        await cadenceDevice.cancelConnection(); 

        setCadenceDevice(null); 

      } 

 

      setHeartRate(null); 

      setCadence(null); 

      lastCrankRef.current = null; 

    } catch (e) { 

      console.warn("disconnectAll failed", e); 

    } 

  }; 

 

  const value: BleState = useMemo( 

    () => ({ 

      isScanning, 

      devices, 

      hrDevice, 

      cadenceDevice, 

      heartRate, 

      cadence, 

      startScan, 

      stopScan, 

      connectAsHeartRate, 

      connectAsCadence, 

      disconnectAll, 

    }), 

    [isScanning, devices, hrDevice, cadenceDevice, heartRate, cadence] 

  ); 

 

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>; 

} 

 

export function useBle() { 

  const ctx = useContext(BleContext); 

  if (!ctx) throw new Error("useBle must be used inside BleProvider"); 

  return ctx; 

}