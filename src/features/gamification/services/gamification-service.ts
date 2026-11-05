import { authenticatedApiRequest } from "@/shared/api/api-client";
import { QuestState, LeaderboardState } from "@/features/gamification/types/gamification";

export const getQuests = () =>
  authenticatedApiRequest<QuestState>("/gamification/quests");
export const getLeaderboard = () =>
  authenticatedApiRequest<LeaderboardState>("/gamification/leaderboard");
export const claimQuestReward = (id: string) =>
  authenticatedApiRequest<QuestState>(
    `/gamification/quests/${encodeURIComponent(id)}/claim`,
    { method: "POST" }
  );
