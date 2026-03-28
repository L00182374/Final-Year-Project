// src/logging/sessionStorage.ts
import * as FileSystem from "expo-file-system/legacy";
import { buildSessionCsvFilename, serialiseSessionToCsv } from "./sessionCsv";
import type { SessionRecord } from "./sessionTypes";

// Sessions are stored in the document directory so they remain available between app launches and can be listed or shared
function getSessionsDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("No writable file system directory available");
  }

  return `${FileSystem.documentDirectory}sessions/`;
}

// Create the sessions directory if it does not already exist.
async function ensureSessionsDirectory(): Promise<string> {
  const sessionsDirectory = getSessionsDirectory();
  const directoryInfo = await FileSystem.getInfoAsync(sessionsDirectory);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(sessionsDirectory, {
      intermediates: true,
    });
  }

  return sessionsDirectory;
}

// Build the full path for a saved session file inside the sessions directory.
export function buildSavedSessionPath(fileName: string): string {
  return `${getSessionsDirectory()}${fileName}`;
}

// Serialise a session record to CSV and save it to local storage.
export async function saveSessionCsv(record: SessionRecord): Promise<string> {
  const sessionsDirectory = await ensureSessionsDirectory();
  const filePath = `${sessionsDirectory}${buildSessionCsvFilename(record)}`;
  const csv = serialiseSessionToCsv(record);

  await FileSystem.writeAsStringAsync(filePath, csv);
  return filePath;
}

// List saved CSV session files in reverse order. The filenames start with times, so this gives the newest sessions first
export async function listSavedSessionFiles(): Promise<string[]> {
  const sessionsDirectory = getSessionsDirectory();
  const directoryInfo = await FileSystem.getInfoAsync(sessionsDirectory);

  if (!directoryInfo.exists) {
    return [];
  }

  const files = await FileSystem.readDirectoryAsync(sessionsDirectory);

  return files
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .sort((a, b) => b.localeCompare(a));
}

// Read a saved CSV session file as plain text
export async function readSavedSessionFile(fileName: string): Promise<string> {
  return FileSystem.readAsStringAsync(buildSavedSessionPath(fileName));
}