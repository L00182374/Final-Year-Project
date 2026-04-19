// src/screens/ReplayScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    Pressable,
    ScrollView,
    Alert,
    ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import Screen from "../ui/Screen";
import LiveTrendChart from "../ui/LiveTrendChart";
import {
    listSavedSessionFiles,
    readSavedSessionFile,
} from "../logging/sessionStorage";
import {
    parseSessionCsvText,
    type ParsedSessionFile,
    type ParsedSessionSample,
} from "../logging/sessionCsvReader";
import { getZoneColour } from "../zone/ZoneManager";

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

type PlaybackSpeed = 1 | 2;

export default function ReplayScreen() {
    const [fileNames, setFileNames] = useState<string[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [loadingSession, setLoadingSession] = useState(false);

    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [session, setSession] = useState<ParsedSessionFile | null>(null);

    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

    useEffect(() => {
        void loadFiles();
    }, []);

    // Advance through the session at a fixed playback rate while replay is active.
    useEffect(() => {
        if (!isPlaying) return;
        if (!session) return;
        if (session.samples.length === 0) return;

        if (playbackIndex >= session.samples.length - 1) {
            setIsPlaying(false);
            return;
        }

        const delayMs = playbackSpeed === 2 ? 500 : 1000;

        const timer = setTimeout(() => {
            setPlaybackIndex((current) =>
                Math.min(current + 1, session.samples.length - 1),
            );
        }, delayMs);

        return () => clearTimeout(timer);
    }, [isPlaying, playbackIndex, session, playbackSpeed]);

    async function loadFiles() {
        setLoadingFiles(true);

        try {
            const files = await listSavedSessionFiles();
            setFileNames(files);
        } catch (error) {
            console.warn("listSavedSessionFiles failed", error);
            Alert.alert("Load failed", "Saved CSV files could not be loaded.");
        } finally {
            setLoadingFiles(false);
        }
    }

    async function handleOpenFile(fileName: string) {
        setLoadingSession(true);
        setIsPlaying(false);

        try {
            const text = await readSavedSessionFile(fileName);
            const parsed = parseSessionCsvText(text);

            if (parsed.samples.length === 0) {
                Alert.alert("Empty session", "That CSV does not contain any samples.");
                return;
            }

            setSelectedFileName(fileName);
            setSession(parsed);
            setPlaybackIndex(0);
        } catch (error) {
            console.warn("readSavedSessionFile failed", error);
            Alert.alert("Open failed", "The selected CSV could not be opened.");
        } finally {
            setLoadingSession(false);
        }
    }

    function handleBackToList() {
        setIsPlaying(false);
        setPlaybackIndex(0);
        setSession(null);
        setSelectedFileName(null);
    }

    function handleTogglePlayPause() {
        if (!session || session.samples.length === 0) return;

        if (playbackIndex >= session.samples.length - 1) {
            setPlaybackIndex(0);
            setIsPlaying(true);
            return;
        }

        setIsPlaying((current) => !current);
    }

    function handleResetPlayback() {
        setIsPlaying(false);
        setPlaybackIndex(0);
    }

    function handleToggleSpeed() {
        setPlaybackSpeed((current) => (current === 1 ? 2 : 1));
    }

    const currentSample: ParsedSessionSample | null =
        session?.samples[playbackIndex] ?? null;

    // Build short trend series up to the current replay point so the chart grows over time.
    const hrTrend = useMemo(
        () =>
            session
                ? session.samples
                    .slice(0, playbackIndex + 1)
                    .map((sample) => sample.heartRateSmooth)
                : [],
        [session, playbackIndex],
    );

    const cadenceTrend = useMemo(
        () =>
            session
                ? session.samples
                    .slice(0, playbackIndex + 1)
                    .map((sample) => sample.cadenceSmooth)
                : [],
        [session, playbackIndex],
    );

    const zoneColour = currentSample
        ? getZoneColour(currentSample.zone)
        : "#6b7280";

    return (
        <Screen>
            <ScrollView
                style={{ flex: 1, backgroundColor: "#0b0b0f" }}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>
                    CSV Replay
                </Text>

                <Text style={{ color: "#a3a3a3", marginTop: 6 }}>
                    Replay a saved session without reconnecting sensors.
                </Text>

                {!session ? (
                    <View
                        style={{
                            marginTop: 16,
                            backgroundColor: "#14141c",
                            borderRadius: 16,
                            padding: 14,
                        }}
                    >
                        <Text style={{ color: "#a3a3a3" }}>Saved sessions</Text>

                        {loadingFiles ? (
                            <View style={{ marginTop: 14, alignItems: "center" }}>
                                <ActivityIndicator />
                            </View>
                        ) : fileNames.length === 0 ? (
                            <Text style={{ color: "white", marginTop: 10 }}>
                                No saved CSV files found. Save a workout first.
                            </Text>
                        ) : (
                            <View style={{ marginTop: 12, gap: 10 }}>
                                {fileNames.map((fileName) => (
                                    <Pressable
                                        key={fileName}
                                        onPress={() => void handleOpenFile(fileName)}
                                        style={{
                                            padding: 14,
                                            borderRadius: 14,
                                            backgroundColor: "#20202b",
                                        }}
                                    >
                                        <Text style={{ color: "white", fontWeight: "700" }}>
                                            {fileName}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}

                        <Pressable
                            onPress={() => router.back()}
                            style={{
                                marginTop: 14,
                                padding: 14,
                                borderRadius: 14,
                                backgroundColor: "#20202b",
                            }}
                        >
                            <Text
                                style={{
                                    color: "white",
                                    fontWeight: "900",
                                    textAlign: "center",
                                }}
                            >
                                Back
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <View
                            style={{
                                marginTop: 16,
                                backgroundColor: "#14141c",
                                borderRadius: 16,
                                padding: 14,
                            }}
                        >
                            <Text style={{ color: "#a3a3a3" }}>Replay session</Text>

                            <Text style={{ color: "white", marginTop: 8, fontWeight: "700" }}>
                                {selectedFileName}
                            </Text>

                            <Text style={{ color: "#a3a3a3", marginTop: 8 }}>
                                Samples: {session.samples.length}
                            </Text>

                            <Text style={{ color: "#a3a3a3", marginTop: 4 }}>
                                VT1: {session.vt1 != null ? `${session.vt1} bpm` : "Not set"}
                            </Text>

                            <Text style={{ color: "#a3a3a3", marginTop: 4 }}>
                                Position: {playbackIndex + 1} / {session.samples.length}
                            </Text>

                            {loadingSession ? (
                                <View style={{ marginTop: 12, alignItems: "center" }}>
                                    <ActivityIndicator />
                                </View>
                            ) : null}
                        </View>

                        <View
                            style={{
                                marginTop: 12,
                                backgroundColor: "#14141c",
                                borderRadius: 16,
                                padding: 14,
                            }}
                        >
                            <Text style={{ color: "#a3a3a3" }}>Elapsed</Text>
                            <Text
                                style={{
                                    color: "white",
                                    fontSize: 30,
                                    fontWeight: "900",
                                    marginTop: 6,
                                }}
                            >
                                {currentSample ? formatDuration(currentSample.elapsedMs) : "0:00"}
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
                                    {currentSample?.zone ?? "N/A"}
                                </Text>

                                <Text
                                    style={{
                                        color: "white",
                                        opacity: 0.9,
                                        textAlign: "center",
                                        marginTop: 6,
                                    }}
                                >
                                    Cadence: {currentSample?.cadenceState ?? "N/A"}
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
                                <Text style={{ color: "#a3a3a3" }}>Heart Rate</Text>
                                <Text
                                    style={{
                                        color: "white",
                                        fontSize: 26,
                                        fontWeight: "900",
                                        marginTop: 8,
                                    }}
                                >
                                    {currentSample?.heartRateSmooth ?? "--"}
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
                                    {currentSample?.cadenceSmooth ?? "--"}
                                </Text>
                                <Text style={{ color: "#a3a3a3", marginTop: 2 }}>rpm</Text>
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
                                    {formatDuration(currentSample?.timeInZoneMs ?? 0)}
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
                                    {formatDuration(currentSample?.timeOutOfZoneMs ?? 0)}
                                </Text>
                            </View>
                        </View>

                        <LiveTrendChart
                            hrData={hrTrend}
                            cadenceData={cadenceTrend}
                            vt1={session.vt1}
                        />

                        <View
                            style={{
                                marginTop: 12,
                                flexDirection: "row",
                                gap: 12,
                                flexWrap: "wrap",
                            }}
                        >
                            <Pressable
                                onPress={handleTogglePlayPause}
                                style={{
                                    flex: 1,
                                    minWidth: 120,
                                    padding: 14,
                                    borderRadius: 14,
                                    backgroundColor: isPlaying ? "#ca8a04" : "#16a34a",
                                }}
                            >
                                <Text
                                    style={{
                                        color: "white",
                                        fontWeight: "900",
                                        textAlign: "center",
                                    }}
                                >
                                    {isPlaying
                                        ? "Pause"
                                        : playbackIndex >= session.samples.length - 1
                                            ? "Replay"
                                            : "Play"}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={handleResetPlayback}
                                style={{
                                    padding: 14,
                                    borderRadius: 14,
                                    backgroundColor: "#20202b",
                                }}
                            >
                                <Text style={{ color: "white", fontWeight: "900" }}>Reset</Text>
                            </Pressable>

                            <Pressable
                                onPress={handleToggleSpeed}
                                style={{
                                    padding: 14,
                                    borderRadius: 14,
                                    backgroundColor: "#2563eb",
                                }}
                            >
                                <Text style={{ color: "white", fontWeight: "900" }}>
                                    {playbackSpeed}x
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={handleBackToList}
                                style={{
                                    padding: 14,
                                    borderRadius: 14,
                                    backgroundColor: "#20202b",
                                }}
                            >
                                <Text style={{ color: "white", fontWeight: "900" }}>Files</Text>
                            </Pressable>
                        </View>
                    </>
                )}
            </ScrollView>
        </Screen>
    );
}