// app/_layout.tsx
import { Stack } from "expo-router";
import { BleProvider } from "../src/ble/ble";

export default function Layout() {
  return (// Provide BLE context to the entire app by wrapping the Stack navigator with BleProvider
    <BleProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </BleProvider>
  );
}

// I might need to change headershown to false as some android stuff blocks ui elements.