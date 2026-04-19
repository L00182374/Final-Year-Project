// src/screens/HomeScreen.tsx  
import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { getVt1 } from "../storage/userPrefs";
import { useBle } from "../ble/ble";
import Screen from "../ui/Screen";

export default function HomeScreen() {
  const { hrDevice, cadenceDevice, heartRate, cadence, startScan, stopScan, isScanning } = useBle();
  const [vt1, setVt1State] = useState<number | null>(null);

  // Load VT1 from storage and set state
  useEffect(() => {
    async function load() {
      const v = await getVt1();
      setVt1State(v);
    }
    void load();
  }, []);

  async function onScanPressed() {
    if (isScanning) {
      stopScan();
      return;
    }
    await startScan();
  }

  return (
    <Screen>
      <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>Dashboard</Text>
      <Text style={{ color: "#a3a3a3", marginTop: 6 }}>
        VT1: {vt1 ? `${vt1} bpm` : "Not set"}
      </Text>

      <View style={{ marginTop: 16, gap: 12 }}>
        <View style={{ backgroundColor: "#14141c", borderRadius: 16, padding: 14 }}>
          <Text style={{ color: "#a3a3a3" }}>Live</Text>
          <Text style={{ color: "white", marginTop: 8, fontSize: 18, fontWeight: "700" }}>
            HR: {heartRate != null ? `${heartRate} bpm` : "--"}
          </Text>
          <Text style={{ color: "white", marginTop: 6, fontSize: 18, fontWeight: "700" }}>
            Cadence: {cadence != null ? `${cadence} rpm` : "--"}
          </Text>
        </View>

        <View style={{ backgroundColor: "#14141c", borderRadius: 16, padding: 14 }}>
          <Text style={{ color: "#a3a3a3" }}>Sensors</Text>
          <Text style={{ color: "white", marginTop: 8 }}>
            Heart rate: {hrDevice ? "Connected" : "Not connected"}
          </Text>
          <Text style={{ color: "white", marginTop: 6 }}>
            Cadence: {cadenceDevice ? "Connected" : "Not connected"}
          </Text>

          <Pressable
            onPress={onScanPressed}
            style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#20202b" }}
          >
            <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
              {isScanning ? "Stop scan" : "Scan & connect"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/workout")}
          style={{ padding: 14, borderRadius: 14, backgroundColor: "#2563eb" }}
        >
          <Text style={{ color: "white", fontWeight: "900", textAlign: "center" }}>
            Start workout
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/replay")}
          style={{ padding: 14, borderRadius: 14, backgroundColor: "#972020" }}
        >
          <Text style={{ color: "white", fontWeight: "800", textAlign: "center" }}>
            Replay saved Workout/CSV
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/calibration")}
          style={{ padding: 14, borderRadius: 14, backgroundColor: "#20202b" }}
        >
          <Text style={{ color: "white", fontWeight: "800", textAlign: "center" }}>
            Re-run VT1 calibration
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/settings")}
          style={{ padding: 14, borderRadius: 14, backgroundColor: "#20202b" }}
        >
          <Text style={{ color: "white", fontWeight: "800", textAlign: "center" }}>
            Settings
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}