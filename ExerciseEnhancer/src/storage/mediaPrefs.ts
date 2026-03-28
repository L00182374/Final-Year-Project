// src/storage/mediaPrefs.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type MediaTarget = "phone" | "pc" | "auto";

const MEDIA_TARGET_KEY = "media_target";

export async function getMediaTarget(): Promise<MediaTarget> {
  try {
    const value = await AsyncStorage.getItem(MEDIA_TARGET_KEY);

    if (value === "phone" || value === "pc" || value === "auto") {
      return value;
    }

    return "phone";
  } catch (error) {
    console.warn("getMediaTarget failed", error);
    return "phone";
  }
}

export async function setMediaTarget(target: MediaTarget): Promise<void> {
  try {
    await AsyncStorage.setItem(MEDIA_TARGET_KEY, target);
  } catch (error) {
    console.warn("setMediaTarget failed", error);
  }
}