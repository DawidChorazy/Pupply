import { useWalksContext } from "@/features/walks/WalksContext";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

export function useWalksList() {
  const { walks, isLoading, refreshWalks, bookWalk } = useWalksContext();

  useFocusEffect(
    useCallback(() => {
      void refreshWalks();
    }, [refreshWalks])
  );

  return {
    walks,
    isLoading,
    refreshWalks,
    bookWalk
  };
}
