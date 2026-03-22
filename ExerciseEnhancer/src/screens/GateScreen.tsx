// src/screens/GateScreen.tsx
import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getVt1 } from "../storage/userPrefs";
import Screen from "../ui/Screen";

export default function GateScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const vt1 = await getVt1();
        if (cancelled) return;

        // File based routes, expo router
        router.replace(vt1 ? "/home" : "/calibration");// route to the home screen if vt1 is set and calibration screen if no vt1
      } catch (e) {
        console.warn("GateScreen error", e);
        if (cancelled) return;
        router.replace("/calibration");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: "white" }}>Loading…</Text>
      </View>
    </Screen>
  );
}
