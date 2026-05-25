import { ApiError } from "@/services/api-client";
import { getAccessToken } from "@/services/auth-storage";
import { listPets } from "@/services/pets-service";
import { Pet } from "@/types/pets";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";

export function usePetsList() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshPets = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setPets([]);
        setIsLoading(false);
        return;
      }

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

  useFocusEffect(
    useCallback(() => {
      void refreshPets();
    }, [refreshPets])
  );

  return {
    pets,
    isLoading,
    error,
    refreshPets
  };
}
