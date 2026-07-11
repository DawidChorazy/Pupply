import { loadLocalWalks, saveLocalWalks } from "@/services/local-walks-storage";
import { getCaregiverById } from "@/features/walks/mockData";
import { BookWalkPayload, UpcomingWalk } from "@/types/walks";
import { ReactNode, createContext, useCallback, useContext, useState } from "react";

type WalksContextValue = {
  walks: UpcomingWalk[];
  isLoading: boolean;
  refreshWalks: () => Promise<void>;
  bookWalk: (payload: BookWalkPayload) => Promise<UpcomingWalk>;
};

const WalksContext = createContext<WalksContextValue | null>(null);

export function WalksProvider({ children }: { children: ReactNode }) {
  const [walks, setWalks] = useState<UpcomingWalk[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshWalks = useCallback(async () => {
    setIsLoading(true);

    try {
      const storedWalks = await loadLocalWalks();
      const normalizedWalks = storedWalks.map((walk) => ({
        ...walk,
        bookedAt: walk.bookedAt ?? new Date().toISOString(),
        caregiverPhone: walk.caregiverPhone ?? getCaregiverById(walk.caregiverId)?.phone ?? "+48 000 000 000"
      }));
      setWalks(normalizedWalks);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const bookWalk = useCallback(async (payload: BookWalkPayload) => {
    const caregiver = getCaregiverById(payload.caregiverId);

    const walk: UpcomingWalk = {
      id: `walk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      caregiverId: payload.caregiverId,
      caregiverName: payload.caregiverName,
      caregiverPhone: caregiver?.phone ?? "+48 000 000 000",
      petId: payload.petId,
      petName: payload.petName,
      time: `${payload.dayLabel}, ${payload.timeLabel}`,
      durationMinutes: payload.durationMinutes,
      durationLabel: payload.durationLabel,
      price: payload.price,
      status: "confirmed",
      bookedAt: new Date().toISOString()
    };

    setWalks((currentWalks) => {
      const nextWalks = [walk, ...currentWalks];
      void saveLocalWalks(nextWalks);
      return nextWalks;
    });

    return walk;
  }, []);

  return (
    <WalksContext.Provider value={{ walks, isLoading, refreshWalks, bookWalk }}>
      {children}
    </WalksContext.Provider>
  );
}

export function useWalksContext() {
  const context = useContext(WalksContext);

  if (!context) {
    throw new Error("useWalksContext must be used within WalksProvider");
  }

  return context;
}
