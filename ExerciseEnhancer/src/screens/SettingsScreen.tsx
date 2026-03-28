// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { clearVt1 } from "../storage/userPrefs";
import { useBle } from "../ble/ble";
import Screen from "../ui/Screen";
import {
  getMediaTarget,
  setMediaTarget,
  type MediaTarget,
} from "../storage/mediaPrefs";
import { usePcMediaAvailability } from "../media/usePCMediaAvailability";

export default function SettingsScreen() {
  const { disconnectAll } = useBle();
  const [mediaTarget, setMediaTargetState] = useState<MediaTarget>("phone");

  const { pcMediaAvailable, checkingPcMedia, refreshPcMediaAvailability } =
    usePcMediaAvailability(mediaTarget === "pc" || mediaTarget === "auto");

  useEffect(() => {
    (async () => {
      const savedTarget = await getMediaTarget();
      setMediaTargetState(savedTarget);
    })();
  }, []);

  async function handleMediaTargetChange(nextTarget: MediaTarget) {
    setMediaTargetState(nextTarget);
    await setMediaTarget(nextTarget);
  }

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: "#0b0b0f", padding: 16 }}>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>
          Settings
        </Text>

        <View style={{ marginTop: 16, gap: 12 }}>
          <View
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
              Media target
            </Text>

            <Text style={{ color: "#a3a3a3", marginTop: 6 }}>
              Choose whether zone triggered media control uses specifically
              local phone audio, PC media, or an automatic choice between which
              is available.
            </Text>

            <Text style={{ color: "#a3a3a3", marginTop: 10 }}>
              PC status:{" "}
              {checkingPcMedia
                ? "Checking..."
                : pcMediaAvailable
                  ? "Available"
                  : "Unavailable"}
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <Pressable
                onPress={() => void handleMediaTargetChange("phone")}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor:
                    mediaTarget === "phone" ? "#2563eb" : "#14141c",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>Phone</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleMediaTargetChange("pc")}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: mediaTarget === "pc" ? "#2563eb" : "#14141c",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>PC</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleMediaTargetChange("auto")}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor:
                    mediaTarget === "auto" ? "#2563eb" : "#14141c",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>Auto</Text>
              </Pressable>

              <Pressable
                onPress={() => void refreshPcMediaAvailability()}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: "#14141c",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>
                  Refresh PC
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert("Reset VT1", "This forces calibration again.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  style: "destructive",
                  onPress: async () => {
                    await clearVt1();
                    Alert.alert("Done", "VT1 cleared.");
                  },
                },
              ])
            }
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text
              style={{ color: "white", fontWeight: "900", textAlign: "center" }}
            >
              Reset VT1
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void disconnectAll()}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text
              style={{ color: "white", fontWeight: "900", textAlign: "center" }}
            >
              Disconnect sensors
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
