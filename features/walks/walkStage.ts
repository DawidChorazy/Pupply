import { UpcomingWalk, WalkStage } from "@/types/walks";

const WAITING_MS = 30 * 1000;
const RETURNING_MS = 2 * 60 * 1000;

export const WALK_STAGE_STEPS: { key: WalkStage; label: string; icon: string }[] = [
  { key: "waiting", label: "Oczekiwanie", icon: "clock-outline" },
  { key: "in_progress", label: "W trakcie", icon: "walk" },
  { key: "returning", label: "Powrót", icon: "home-export-outline" },
  { key: "completed", label: "Zakończony", icon: "check-circle-outline" }
];

export function getWalkStage(walk: UpcomingWalk, now = Date.now()): WalkStage {
  const bookedAt = new Date(walk.bookedAt).getTime();
  const elapsedMs = now - bookedAt;
  const walkMs = walk.durationMinutes * 60 * 1000;

  if (elapsedMs < WAITING_MS) {
    return "waiting";
  }

  if (elapsedMs < WAITING_MS + walkMs - RETURNING_MS) {
    return "in_progress";
  }

  if (elapsedMs < WAITING_MS + walkMs) {
    return "returning";
  }

  return "completed";
}

export function getWalkStageLabel(stage: WalkStage) {
  return WALK_STAGE_STEPS.find((step) => step.key === stage)?.label ?? stage;
}

export function getWalkStageIndex(stage: WalkStage) {
  return WALK_STAGE_STEPS.findIndex((step) => step.key === stage);
}

export function getWalkStartedAt(walk: UpcomingWalk) {
  return new Date(new Date(walk.bookedAt).getTime() + WAITING_MS);
}

export function getWalkElapsedSeconds(walk: UpcomingWalk, now = Date.now()) {
  const startedAt = getWalkStartedAt(walk).getTime();

  if (now < startedAt) {
    return 0;
  }

  const walkEndAt = startedAt + walk.durationMinutes * 60 * 1000;

  if (now > walkEndAt) {
    return walk.durationMinutes * 60;
  }

  return Math.floor((now - startedAt) / 1000);
}

export function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getWalkerMapPosition(walk: UpcomingWalk, now = Date.now()) {
  const stage = getWalkStage(walk, now);
  const walkMs = walk.durationMinutes * 60 * 1000;
  const startedAt = getWalkStartedAt(walk).getTime();
  const elapsedMs = Math.max(0, now - startedAt);

  let progress = Math.min(1, elapsedMs / walkMs);

  if (stage === "returning") {
    progress = 1 - Math.min(1, (now - (startedAt + walkMs - RETURNING_MS)) / RETURNING_MS) * 0.35;
  }

  if (stage === "completed") {
    progress = 0.12;
  }

  return {
    left: `${12 + progress * 56}%`,
    top: `${28 + Math.sin(progress * Math.PI) * 18}%`
  };
}
