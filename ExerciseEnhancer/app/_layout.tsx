// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BleProvider } from "../src/ble/ble";

export default function RootLayout() {
  return (// Provide BLE context to the entire app by wrapping the Stack navigator with BleProvider, 
          // and also wrap with SafeAreaProvider for UI handling on different screens.
    <SafeAreaProvider>
      <BleProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
          }}
        />
      </BleProvider>
    </SafeAreaProvider>
  );
}