import { getSessionRevision, subscribeSessionChanged } from "@/services/session-events";
import { listBookings } from "@/services/bookings-service";
import { getAccessToken } from "@/services/auth-storage";
import { UpcomingWalk } from "@/types/walks";
import { Booking } from "@/types/marketplace";
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type WalksContextValue = { walks: UpcomingWalk[]; isLoading: boolean; error: string; refreshWalks: () => Promise<void> };
const WalksContext = createContext<WalksContextValue | null>(null);

export function WalksProvider({ children }: { children: ReactNode }) {
  const [walks, setWalks] = useState<UpcomingWalk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => subscribeSessionChanged(() => { request.current++; setWalks([]); setError(""); setIsLoading(false); }), []);
  const refreshWalks = useCallback(async () => {
    const revision = getSessionRevision();
    const current = ++request.current;
    const active = () => current === request.current && revision === getSessionRevision();
    setIsLoading(true); setError("");
    try {
      if (!await getAccessToken()) { if (active()) setWalks([]); return; }
      const bookings: Booking[] = [];
      let page = 1;
      let total = 0;
      do {
        const response = await listBookings({ perspective: "owner", page, pageSize: 50 });
        if (!active()) return;
        bookings.push(...response.items); total = response.pagination.total; page++;
        if (!response.items.length) break;
      } while (bookings.length < total);
      setWalks(bookings.filter(b => b.sitterService.type === "DOG_WALK" && ["REQUESTED", "ACCEPTED"].includes(b.status))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(booking => ({
          id: booking.id, bookingStatus: booking.status, startsAt: booking.startsAt, endsAt: booking.endsAt,
          caregiverId: booking.sitterAccountId, caregiverName: booking.sitter.userProfile?.fullName ?? "Opiekun Pupply", caregiverPhone: "",
          petId: booking.petId, petName: booking.pet.name, time: new Date(booking.startsAt).toLocaleString("pl-PL"),
          durationMinutes: Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60000),
          durationLabel: `${Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60000)} min`,
          price: booking.priceCents / 100, status: booking.status === "ACCEPTED" ? "confirmed" as const : "pending" as const, bookedAt: booking.createdAt
        })));
    } catch (error) {
      if (active()) { setWalks([]); setError(error instanceof Error ? error.message : "Nie udało się pobrać spacerów"); }
    } finally { if (active()) setIsLoading(false); }
  }, []);
  return <WalksContext.Provider value={{ walks, isLoading, error, refreshWalks }}>{children}</WalksContext.Provider>;
}
export function useWalksContext() {
  const context = useContext(WalksContext);
  if (!context) throw new Error("useWalksContext must be used within WalksProvider");
  return context;
}
