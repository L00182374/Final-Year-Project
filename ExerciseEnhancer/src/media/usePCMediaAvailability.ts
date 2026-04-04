// src/media/usePcMediaAvailability.ts
import { useCallback, useEffect, useState } from "react";
import { isPcMediaAvailable } from "./pcMedia";

// Custom hook to check if the PC media helper is available and manage its state.
export function usePcMediaAvailability(enabled: boolean) {
  const [pcMediaAvailable, setPcMediaAvailable] = useState(false);
  const [checkingPcMedia, setCheckingPcMedia] = useState(false);

  // refresh the availability status of the PC media helper.
  const refreshPcMediaAvailability = useCallback(async () => {
    if (!enabled) {
      setPcMediaAvailable(false);
      return;
    }

    setCheckingPcMedia(true);

    // Check availability and update state, ensuring to reset the checking state afterwards.
    try {
      const available = await isPcMediaAvailable();
      setPcMediaAvailable(available);
    } finally {
      setCheckingPcMedia(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshPcMediaAvailability();
  }, [refreshPcMediaAvailability]);

  // Return the availability status, checking status, and the function to refresh the availability.
  return {
    pcMediaAvailable,
    checkingPcMedia,
    refreshPcMediaAvailability,
  };
}