import { getSessionRevision, subscribeSessionChanged } from "@/services/session-events";
import { ApiError } from "@/services/api-client";
import { getAccessToken } from "@/services/auth-storage";
import { loadLocalPets, saveLocalPets } from "@/services/local-pets-storage";
import { listPets } from "@/services/pets-service";
import { Pet } from "@/types/pets";
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type PetsContextValue = {
  pets: Pet[];
  isLoading: boolean;
  error: string;
  isLocalMode: boolean;
  authRequired: boolean;
  removePetFromList: (id: string) => void;
  refreshPets: () => Promise<void>;
  addPet: (pet: Pet) => void;
  updatePetInList: (pet: Pet) => void;
};

const PetsContext = createContext<PetsContextValue | null>(null);

async function persistLocalPetsIfNeeded(pets: Pet[]) {
  const revision = getSessionRevision();
  const accessToken = await getAccessToken();

  if (revision === getSessionRevision() && !accessToken) {
    await saveLocalPets(pets);
  }
}

export function PetsProvider({ children }: { children: ReactNode }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const requestId = useRef(0);
  useEffect(() => subscribeSessionChanged(() => {
    requestId.current += 1;
    setPets([]);
    setError("");
    setIsLoading(false);
    setAuthRequired(false);
    setIsLocalMode(false);
  }), []);

  const refreshPets = useCallback(async () => {
    const request = ++requestId.current;
    const revision = getSessionRevision();
    const active = () => request === requestId.current && revision === getSessionRevision();
    setIsLoading(true);
    setAuthRequired(false);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        const localPets = await loadLocalPets();
        if (!active()) return;
        setPets(localPets);
        setIsLocalMode(true);
        return;
      }

      if (!active()) return;
      setIsLocalMode(false);
      const response = await listPets(accessToken);
      if (active()) setPets(response.pets);
    } catch (requestError) {
      if (!active()) return;
      if (requestError instanceof ApiError && requestError.status === 401) { setPets([]); setAuthRequired(true); }
      if (requestError instanceof ApiError) {
        setError(requestError.message || "Nie udalo sie pobrac zwierzakow");
      } else {
        setError("Nie udalo sie pobrac zwierzakow");
      }
    } finally {
      if (active()) setIsLoading(false);
    }
  }, []);

  const invalidatePendingList = useCallback(() => {
    requestId.current += 1;
    setIsLoading(false);
    setError("");
  }, []);

  const addPet = useCallback((pet: Pet) => {
    invalidatePendingList();
    setPets((currentPets) => {
      if (currentPets.some((existingPet) => existingPet.id === pet.id)) {
        return currentPets;
      }

      const nextPets = [...currentPets, pet];
      void persistLocalPetsIfNeeded(nextPets);
      return nextPets;
    });
  }, [invalidatePendingList]);

  const updatePetInList = useCallback((pet: Pet) => {
    invalidatePendingList();
    setPets((currentPets) => {
      const nextPets = currentPets.map((existingPet) => (existingPet.id === pet.id ? pet : existingPet));
      void persistLocalPetsIfNeeded(nextPets);
      return nextPets;
    });
  }, [invalidatePendingList]);

  const removePetFromList = useCallback((id: string) => {
    invalidatePendingList();
    setPets((items) => items.filter((pet) => pet.id !== id));
  }, [invalidatePendingList]);

  return (
    <PetsContext.Provider value={{ pets, isLoading, error, isLocalMode, authRequired, refreshPets, addPet, updatePetInList, removePetFromList }}>
      {children}
    </PetsContext.Provider>
  );
}

export function usePetsContext() {
  const context = useContext(PetsContext);

  if (!context) {
    throw new Error("usePetsContext must be used within PetsProvider");
  }

  return context;
}
