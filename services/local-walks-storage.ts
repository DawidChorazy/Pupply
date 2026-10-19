import { getAccountId } from "./auth-storage";
import { getSessionRevision, subscribeSessionChanged } from "./session-events";
import { UpcomingWalk } from "@/types/walks";
import { Platform } from "react-native";

const STORAGE_KEY = "local_walks";

let memoryWalks: UpcomingWalk[] = [];
subscribeSessionChanged(() => { memoryWalks = []; });

function hasWebStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function loadLocalWalks(): Promise<UpcomingWalk[]> {
  const revision = getSessionRevision();
  const accountId = await getAccountId();
  if (revision !== getSessionRevision()) return [];
  const key = accountId ? `${STORAGE_KEY}:${accountId}` : STORAGE_KEY;
  try {
    if (Platform.OS === "web" && hasWebStorage()) {
      const raw = window.localStorage.getItem(key);
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
  const revision = getSessionRevision();
  const accountId = await getAccountId();
  if (revision !== getSessionRevision()) return;
  const key = accountId ? `${STORAGE_KEY}:${accountId}` : STORAGE_KEY;
  memoryWalks = walks;

  if (Platform.OS === "web" && hasWebStorage()) {
    window.localStorage.setItem(key, JSON.stringify(walks));
  }
}
