// /__tests__/MediaRuleEngine.test.ts
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import CalibrationScreen from "../src/screens/CalibrationScreen";

const mockReplace = jest.fn();
const mockStartScan = jest.fn().mockResolvedValue(undefined);
const mockStopScan = jest.fn();
const mockSetVt1 = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("../src/ble/ble", () => ({
  useBle: () => ({
    startScan: mockStartScan,
    stopScan: mockStopScan,
    isScanning: false,
    heartRate: 150,
    hrDevice: { id: "hr-1" },
  }),
}));

jest.mock("../src/storage/userPrefs", () => ({
  setVt1: (...args: unknown[]) => mockSetVt1(...args),
}));

jest.mock("../src/ui/Screen", () => {
  const React = require("react");
  const { View } = require("react-native");

  return function MockScreen({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  };
});

describe("CalibrationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the main calibration content", async () => {
    const { getByText } = render(<CalibrationScreen />);

    expect(getByText("VT1 Calibration")).toBeTruthy();
    expect(getByText("Start calibration")).toBeTruthy();
    expect(getByText("Enter VT1 manually")).toBeTruthy();

    await waitFor(() => {
      expect(mockStartScan).toHaveBeenCalled();
    });
  });

  it("shows the manual VT1 entry warning first", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { getByText } = render(<CalibrationScreen />);
    fireEvent.press(getByText("Enter VT1 manually"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Manual VT1 entry",
      expect.stringContaining("already know your VT1"),
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });

  it("starts calibration when HR is available", () => {
    const { getByText } = render(<CalibrationScreen />);

    fireEvent.press(getByText("Start calibration"));

    expect(getByText(/Stage 1: Easy/)).toBeTruthy();
    expect(getByText(/speak comfortably/)).toBeTruthy();
  });

  it("saves VT1 when the user taps the speech difficulty button", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { getByText } = render(<CalibrationScreen />);

    fireEvent.press(getByText("Start calibration"));
    fireEvent.press(getByText(/speak comfortably/));

    await waitFor(() => {
      expect(mockSetVt1).toHaveBeenCalled();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Saved",
      "VT1 saved as 150 bpm",
      expect.any(Array),
    );

    const successCall = alertSpy.mock.calls.find((call) => call[0] === "Saved");

    expect(successCall).toBeTruthy();

    const buttons = successCall?.[2] as
      | Array<{ text?: string; onPress?: () => void }>
      | undefined;

    const okButton = buttons?.find((button) => button.text === "OK");

    expect(okButton).toBeTruthy();

    okButton?.onPress?.();

    expect(mockReplace).toHaveBeenCalledWith("/home");

    alertSpy.mockRestore();
  });
});
