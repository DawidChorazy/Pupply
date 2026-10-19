import { usePetsContext } from "@/features/pets/PetsContext";
import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback } from "react";

export function usePetsList() {
  const { pets, isLoading, error, refreshPets, authRequired } = usePetsContext();

  useFocusEffect(
    useCallback(() => {
      void refreshPets();
    }, [refreshPets])
  );

  return {
    authRequired,
    pets,
    isLoading,
    error,
    refreshPets
  };
}
