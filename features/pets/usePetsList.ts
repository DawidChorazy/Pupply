import { usePetsContext } from "@/features/pets/PetsContext";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

export function usePetsList() {
  const { pets, isLoading, error, refreshPets } = usePetsContext();

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
