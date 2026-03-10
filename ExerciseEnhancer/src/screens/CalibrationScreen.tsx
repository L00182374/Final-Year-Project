// CalibrationScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useBle } from "../ble/ble";
import { setVt1 } from "../storage/userPrefs";
import Screen from "../ui/Screen";

const STAGE_SECONDS = 180; // 3 minutes per stage.

const STAGES = [
  { title: "Stage 1: Easy", subtitle: "Comfortable pace. you can talk normally." },
  { title: "Stage 2: Moderate", subtitle: "Breathing increases slightly. still can speak conversationally." },
  { title: "Stage 3: Hard", subtitle: "Talking becomes difficult. Tap when you cant speak comfortably." },
];

export default function CalibrationScreen() {
  const router = useRouter();
  const { startScan, stopScan, isScanning, heartRate, hrDevice } = useBle();

  const [running, setRunning] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(STAGE_SECONDS);
  const [samples, setSamples] = useState<number[]>([]);

  const [showManual, setShowManual] = useState(false);
  const [manualVt1Text, setManualVt1Text] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stage = STAGES[stageIndex];

  useEffect(() => {
    // try to help user discover HR sensor
    void startScan();
    const t = setTimeout(() => stopScan(), 8000);
    return () => clearTimeout(t);
  }, [startScan, stopScan]);

  // this useMemo calculates the average heart rate of the last 30 samples, which is used as a fallback VT1 if the user taps I can't speak without a clear HR reading at that moment.
  const avgLast30 = useMemo(() => {
    const last = samples.slice(-30);
    if (!last.length) return null;
    const sum = last.reduce((a, b) => a + b, 0);
    return Math.round(sum / last.length);
  }, [samples]);

  const bestEffortVt1 = useCallback(() => {
    // fallback average of last 30s
    return avgLast30 ?? heartRate ?? null;
  }, [avgLast30, heartRate]);

  const finishAndSave = useCallback(
    async (vt1: number | null) => {
      if (!vt1 || !Number.isFinite(vt1) || vt1 <= 0) {
        Alert.alert("VT1 not captured", "Could not estimate VT1. Please try calibration again.");
        return;
      }

      try {
        await setVt1(vt1);
        Alert.alert("Saved", `VT1 saved as ${Math.round(vt1)} bpm`);
        router.replace("/home");
      } catch (e) {
        console.warn("save vt1 failed", e);
        Alert.alert("Error", "Could not save VT1. Try again.");
      }
    },
    [router],
  );

  useEffect(() => {
    if (!running) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setRunning(false);

          if (stageIndex < STAGES.length - 1) {
            setStageIndex(stageIndex + 1);
            setTimeLeft(STAGE_SECONDS);
          } else {
            // if user never tapped can't speak, I still save a best effort estimate
            void finishAndSave(bestEffortVt1());
          }
          return STAGE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    if (sampleRef.current) clearInterval(sampleRef.current);
    sampleRef.current = setInterval(() => {
      if (heartRate != null) {
        setSamples((prev) => {
          const next = [...prev, heartRate];
          if (next.length > 600) next.shift(); // cap memory
          return next;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sampleRef.current) clearInterval(sampleRef.current);
    };
  }, [running, stageIndex, heartRate, bestEffortVt1, finishAndSave]);

  const begin = () => {
    if (!hrDevice && heartRate == null) {
      Alert.alert(
        "No heart rate detected",
        "Pair/connect your watch/chest strap first and Try scanning again.",
      );
      return;
    }
    setShowManual(false);
    setManualVt1Text("");
    setSamples([]);
    setStageIndex(0);
    setTimeLeft(STAGE_SECONDS);
    setRunning(true);
  };

  const cantSpeakNow = () => {
    // VT1 estimate average HR in the moment user reports speech difficulty
    void finishAndSave(bestEffortVt1());
  };

  const startManualEntry = () => {
    Alert.alert(
      "Manual VT1 entry",
      "This is only recommended if you already know your VT1 from a previous test.\n\nIf you enter the wrong value, Zone 2 guidance will be inaccurate.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I understand",
          style: "destructive",
          onPress: () => {
            setManualVt1Text("");
            setShowManual(true);
          },
        },
      ],
    );
  };

  const submitManualVt1 = () => {
    const cleaned = manualVt1Text.trim();
    const vt1 = Number(cleaned);

    if (!Number.isFinite(vt1) || vt1 <= 0) {
      Alert.alert("Invalid value", "Please enter a number in bpm (example: 145).");
      return;
    }

    // basic range warning, but I still allow saving if the user insists
    if (vt1 < 80 || vt1 > 220) {
      Alert.alert(
        "VT1 value looks unusual",
        `You entered ${Math.round(vt1)} bpm.\n\nOnly save this if you are sure.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save anyway",
            style: "destructive",
            onPress: () => {
              setShowManual(false);
              void finishAndSave(vt1);
            },
          },
        ],
      );
      return;
    }

    setShowManual(false);
    void finishAndSave(vt1);
  };

  return ( //Wrapping it all in screen to apply consistent ui.
    <Screen>
      <View style={{ flex: 1, backgroundColor: "#0b0b0f", padding: 16 }}>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "700" }}>VT1 Calibration</Text>
        <Text style={{ color: "#a3a3a3", marginTop: 6 }}>
          Staged talk test. Stop any time if you feel uncomfortable.
        </Text>

        <View style={{ marginTop: 16, backgroundColor: "#14141c", borderRadius: 16, padding: 14 }}>
          <Text style={{ color: "#a3a3a3" }}>Sensor</Text>
          <Text style={{ color: "white", marginTop: 6 }}>
            HR: {heartRate != null ? `${heartRate} bpm` : "--"}
          </Text>
          <Text style={{ color: "#a3a3a3", marginTop: 6 }}>
            Scanning: {isScanning ? "Yes" : "No"}
          </Text>

          <Pressable
            onPress={() => void startScan()}
            style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#20202b" }}
          >
            <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
              Scan for sensors
            </Text>
          </Pressable>
        </View>

        {!running ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ backgroundColor: "#14141c", borderRadius: 16, padding: 14 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>How it works</Text>
              <Text style={{ color: "#a3a3a3", marginTop: 8, lineHeight: 20 }}>
                You&apos;ll cycle through 3 stages at 3 minutes each. When you first notice you can&apos;t speak
                comfortably, tap I can&apos;t speak.
              </Text>
            </View>

            <Pressable
              onPress={begin}
              style={{ padding: 14, borderRadius: 14, backgroundColor: "#16a34a" }}
            >
              <Text style={{ color: "white", fontWeight: "800", textAlign: "center" }}>
                Start calibration
              </Text>
            </Pressable>

            <Pressable
              onPress={startManualEntry}
              style={{ padding: 14, borderRadius: 14, backgroundColor: "#20202b" }}
            >
              <Text style={{ color: "white", fontWeight: "800", textAlign: "center" }}>
                Enter VT1 manually
              </Text>
            </Pressable>

            {showManual && (
              <View style={{ backgroundColor: "#14141c", borderRadius: 16, padding: 14 }}>
                <Text style={{ color: "white", fontWeight: "800" }}>Manual VT1 (bpm)</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 6, lineHeight: 20 }}>
                  Only do this if you already know your VT1. Otherwise run the calibration above.
                </Text>

                <TextInput
                  value={manualVt1Text}
                  onChangeText={setManualVt1Text}
                  placeholder="example: 145"
                  placeholderTextColor="#6b7280"
                  keyboardType="number-pad"
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: "#20202b",
                    color: "white",
                    fontSize: 18,
                  }}
                />

                <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                  <Pressable
                    onPress={() => setShowManual(false)}
                    style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#20202b" }}
                  >
                    <Text style={{ color: "white", fontWeight: "800", textAlign: "center" }}>
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={submitManualVt1}
                    style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#2563eb" }}
                  >
                    <Text style={{ color: "white", fontWeight: "900", textAlign: "center" }}>
                      Save VT1
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ backgroundColor: "#14141c", borderRadius: 16, padding: 14 }}>
              <Text style={{ color: "white", fontWeight: "800" }}>
                {stage.title} — {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </Text>
              <Text style={{ color: "#a3a3a3", marginTop: 6 }}>{stage.subtitle}</Text>

              <View style={{ marginTop: 16, alignItems: "center" }}>
                <Text style={{ color: "white", fontSize: 44, fontWeight: "900" }}>
                  {heartRate != null ? heartRate : "--"}
                </Text>
                <Text style={{ color: "#a3a3a3", marginTop: 4 }}>bpm</Text>
                <ActivityIndicator style={{ marginTop: 12 }} />
              </View>
            </View>

            <Pressable
              onPress={cantSpeakNow}
              style={{ padding: 14, borderRadius: 14, backgroundColor: "#ef4444" }}
            >
              <Text style={{ color: "white", fontWeight: "900", textAlign: "center" }}>
                I can&apos;t speak comfortably
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setRunning(false)}
              style={{ padding: 14, borderRadius: 14, backgroundColor: "#20202b" }}
            >
              <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
                Pause / stop
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}