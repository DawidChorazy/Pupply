import { ActionCard } from "@/features/home/components/ActionCard";
import { DogsCard } from "@/features/pets/components/DogsCard";
import { Header } from "@/features/home/components/Header";
import { WalksCard } from "@/features/walks/components/WalksCard";

import { BottomMenu } from "@/shared/navigation/BottomMenu";
import { usePetsList } from "@/features/pets/hooks/usePetsList";
import { useWalksList } from "@/features/walks/hooks/useWalksList";
import { router } from "expo-router";
import { useState} from "react";
import { ScrollView, StyleSheet, View, Text, TouchableOpacity } from "react-native";

export default function HomeScreen() {
  const { pets, isLoading, error } = usePetsList();
  const { walks, error: walksError, refreshWalks } = useWalksList();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const openCaregivers = () => router.push("/marketplace/sitters" as never);

  return (
    <View style={styles.shell}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <View style={styles.quickActionsRow}>
          <ActionCard
            title="Znajdź opiekę"
            description="Sprawdzeni petsitterzy w okolicy"
            buttonText="Szukaj"
            color="#D35400"
            iconName="magnify"
            onPress={openCaregivers}
          />

          <ActionCard
            title="Zostań opiekunem"
            description="Spaceruj ze zwierzakami i zarabiaj"
            buttonText="Dołącz"
            color="#1E9B5A"
            iconName="walk"
            onPress={() => router.push("/marketplace/sitter-profile" as never)}
          />
        </View>

        <DogsCard
          pets={pets}
          isLoading={isLoading}
          error={error}
          onAddDog={() => router.push("/pets/add")}
          onOpenPet={(petId) => router.push({ pathname: "/pets/[id]", params: { id: petId } })}
        />

        {walksError ? <TouchableOpacity onPress={() => void refreshWalks()}><Text>{walksError} · Spróbuj ponownie</Text></TouchableOpacity> : null}
        <WalksCard
          walks={walks}
          onBookWalk={openCaregivers}
          onOpenWalk={(walkId) => router.push({ pathname: "/walks/[id]", params: { id: walkId } })}
        />
      </ScrollView>

      <BottomMenu activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22
  },
  shell: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  }
});
