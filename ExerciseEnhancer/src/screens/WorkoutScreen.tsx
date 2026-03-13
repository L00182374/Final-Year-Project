import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBle } from "../ble/ble";
import { getVt1 } from "../storage/userPrefs";
import Screen from "../ui/Screen";
import { useInAppAudio } from "../media/useInAppAudio";
import {
  defaultMediaRuleConfig,
  defaultMediaRuleState,
  stepMediaRule,
} from "../media/MediaRuleEngine";

// function to clamp a number between two bounds
//function clamp(n: number, a: number, b: number) {
// return Math.max(a, Math.min(b, n));
//} Don't need this anymore.     its old

export default function WorkoutScreen() {
  //Media initialisation section Start.
  const { ready: audioReady, isPlaying, play, pause } = useInAppAudio();

  const [simulateZone, setSimulateZone] = useState(true);
  const [dummyInZone, setDummyInZone] = useState(true);

  const mediaCfgRef = useRef(defaultMediaRuleConfig);
  const mediaStateRef = useRef(defaultMediaRuleState);
  //Media section End.

  const { heartRate, cadence } = useBle();

  const [vt1, setVt1State] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // simple EMA smoothing to avoid flicker
  const hrEmaRef = useRef<number | null>(null);
  const cadEmaRef = useRef<number | null>(null);

  const hrSmooth = useMemo(() => {
    if (heartRate == null) return null;
    const alpha = 0.25;
    const prev = hrEmaRef.current;
    const next =
      prev == null ? heartRate : prev * (1 - alpha) + heartRate * alpha;
    hrEmaRef.current = next;
    return Math.round(next);
  }, [heartRate]);

  // same EMA smoothing to avoid flicker
  const cadSmooth = useMemo(() => {
    if (cadence == null) return null;
    const alpha = 0.25;
    const prev = cadEmaRef.current;
    const next = prev == null ? cadence : prev * (1 - alpha) + cadence * alpha;
    cadEmaRef.current = next;
    return Math.round(next);
  }, [cadence]);

  // useeffect hook allows me to synchronise with external an system
  // in this case I'm getting and setting vt1 from async storage, which is persisted on the device, so it stays even if the app is closed
  useEffect(() => {
    (async () => {
      const v = await getVt1();
      setVt1State(v);
    })();
  }, []);

  // this useeffect hook is responsible for the workout timer, it starts a timer when the workout is active.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  const zone = useMemo(() => {
    // zone2 is below VT1 but not too easy/no effort
    // if I don't have vt1 or HR data, I can't determine zone, so show N/A
    if (!vt1 || !hrSmooth) return "N/A";

    const z2High = vt1; // vt1 is upper limit of zone 2, can maybe change later
    const z2Low = Math.round(vt1 * 0.85); // can maybe change later
    const hr = hrSmooth;

    if (hr >= z2Low && hr <= z2High) return "ZONE 2";
    if (hr < z2Low) return "BELOW";
    return "ABOVE";
  }, [vt1, hrSmooth]);

  const zoneColor =
    zone === "ZONE 2" ? "#16a34a" : zone === "N/A" ? "#6b7280" : "#ef4444";

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  // These are for testing Media etc, I can set inzone off and on to see effects in action.
  const realInZone = zone === "ZONE 2";
  const inZone = simulateZone ? dummyInZone : realInZone;

  const mediaStatusText = !audioReady ? "Loading" : isPlaying ? "Playing" : "Paused";
  const mediaStatusColor = !audioReady ? "#6b7280" : isPlaying ? "#22c55e" : "#ef4444";

  const toggleManualMedia = async () => {
    if (!audioReady) return;

    if (isPlaying) {
      mediaStateRef.current = {
        ...mediaStateRef.current,
        mode: "PAUSED",
        outSinceMs: null,
        inSinceMs: null,
      };
      await pause();
      return;
    }

    mediaStateRef.current = {
      ...mediaStateRef.current,
      mode: "PLAYING",
      outSinceMs: null,
      inSinceMs: null,
    };
    await play();
  };

  // this makes sure that the media state resets when the workout is not active
  useEffect(() => {
    if (!active) {
      mediaStateRef.current = { ...defaultMediaRuleState };
      void pause();
    }
  }, [active, pause]);

  //This is an effect that ticks the media rule engine every second only when active is true.
  useEffect(() => {
    if (!active) return;
    if (!audioReady) return;

    const t = setInterval(() => {
      const nowMs = Date.now();
      const { nextState, intent } = stepMediaRule({
        nowMs,
        inZone,
        config: mediaCfgRef.current,
        state: mediaStateRef.current,
      });

      mediaStateRef.current = nextState;

      if (intent === "PAUSE") void pause();
      if (intent === "PLAY") void play();
    }, 1000);

    return () => clearInterval(t);
  }, [active, inZone, audioReady, play, pause]);
  // End of media rule testing and media effect.

  return (
    <Screen>
      <View style={{ flex: 1, backgroundColor: "#0b0b0f", padding: 16 }}>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>
          Workout
        </Text>

        <View
          style={{
            marginTop: 14,
            backgroundColor: "#14141c",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <Text style={{ color: "#a3a3a3" }}>Time</Text>
          <Text
            style={{
              color: "white",
              fontSize: 30,
              fontWeight: "900",
              marginTop: 6,
            }}
          >
            {mm}:{ss}
          </Text>
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: "#14141c",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <Text style={{ color: "#a3a3a3" }}>Zone</Text>
          <View
            style={{
              marginTop: 10,
              padding: 14,
              borderRadius: 16,
              backgroundColor: zoneColor,
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 22,
                fontWeight: "900",
                textAlign: "center",
              }}
            >
              {zone}
            </Text>
            <Text
              style={{
                color: "white",
                opacity: 0.9,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              VT1: {vt1 ? `${vt1} bpm` : "Not set"}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: "#14141c",
            borderRadius: 18,
            padding: 10,
            flexDirection: "row",
            alignItems: "center",
            elevation: 4,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "#20202b",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="musical-notes" size={20} color="white" />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{ color: "white", fontSize: 14, fontWeight: "800" }}
              numberOfLines={1}
            >
              Demo Track
            </Text>

            <Text
              style={{ color: "#a3a3a3", fontSize: 12, marginTop: 2 }}
              numberOfLines={1}
            >
              Exercise Enhancer Player
            </Text>

            <View
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 999,
                backgroundColor: "#20202b",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: isPlaying ? "65%" : "18%",
                  height: "100%",
                  backgroundColor: mediaStatusColor,
                }}
              />
            </View>
          </View>

          <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: mediaStatusColor,
              }}
            >
              <Text style={{ color: "white", fontSize: 11, fontWeight: "800" }}>
                {mediaStatusText}
              </Text>
            </View>

            <Text
              style={{
                color: inZone ? "#22c55e" : "#ef4444",
                fontSize: 11,
                fontWeight: "700",
                marginTop: 6,
              }}
            >
              {inZone ? "In Zone" : "Out Zone"}
            </Text>

            <Pressable
              onPress={() => void toggleManualMedia()}
              style={{
                marginTop: 6,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#20202b",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={16}
                color="white"
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: 12, flexDirection: "row", gap: 12 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#14141c",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: "#a3a3a3" }}>Heart Rate</Text>
            <Text
              style={{
                color: "white",
                fontSize: 26,
                fontWeight: "900",
                marginTop: 8,
              }}
            >
              {hrSmooth != null ? hrSmooth : "--"}
            </Text>
            <Text style={{ color: "#a3a3a3", marginTop: 2 }}>bpm</Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#14141c",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: "#a3a3a3" }}>Cadence</Text>
            <Text
              style={{
                color: "white",
                fontSize: 26,
                fontWeight: "900",
                marginTop: 8,
              }}
            >
              {cadSmooth != null ? cadSmooth : "--"}
            </Text>
            <Text style={{ color: "#a3a3a3", marginTop: 2 }}>rpm</Text>
          </View>
        </View>

        {/* Bottom controls */}
        <View style={{ marginTop: "auto", flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => setActive((v) => !v)}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              backgroundColor: active ? "#ca8a04" : "#16a34a",
            }}
          >
            <Text
              style={{ color: "white", fontWeight: "900", textAlign: "center" }}
            >
              {active ? "Pause" : "Start"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setActive(false);
              setSeconds(0);
              hrEmaRef.current = null;
              cadEmaRef.current = null;
              mediaStateRef.current = { ...defaultMediaRuleState };
              void pause();
            }}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Reset</Text>
          </Pressable>

          {/* placeholder for media control rules */}
          <Pressable
            onPress={() => {}} // no functionality yet, it will control music/media in the future
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Media</Text>
          </Pressable>

          {/* Initial attempt for dummy zone simulation controls */}
          <Pressable
            onPress={() => setSimulateZone((v) => !v)}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>
              {simulateZone ? "Sim: ON" : "Sim: OFF"}
            </Text>
          </Pressable>

          {simulateZone && (
            <Pressable
              onPress={() => setDummyInZone((v) => !v)}
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: dummyInZone ? "#16a34a" : "#ef4444",
              }}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>
                {dummyInZone ? "In Zone" : "Out Zone"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Screen>
  );
}