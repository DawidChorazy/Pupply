import { ReactNode, createContext, useContext, useMemo, useState } from "react";

import { LeaderboardUser, Quest, baseLeaderboard, initialQuests } from "./mockData";

type GamificationContextValue = {
  quests: Quest[];
  leaderboard: LeaderboardUser[];
  userPoints: number;
  claimQuest: (questId: string) => void;
};

const currentUserId = "current-user";

const GamificationContext = createContext<GamificationContextValue | null>(null);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const currentUser = baseLeaderboard.find((user) => user.id === currentUserId);
  const [quests, setQuests] = useState<Quest[]>(initialQuests);
  const [userPoints, setUserPoints] = useState(currentUser?.points ?? 0);

  const claimQuest = (questId: string) => {
    setQuests((currentQuests) => {
      const quest = currentQuests.find((item) => item.id === questId);

      if (!quest || quest.status !== "available") {
        return currentQuests;
      }

      setUserPoints((currentPoints) => currentPoints + quest.points);

      return currentQuests.map((item) =>
        item.id === questId
          ? {
              ...item,
              status: "claimed"
            }
          : item
      );
    });
  };

  const leaderboard = useMemo(
    () =>
      baseLeaderboard
        .map((user) =>
          user.id === currentUserId
            ? {
                ...user,
                points: userPoints
              }
            : user
        )
        .sort((firstUser, secondUser) => secondUser.points - firstUser.points),
    [userPoints]
  );

  const value = useMemo(
    () => ({
      quests,
      leaderboard,
      userPoints,
      claimQuest
    }),
    [leaderboard, quests, userPoints]
  );

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamification() {
  const context = useContext(GamificationContext);

  if (!context) {
    throw new Error("useGamification must be used inside GamificationProvider");
  }

  return context;
}
