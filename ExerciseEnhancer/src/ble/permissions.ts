import { PermissionsAndroid, Platform } from "react-native";
import * as Device from "expo-device";

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  try {
    const apiLevel = (Device.platformApiLevel ?? -1) as number;

    if (apiLevel >= 31) {
      const scan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: "Bluetooth Scan Permission",
          message: "This app needs permission to scan for Bluetooth devices.",
          buttonPositive: "OK",
        }
      );

      const connect = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: "Bluetooth Connect Permission",
          message: "This app needs permission to connect to Bluetooth devices.",
          buttonPositive: "OK",
        }
      );

      //Location is Still needed on some devices
      const fine = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "Location permission may be required for BLE scanning on some devices.",
          buttonPositive: "OK",
        }
      );

      return (
        scan === PermissionsAndroid.RESULTS.GRANTED &&
        connect === PermissionsAndroid.RESULTS.GRANTED &&
        fine === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Location permission is required to discover nearby Bluetooth devices.",
        buttonPositive: "OK",
      }
    );

    return fine === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    console.warn("requestBlePermissions error", e);
    return false;
  }
}
