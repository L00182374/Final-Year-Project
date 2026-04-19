// src/screens/WorkoutScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  AppState,
  AppStateStatus,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import * as Sharing from "expo-sharing";
import LiveTrendChart from "../ui/LiveTrendChart";
import { useBle } from "../ble/ble";
import { getVt1 } from "../storage/userPrefs";
import { getMediaTarget, type MediaTarget } from "../storage/mediaPrefs";
import Screen from "../ui/Screen";
import { useInAppAudio } from "../media/useInAppAudio";
import {
  defaultMediaRuleConfig,
  defaultMediaRuleState,
  stepMediaRule,
} from "../media/MediaRuleEngine";
import {
  defaultZoneManagerState,
  getZoneColour,
  stepZoneManager,
  type ZoneManagerState,
} from "../zone/ZoneManager";
import {
  appendSessionSample,
  createSessionRecord,
  finishSessionRecord,
} from "../logging/sessionRecorder";
import { saveSessionCsv } from "../logging/sessionStorage";
import type { SessionRecord } from "../logging/sessionTypes";
import { usePcMediaAvailability } from "../media/usePCMediaAvailability";
import { pausePcMedia, playPcMedia } from "../media/pcMedia";
import { useKeepAwake } from "expo-keep-awake";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Keep only the most recent points for the live chart.
function pushTrendValue(
  previous: Array<number | null>,
  next: number | null,
  maxPoints: number,
): Array<number | null> {
  const updated = [...previous, next];
  return updated.slice(Math.max(0, updated.length - maxPoints));
}

