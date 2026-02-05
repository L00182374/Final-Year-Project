// App.tsx
import React from "react";
import { SafeAreaView, Text, Button, FlatList, TouchableOpacity, View } from "react-native";
import { useBle } from "./full";

export default function App() {
  const {
    isScanning,
    devices,
    scanAndConnect,
    stopScan,
    connectedDevice,
    heartRate,
    cadence,
    disconnect,
  } = useBle();

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>BLE Demo</Text>

      <View style={{ marginVertical: 12 }}>
        <Button title={isScanning ? "Stop scan" : "Scan & auto-connect"} onPress={() => (isScanning ? stopScan() : scanAndConnect())} /*button that either shows stop scan or scan and connect depending on whether or not the app is already scanning */ /> 
      </View>

      <Text style={{ fontWeight: "600" }}>Discovered devices</Text>
      <FlatList
        data={devices}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              // manual connect 
              scanAndConnect({ name: item.name }); 
            }}
            style={{ padding: 10, borderBottomWidth: 1, borderColor: "#eee" }}
          >
            <Text>{item.name ?? "Unknown"}</Text>
            <Text style={{ fontSize: 10 }}>{item.id}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={{ marginTop: 20 }}>
        <Text>Connected: {connectedDevice ? connectedDevice.name : "none"}</Text>
        <Text>Heart rate: {heartRate ?? "--"} bpm</Text>
        <Text>Cadence: {cadence ?? "--"} rpm</Text>
        {connectedDevice && <Button title="Disconnect" onPress={disconnect} />}
      </View>
    </SafeAreaView>
  );
}
