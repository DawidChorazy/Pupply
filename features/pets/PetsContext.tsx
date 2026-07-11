import { ApiError } from "@/services/api-client";
import { getAccessToken } from "@/services/auth-storage";
import { loadLocalPets, saveLocalPets } from "@/services/local-pets-storage";
import { listPets } from "@/services/pets-service";
import { Pet } from "@/types/pets";
import { ReactNode, createContext, useCallback, useContext, useState } from "react";

type PetsContextValue = {
  pets: Pet[];
  isLoading: boolean;
  error: string;
  isLocalMode: boolean;
  refreshPets: () => Promise<void>;
  addPet: (pet: Pet) => void;
  updatePetInList: (pet: Pet) => void;
};

const PetsContext = createContext<PetsContextValue | null>(null);

async function persistLocalPetsIfNeeded(pets: Pet[]) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    await saveLocalPets(pets);
  }
}

export function PetsProvider({ children }: { children: ReactNode }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLocalMode, setIsLocalMode] = useState(false);

  const refreshPets = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        const localPets = await loadLocalPets();
        setPets(localPets);
        setIsLocalMode(true);
        return;
      }

      setIsLocalMode(false);
      const response = await listPets(accessToken);
      setPets(response.pets);
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || "Nie udalo sie pobrac zwierzakow");
      } else {
        setError("Nie udalo sie pobrac zwierzakow");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addPet = useCallback((pet: Pet) => {
    setPets((currentPets) => {
      if (currentPets.some((existingPet) => existingPet.id === pet.id)) {
        return currentPets;
      }

      const nextPets = [...currentPets, pet];
      void persistLocalPetsIfNeeded(nextPets);
      return nextPets;
    });
  }, []);

  const updatePetInList = useCallback((pet: Pet) => {
    setPets((currentPets) => {
      const nextPets = currentPets.map((existingPet) => (existingPet.id === pet.id ? pet : existingPet));
      void persistLocalPetsIfNeeded(nextPets);
      return nextPets;
    });
  }, []);

  return (
    <PetsContext.Provider value={{ pets, isLoading, error, isLocalMode, refreshPets, addPet, updatePetInList }}>
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
