// src/screens/SettingsScreen.tsx
import React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { clearVt1 } from "../storage/userPrefs";
import { useBle } from "../ble/ble";
import Screen from "../ui/Screen";


export default function SettingsScreen() {
  const { disconnectAll } = useBle();

  return (
    <Screen>
    <View style={{ flex: 1, backgroundColor: "#0b0b0f", padding: 16 }}>
      <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>Settings</Text>

      <View style={{ marginTop: 16, gap: 12 }}>
        <Pressable
          onPress={() =>
            Alert.alert("Reset VT1", "This forces calibration again.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Reset",
                style: "destructive",
                onPress: async () => {
                  await clearVt1();// Clear VT1 from storage
                  Alert.alert("Done", "VT1 cleared.");
                },
              },
            ])
          }
          style={{ padding: 14, borderRadius: 14, backgroundColor: "#20202b" }}
        >
          <Text style={{ color: "white", fontWeight: "900", textAlign: "center" }}>
            Reset VT1
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void disconnectAll()}
          style={{ padding: 14, borderRadius: 14, backgroundColor: "#20202b" }}
        >
          <Text style={{ color: "white", fontWeight: "900", textAlign: "center" }}>
            Disconnect sensors
          </Text>
        </Pressable>
      </View>
    </View>
    </Screen>
  );
}
