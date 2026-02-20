import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getVt1 } from "../storage/userPrefs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

export default function GateScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();// I need to change this to use expo-router, but I'll just comment it for now

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const vt1 = await getVt1();
        if (!mounted) return;
        nav.reset({
          index: 0,
          routes: [{ name: vt1 ? "Home" : "Calibration" }],// If VT1 is set, go to Home, otherwise go to Calibration
        });
      } 
      
      catch (e) {
        console.warn("GateScreen error", e);
        if (!mounted) return;
        nav.reset({ index: 0, routes: [{ name: "Calibration" }] });// if there is an error with VT1, just go to Calibration screen
      }
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Loading…</Text>
    </View>
  );
}
