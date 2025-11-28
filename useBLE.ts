// src/permissions.ts
import { PermissionsAndroid, Platform } from "react-native";
import * as Device from "expo-device";
import { BleManager } from 'react-native-ble-plx'


// Standard BLE UUIDs for services and characteristics
const HR_SERVICE = "180d";
const HR_MEASUREMENT_CHAR = "2a37";

const CADENCE_SERVICE = "1816";
const CADENCE_MEASUREMENT_CHAR = "2a5b";


 //Request Android BLE permissions.
 //Returns true if all required permissions are granted.
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    // iOS: no runtime permission for CoreBluetooth (Info.plist entries only)
    return true;
  }

  try {
    const apiLevel = (Device.platformApiLevel ?? -1) as number;

    // For Android 12 where API is 31 and above. request the new BLE runtime permissions.
    if (apiLevel >= 31) {
      const scan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: "Bluetooth Scan Permission",
          message:
            "This app needs permission to scan for Bluetooth devices to connect your sensors.",
          buttonPositive: "OK",
        }
      );
      const connect = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: "Bluetooth Connect Permission",
          message:
            "This app needs permission to connect to Bluetooth devices.",
          buttonPositive: "OK",
        }
      );

      // Location may still be required on some devices or Android versions
      const fineLocation = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message:
            "Location permission is required on some older Android versions to discover nearby Bluetooth devices.",
          buttonPositive: "OK",
        }
      );

      // Return true only if all permissions are granted
      return scan === PermissionsAndroid.RESULTS.GRANTED && connect === PermissionsAndroid.RESULTS.GRANTED && fineLocation === PermissionsAndroid.RESULTS.GRANTED;

    } else {
      // Android 11 and below 
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message:
            "Location permission is required to discover nearby Bluetooth devices.",
          buttonPositive: "OK",
        }
      );

      // Return true if location permission is granted
      return granted == PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (error) {
    console.warn("Failed to request BLE permissions:", error);
    return false;
  }
}

// Initialize BLE Manager
export const manager = new BleManager()

// function to scan and connect to a BLE device
function scanAndConnect() {
  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      // Handle error, scanning will be stopped automatically
      return
    }

    // Check if it is a device you are looking for based on advertisement data
    // or other criteria.
    if (device.name === 'Wahoo RPM Cadence' || device.name === 'RPM Cadence') {
      
      // Stop scanning as it's not necessary if you are scanning for one device.
      manager.stopDeviceScan()

      // Proceed with connection.
    }
  })
}