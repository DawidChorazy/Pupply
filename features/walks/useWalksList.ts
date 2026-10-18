import { useWalksContext } from "@/features/walks/WalksContext";
import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback } from "react";

export function useWalksList() {
  const { walks, isLoading, refreshWalks, error } = useWalksContext();

  useFocusEffect(
    useCallback(() => {
      void refreshWalks();
    }, [refreshWalks])
  );

  return {
    walks,
    isLoading,
    refreshWalks,
    error
  };
}
