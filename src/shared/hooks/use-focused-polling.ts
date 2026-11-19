import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { getSessionRevision, subscribeSessionChanged } from "@/shared/session/session-events";

// Only one request at a time, while the screen is focused and the app is visible.
// Callers check isCurrent before applying results from any awaited operation.
export function useFocusedPolling(task: (isCurrent: () => boolean) => Promise<void>, intervalMs = 4000) {
  const taskRef = useRef(task);
  useEffect(() => { taskRef.current = task; }, [task]);
  useFocusEffect(useCallback(() => {
    let alive = true, busy = false, rerun = false, generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const revision = getSessionRevision();
    const visible = () => AppState.currentState !== "background" && AppState.currentState !== "inactive"
      && (typeof document === "undefined" || document.visibilityState !== "hidden");
    const current = () => alive && revision === getSessionRevision() && visible();
    const run = async () => {
      if (!current() || busy) return;
      busy = true;
      const started = generation;
      try { await taskRef.current(() => current() && generation === started); }
      catch { /* The screen reports failures; keep the next poll available. */ }
      finally {
        busy = false;
        if (current()) {
          if (rerun) { rerun = false; void run(); }
          else timer = setTimeout(() => void run(), intervalMs);
        }
      }
    };
    const wake = () => {
      generation += 1;
      clearTimeout(timer);
      if (busy) rerun = true;
      else void run();
    };
    const appState = AppState.addEventListener("change", wake);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", wake);
    const unsubscribe = subscribeSessionChanged(() => { alive = false; generation += 1; clearTimeout(timer); });
    void run();
    return () => {
      alive = false; generation += 1; clearTimeout(timer); appState.remove(); unsubscribe();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", wake);
    };
  }, [intervalMs]));
}
