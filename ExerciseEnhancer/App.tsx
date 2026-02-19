// App.tsx
//this is an old file I'm not really using now so maybe remove it.



import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { BleProvider } from "./src/ble/ble";
import GateScreen from "./src/screens/GateScreen";
import CalibrationScreen from "./src/screens/CalibrationScreen";
import HomeScreen from "./src/screens/HomeScreen";
import WorkoutScreen from "./src/screens/WorkoutScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

export type RootStackParamList = {
  Gate: undefined;
  Calibration: undefined;
  Home: undefined;
  Workout: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <BleProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Gate" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Gate" component={GateScreen} />
          <Stack.Screen name="Calibration" component={CalibrationScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Workout" component={WorkoutScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </BleProvider>
  );
}
