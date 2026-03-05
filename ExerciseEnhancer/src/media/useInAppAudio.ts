//src/media/useInAppAudio.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { Audio } from "expo-av";

export function useInAppAudio() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        //setting up the parameters for expo av audio
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          // playing a demp mp3 file stored in assets for testing/demonstration
          require("../../assets/demo.mp3"),
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );

        if (cancelled) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        setReady(true);
        setIsPlaying(true);
      } catch (e) {
        console.warn("Audio init failed", e);
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          const s = soundRef.current;
          soundRef.current = null;
          if (s) await s.unloadAsync();
        } catch {}
      })();
    };
  }, []);

  const play = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      await s.playAsync();
      setIsPlaying(true);
    } catch (e) {
      console.warn("play failed", e);
    }
  }, []);

  const pause = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      await s.pauseAsync();
      setIsPlaying(false);
    } catch (e) {
      console.warn("pause failed", e);
    }
  }, []);

  return { ready, isPlaying, play, pause };
}