export default function WorkoutScreen() {
  const navigation = useNavigation();
  useKeepAwake();// prevent screen from sleeping during workout
  const { ready: audioReady, isPlaying, play, pause } = useInAppAudio();

  const [simulateZone, setSimulateZone] = useState(false);
  const [dummyInZone, setDummyInZone] = useState(true);

  const mediaCfgRef = useRef(defaultMediaRuleConfig);
  const mediaStateRef = useRef(defaultMediaRuleState);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const { hrDevice, cadenceDevice, heartRate, cadence, hrFresh, cadenceFresh } =
    useBle();

  const [vt1, setVt1State] = useState<number | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget>("phone");
  const [pcMediaMode, setPcMediaMode] = useState<"PLAYING" | "PAUSED">(
    "PAUSED",
  );
  
  // Keep the workout mode fixed from the moment a session starts.
  const [sessionCadenceRequired, setSessionCadenceRequired] = useState(false);

  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [zoneTick, setZoneTick] = useState(Date.now());
  const [zoneState, setZoneState] = useState<ZoneManagerState>(
    defaultZoneManagerState,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const [hrTrend, setHrTrend] = useState<Array<number | null>>([]);
  const [cadenceTrend, setCadenceTrend] = useState<Array<number | null>>([]);

  const sessionRef = useRef<SessionRecord | null>(null);
  const lastLoggedTickRef = useRef<number | null>(null);
  const lastTrendTickRef = useRef<number | null>(null);

  const { pcMediaAvailable } = usePcMediaAvailability(
    mediaTarget === "pc" || mediaTarget === "auto",
  );

  const usingPcMedia =
    mediaTarget === "pc" || (mediaTarget === "auto" && pcMediaAvailable);

  const resolvedMediaTargetLabel = usingPcMedia ? "PC" : "Phone";

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, []);

  const safePlay = useCallback(async () => {
    if (!audioReady) return;

    if (appStateRef.current !== "active") {
      console.warn("Skipping play because app is not active");
      return;
    }

    try {
      await play();
    } catch (error) {
      console.warn("play failed", error);
    }
  }, [audioReady, play]);

  const safePause = useCallback(async () => {
    try {
      await pause();
    } catch (error) {
      console.warn("pause failed", error);
    }
  }, [pause]);

  // Send pause to the selected media target, falling back to phone audio when PC isn't available.
  const pauseSelectedMedia = useCallback(async () => {
    if (mediaTarget === "pc") {
      try {
        await pausePcMedia();
        setPcMediaMode("PAUSED");
      } catch (error) {
        console.warn("pausePcMedia failed", error);
      }
      return;
    }

    if (mediaTarget === "auto" && pcMediaAvailable) {
      try {
        await pausePcMedia();
        setPcMediaMode("PAUSED");
        return;
      } catch (error) {
        console.warn("pausePcMedia failed", error);
      }
    }

    await safePause();
    setPcMediaMode("PAUSED");
  }, [mediaTarget, pcMediaAvailable, safePause]);

  const playSelectedMedia = useCallback(async () => {
    if (mediaTarget === "pc") {
      try {
        await playPcMedia();
        setPcMediaMode("PLAYING");
      } catch (error) {
        console.warn("playPcMedia failed", error);
      }
      return;
    }

    if (mediaTarget === "auto" && pcMediaAvailable) {
      try {
        await playPcMedia();
        setPcMediaMode("PLAYING");
        return;
      } catch (error) {
        console.warn("playPcMedia failed", error);
      }
    }

    await safePlay();
    setPcMediaMode("PLAYING");
  }, [mediaTarget, pcMediaAvailable, safePlay]);

  useEffect(() => {
    (async () => {
      const value = await getVt1();
      setVt1State(value);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const savedMediaTarget = await getMediaTarget();
      setMediaTarget(savedMediaTarget);
    })();
  }, []);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    const timer = setInterval(() => {
      setZoneTick(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // recalculate zone state once per tick using the latest sensor readings and session mode.
  useEffect(() => {
    setZoneState((previous: ZoneManagerState) =>
      stepZoneManager({
        state: previous,
        input: {
          nowMs: zoneTick,
          active,
          vt1,
          heartRate,
          cadence,
          hrFresh,
          cadenceFresh,
          cadenceDeviceConnected: cadenceDevice != null,
          cadenceRequired: sessionCadenceRequired,
        },
      }),
    );
    }, [
    zoneTick,
    active,
    vt1,
    heartRate,
    cadence,
    hrFresh,
    cadenceFresh,
    cadenceDevice,
    sessionCadenceRequired,
  ]);

  useEffect(() => {
    if (zoneState.lastTickMs == null) return;

    if (lastTrendTickRef.current === zoneState.lastTickMs) return;
    lastTrendTickRef.current = zoneState.lastTickMs;

    setHrTrend((previous) => pushTrendValue(previous, zoneState.hrSmooth, 60));

    setCadenceTrend((previous) =>
      pushTrendValue(previous, zoneState.cadenceSmooth, 60),
    );
  }, [zoneState.lastTickMs, zoneState.hrSmooth, zoneState.cadenceSmooth]);

  // Resolve playback state from the active media target.
  const mediaIsPlaying = usingPcMedia
    ? pcMediaMode === "PLAYING"
    : isPlaying;

  useEffect(() => {
    if (!active) return;
    if (!sessionRef.current) return;
    if (zoneState.lastTickMs == null) return;

    if (lastLoggedTickRef.current === zoneState.lastTickMs) return;
    lastLoggedTickRef.current = zoneState.lastTickMs;

    // Append one sample per zone tick while a session is active.
    appendSessionSample(sessionRef.current, {
      recordedAtMs: zoneState.lastTickMs,
      elapsedMs: Math.max(
        0,
        zoneState.lastTickMs - sessionRef.current.startedAtMs,
      ),

      heartRateRaw: heartRate,
      heartRateSmooth: zoneState.hrSmooth,
      hrFresh,

      cadenceRaw: cadence,
      cadenceSmooth: zoneState.cadenceSmooth,
      cadenceFresh,

      zone: zoneState.zone,
      cadenceState: zoneState.cadenceState.label,
      inZone: zoneState.inZone,
      signalGraceActive: zoneState.signalGraceActive,

      timeInZoneMs: zoneState.timeInZoneMs,
      timeOutOfZoneMs: zoneState.timeOutOfZoneMs,

      mediaPlaying: mediaIsPlaying,
    });
  }, [
    active,
    heartRate,
    cadence,
    hrFresh,
    cadenceFresh,
    mediaIsPlaying,
    zoneState,
  ]);

  // Prevent accidental navigation away from an active or unsaved workout.
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener(
      "beforeRemove",
      (event: any) => {
        const hasProgress =
          sessionRef.current != null &&
          (active || sessionRef.current.samples.length > 0);

        if (!hasProgress) {
          return;
        }

        event.preventDefault();

        Alert.alert(
          "Leave workout?",
          "Your current workout progress will be lost.",
          [
            {
              text: "Stay",
              style: "cancel",
            },
            {
              text: "Leave",
              style: "destructive",
              onPress: () => {
                sessionRef.current = null;
                (navigation as any).dispatch(event.data.action);
              },
            },
          ],
        );
      },
    );

    return unsubscribe;
  }, [navigation, active]);

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  const zoneColour = getZoneColour(zoneState.zone);
  const inZone = simulateZone ? dummyInZone : zoneState.inZone;

  const mediaReady = usingPcMedia ? true : audioReady;

  const mediaStatusText = !mediaReady
    ? "Loading"
    : mediaIsPlaying
      ? "Playing"
      : "Paused";

  const mediaStatusColour = !mediaReady
    ? "#6b7280"
    : mediaIsPlaying
      ? "#22c55e"
      : "#ef4444";

  const hrStatus = !hrDevice
    ? "Not connected"
    : hrFresh
      ? "Live"
      : "Signal lost";

  const cadenceStatus = !cadenceDevice
    ? "Not connected"
    : cadenceFresh
      ? "Live"
      : "Signal lost";

  const sampleCount = sessionRef.current?.samples.length ?? 0;

  const toggleManualMedia = async () => {
    if (!usingPcMedia && !audioReady) return;

    if (mediaIsPlaying) {
      mediaStateRef.current = {
        ...mediaStateRef.current,
        mode: "PAUSED",
        outSinceMs: null,
        inSinceMs: null,
      };
      setPcMediaMode("PAUSED");
      await pauseSelectedMedia();
      return;
    }

    mediaStateRef.current = {
      ...mediaStateRef.current,
      mode: "PLAYING",
      outSinceMs: null,
      inSinceMs: null,
    };
    setPcMediaMode("PLAYING");
    await playSelectedMedia();
  };

  // Reset the live workout state without changing stored VT1 or saved sessions.
  function resetWorkoutState() {
    setActive(false);
    setSeconds(0);
    setZoneState(defaultZoneManagerState);
    setHrTrend([]);
    setCadenceTrend([]);
    setSessionCadenceRequired(false);
    lastLoggedTickRef.current = null;
    lastTrendTickRef.current = null;
    mediaStateRef.current = { ...defaultMediaRuleState };
    setPcMediaMode("PAUSED");
    void pauseSelectedMedia();
  }

  // Start a new session on first press, then toggle between running and paused states.
  function handleStartPausePress() {
    if (active) {
      setActive(false);
      return;
    }

    if (!sessionRef.current) {
      const startedAtMs = Date.now();

      sessionRef.current = createSessionRecord({
        startedAtMs,
        vt1,
      });

      // Lock the workout mode when the session begins.
      setSessionCadenceRequired(cadenceDevice != null);

      setSaveMessage(null);
      setLastSavedPath(null);
      setSeconds(0);
      setZoneState(defaultZoneManagerState);
      setHrTrend([]);
      setCadenceTrend([]);
      lastLoggedTickRef.current = null;
      lastTrendTickRef.current = null;
      setPcMediaMode("PAUSED");
    }

    setActive(true);
  }

  function handleResetPress() {
    const hasProgress =
      sessionRef.current != null &&
      (active || sessionRef.current.samples.length > 0);

    if (!hasProgress) {
      sessionRef.current = null;
      setSaveMessage(null);
      resetWorkoutState();
      return;
    }

    Alert.alert(
      "Reset workout?",
      "This will discard the current workout progress.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            sessionRef.current = null;
            setSaveMessage(null);
            resetWorkoutState();
          },
        },
      ],
    );
  }

  async function handleShareLastSavedPress() {
    if (!lastSavedPath) {
      Alert.alert("No CSV available", "Save a workout first.");
      return;
    }

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      Alert.alert(
        "Sharing unavailable",
        "This device cannot share files right now.",
      );
      return;
    }

    try {
      await Sharing.shareAsync(lastSavedPath);
    } catch (error) {
      console.warn("shareAsync failed", error);
      Alert.alert("Share failed", "The CSV could not be shared.");
    }
  }

  // End the current session, write the CSV, and clear the in memory workout state.
  async function performFinishAndSave() {
    setActive(false);

    const current = sessionRef.current;
    if (!current) {
      setSaveMessage("No session to save");
      resetWorkoutState();
      return;
    }

    if (current.samples.length === 0) {
      sessionRef.current = null;
      setSaveMessage("No samples recorded");
      resetWorkoutState();
      return;
    }

    const finished = finishSessionRecord(current, Date.now());

    try {
      const path = await saveSessionCsv(finished);
      setLastSavedPath(path);
      setSaveMessage(`Saved ${finished.samples.length} samples`);
      sessionRef.current = null;
      resetWorkoutState();

      Alert.alert(
        "Workout saved",
        "The CSV was saved inside the app. Use Share CSV to export it.",
      );
    } catch (error) {
      console.warn("saveSessionCsv failed", error);
      setSaveMessage("Save failed");
      Alert.alert("Save failed", "The CSV could not be saved.");
    }
  }

  function handleFinishAndSavePress() {
    const current = sessionRef.current;

    if (!current || current.samples.length === 0) {
      void performFinishAndSave();
      return;
    }

    Alert.alert(
      "Finish and save?",
      "This will end the workout and save the CSV.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Save",
          onPress: () => {
            void performFinishAndSave();
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (!active) {
      mediaStateRef.current = { ...defaultMediaRuleState };
      setPcMediaMode("PAUSED");
      void pauseSelectedMedia();
    }
  }, [active, pauseSelectedMedia]);

  useEffect(() => {
    if (!active) return;
    if (!usingPcMedia && !audioReady) return;

    const timer = setInterval(() => {
      const nowMs = Date.now();
      const { nextState, intent } = stepMediaRule({
        nowMs,
        inZone,
        config: mediaCfgRef.current,
        state: mediaStateRef.current,
      });

      mediaStateRef.current = nextState;
      setPcMediaMode(nextState.mode);

      if (intent === "PAUSE") void pauseSelectedMedia();
      if (intent === "PLAY") void playSelectedMedia();
    }, 1000);

    return () => clearInterval(timer);
  }, [
    active,
    inZone,
    audioReady,
    usingPcMedia,
    pauseSelectedMedia,
    playSelectedMedia,
  ]);

  const zoneDetailText = useMemo(() => {
    if (zoneState.signalGraceActive) {
      return "Holding previous zone during brief signal loss";
    }

    if (zoneState.candidateZone != null) {
      return `Pending change to ${zoneState.candidateZone}`;
    }

    return `Cadence: ${zoneState.cadenceState.label}`;
  }, [
    zoneState.signalGraceActive,
    zoneState.candidateZone,
    zoneState.cadenceState.label,
  ]);

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#0b0b0f" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
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
              backgroundColor: zoneColour,
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
              {zoneState.zone}
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

            <Text
              style={{
                color: "white",
                opacity: 0.9,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {zoneDetailText}
            </Text>
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
            <Text style={{ color: "#a3a3a3" }}>In zone</Text>
            <Text
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: "900",
                marginTop: 8,
              }}
            >
              {formatDuration(zoneState.timeInZoneMs)}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#14141c",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: "#a3a3a3" }}>Out of zone</Text>
            <Text
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: "900",
                marginTop: 8,
              }}
            >
              {formatDuration(zoneState.timeOutOfZoneMs)}
            </Text>
          </View>
        </View>

        <LiveTrendChart hrData={hrTrend} cadenceData={cadenceTrend} vt1={vt1} />

        <View
          style={{
            marginTop: 12,
            backgroundColor: "#14141c",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <Text style={{ color: "#a3a3a3" }}>Session</Text>
          <Text style={{ color: "white", marginTop: 8 }}>
            Samples: {sampleCount}
          </Text>

          {saveMessage ? (
            <Text style={{ color: "white", marginTop: 6 }}>{saveMessage}</Text>
          ) : null}

          {lastSavedPath ? (
            <Text style={{ color: "#a3a3a3", marginTop: 6 }} numberOfLines={2}>
              {lastSavedPath}
            </Text>
          ) : null}
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
                  width: mediaIsPlaying ? "65%" : "18%",
                  height: "100%",
                  backgroundColor: mediaStatusColour,
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
                backgroundColor: mediaStatusColour,
              }}
            >
              <Text style={{ color: "white", fontSize: 11, fontWeight: "800" }}>
                {mediaStatusText}
              </Text>
            </View>

            <Text
              style={{
                color: "#a3a3a3",
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Target: {resolvedMediaTargetLabel}
            </Text>

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
                name={mediaIsPlaying ? "pause" : "play"}
                size={16}
                color="white"
                style={{ marginLeft: mediaIsPlaying ? 0 : 2 }}
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
              {hrFresh && zoneState.hrSmooth != null
                ? zoneState.hrSmooth
                : "--"}
            </Text>

            <Text style={{ color: "#a3a3a3", marginTop: 2 }}>bpm</Text>
            <Text style={{ color: "#a3a3a3", marginTop: 6 }}>{hrStatus}</Text>
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
              {cadenceFresh && zoneState.cadenceSmooth != null
                ? zoneState.cadenceSmooth
                : "--"}
            </Text>

            <Text style={{ color: "#a3a3a3", marginTop: 2 }}>rpm</Text>
            <Text style={{ color: "#a3a3a3", marginTop: 6 }}>
              {cadenceStatus}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Pressable
            onPress={handleStartPausePress}
            style={{
              flex: 1,
              minWidth: 120,
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
            onPress={handleFinishAndSavePress}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#2563eb",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>
              Finish & save
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void handleShareLastSavedPress()}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Share CSV</Text>
          </Pressable>

          <Pressable
            onPress={handleResetPress}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "#20202b",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Reset</Text>
          </Pressable>

          {__DEV__ && (
            <>
              <Pressable
                onPress={() => setSimulateZone((value) => !value)}
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
                  onPress={() => setDummyInZone((value) => !value)}
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
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}