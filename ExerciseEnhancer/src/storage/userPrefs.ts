import AsyncStorage from "@react-native-async-storage/async-storage";
import { VT1_KEY } from "./keys";

export async function getVt1(): Promise<number | null> {
  const vt1 = await AsyncStorage.getItem(VT1_KEY);
  if (!vt1) return null;// if there is no value, return null
  const num = Number(vt1);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export async function setVt1(vt1: number): Promise<void> {
  await AsyncStorage.setItem(VT1_KEY, String(Math.round(vt1)));
}

export async function clearVt1(): Promise<void> {
  await AsyncStorage.removeItem(VT1_KEY);
}
