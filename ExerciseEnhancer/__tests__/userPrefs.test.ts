// /__tests__/userPrefs.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VT1_KEY } from "../src/storage/keys";
import { clearVt1, getVt1, setVt1 } from "../src/storage/userPrefs";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("userPrefs VT1 storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no VT1 is stored", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

    await expect(getVt1()).resolves.toBeNull();
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(VT1_KEY);
  });

  it("returns a valid stored VT1", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("145");

    await expect(getVt1()).resolves.toBe(145);
  });

  it("returns null for invalid stored VT1", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("not-a-number");

    await expect(getVt1()).resolves.toBeNull();
  });

  it("returns null for non positive VT1s", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("0");

    await expect(getVt1()).resolves.toBeNull();
  });

  it("rounds VT1 before saving", async () => {
    await setVt1(144.6);

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(VT1_KEY, "145");
  });

  it("clears VT1", async () => {
    await clearVt1();

    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(VT1_KEY);
  });
});