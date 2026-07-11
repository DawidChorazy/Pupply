import { UpcomingWalk } from "@/types/walks";
import { Platform } from "react-native";

const STORAGE_KEY = "local_walks";

let memoryWalks: UpcomingWalk[] = [];

function hasWebStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function loadLocalWalks(): Promise<UpcomingWalk[]> {
  try {
    if (Platform.OS === "web" && hasWebStorage()) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as UpcomingWalk[]) : [];
      memoryWalks = parsed;
      return parsed;
    }

    return memoryWalks;
  } catch {
    return memoryWalks;
  }
}

export async function saveLocalWalks(walks: UpcomingWalk[]): Promise<void> {
  memoryWalks = walks;

  if (Platform.OS === "web" && hasWebStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(walks));
  }
}
