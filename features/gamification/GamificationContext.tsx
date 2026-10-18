import {
  getSessionRevision,
  subscribeSessionChanged
} from "@/services/session-events";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { router } from "expo-router";
import { ApiError } from "@/services/api-client";
import { clearAuthTokens, getAccessToken } from "@/services/auth-storage";
import {
  claimQuestReward,
  getLeaderboard,
  getQuests
} from "@/services/gamification-service";
import { LeaderboardState, QuestState } from "@/types/gamification";

type GamificationContextValue = {
  questState: QuestState | null;
  ranking: LeaderboardState | null;
  questsLoading: boolean;
  rankingLoading: boolean;
  questsError: string;
  rankingError: string;
  claimError: string;
  claimingId: string | null;
  refreshQuests: () => Promise<void>;
  refreshRanking: () => Promise<void>;
  claimQuest: (id: string) => Promise<void>;
};
const GamificationContext = createContext<GamificationContextValue | null>(
  null
);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [questState, setQuestState] = useState<QuestState | null>(null);
  const [ranking, setRanking] = useState<LeaderboardState | null>(null);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [questsError, setQuestsError] = useState("");
  const [rankingError, setRankingError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const questsRequest = useRef(0);
  const rankingRequest = useRef(0);
  const claiming = useRef(false);
  useEffect(
    () =>
      subscribeSessionChanged(() => {
        questsRequest.current++;
        rankingRequest.current++;
        claiming.current = false;
        setQuestState(null);
        setRanking(null);
        setQuestsError("");
        setRankingError("");
        setClaimError("");
        setQuestsLoading(false);
        setRankingLoading(false);
        setClaimingId(null);
      }),
    []
  );

  const checkSession = useCallback(async (error: unknown, revision: number) => {
    if (error instanceof ApiError && error.status === 401) {
      if (revision === getSessionRevision()) await clearAuthTokens();
      if (!(await getAccessToken())) router.replace("/");
      return true;
    }
    return false;
  }, []);

  const refreshQuests = useCallback(async () => {
    if (claiming.current) return;
    const request = ++questsRequest.current;
    const revision = getSessionRevision();
    const active = () =>
      request === questsRequest.current && revision === getSessionRevision();
    setQuestsLoading(true);
    setQuestsError("");
    try {
      const response = await getQuests();
      if (active()) setQuestState(response);
    } catch (error) {
      if (await checkSession(error, revision)) return;
      if (active())
        setQuestsError("Nie udało się pobrać zadań. Spróbuj ponownie.");
    } finally {
      if (active()) setQuestsLoading(false);
    }
  }, [checkSession]);

  const refreshRanking = useCallback(async () => {
    const request = ++rankingRequest.current;
    const revision = getSessionRevision();
    const active = () =>
      request === rankingRequest.current && revision === getSessionRevision();
    setRankingLoading(true);
    setRankingError("");
    try {
      const response = await getLeaderboard();
      if (active()) setRanking(response);
    } catch (error) {
      if (await checkSession(error, revision)) return;
      if (active())
        setRankingError("Nie udało się pobrać rankingu. Spróbuj ponownie.");
    } finally {
      if (active()) setRankingLoading(false);
    }
  }, [checkSession]);

  const claimQuest = useCallback(
    async (id: string) => {
      if (claiming.current) return;
      claiming.current = true;
      const revision = getSessionRevision();
      questsRequest.current++;
      setQuestsLoading(false);
      setClaimingId(id);
      setClaimError("");
      try {
        const response = await claimQuestReward(id);
        if (revision !== getSessionRevision()) return;
        setQuestState(response);
        setQuestsError("");
        await refreshRanking();
      } catch (error) {
        if (await checkSession(error, revision)) return;
        if (revision !== getSessionRevision()) return;
        setClaimError(
          error instanceof ApiError && error.status === 409
            ? "Zadanie nie jest jeszcze wykonane. Odśwież listę i sprawdź postęp."
            : "Nie udało się odebrać punktów. Możesz bezpiecznie spróbować ponownie."
        );
      } finally {
        if (revision === getSessionRevision()) {
          claiming.current = false;
          setClaimingId(null);
        }
      }
    },
    [checkSession, refreshRanking]
  );

  return (
    <GamificationContext.Provider
      value={{
        questState,
        ranking,
        questsLoading,
        rankingLoading,
        questsError,
        rankingError,
        claimError,
        claimingId,
        refreshQuests,
        refreshRanking,
        claimQuest
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}
export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context)
    throw new Error("useGamification must be used inside GamificationProvider");
  return context;
}
