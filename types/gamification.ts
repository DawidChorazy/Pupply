export type Quest = {
  id: string;
  title: string;
  description: string;
  points: number;
  target: number;
  progress: number;
  icon: "paw" | "dog-service" | "walk" | "calendar-star";
  status: "available" | "claimed" | "locked";
};
export type QuestState = { quests: Quest[]; userPoints: number };
export type LeaderboardUser = {
  id: string;
  name: string;
  points: number;
  rank: number;
  isCurrentUser: boolean;
};
export type LeaderboardState = {
  leaderboard: LeaderboardUser[];
  currentUser: LeaderboardUser | null;
};
