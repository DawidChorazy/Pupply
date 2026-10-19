import { ActionCard } from "@/features/home/components/ActionCard";
import { DogsCard } from "@/features/home/components/DogsCard";
import { Header } from "@/features/home/components/Header";
import { WalksCard } from "@/features/home/components/WalksCard";
import { styles } from "@/features/home/styles";
import { BottomMenu } from "@/features/navigation/BottomMenu";
import { usePetsList } from "@/features/pets/usePetsList";
import { useWalksList } from "@/features/walks/useWalksList";
import { router } from "expo-router";
import { useState} from "react";
import { ScrollView, StyleSheet, View, Text, TouchableOpacity } from "react-native";

export default function MainScreen() {
  const { pets, isLoading, error } = usePetsList();
  const { walks, error: walksError, refreshWalks } = useWalksList();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const openCaregivers = () => router.push("/marketplace/sitters" as never);

  return (
    <View style={screenStyles.shell}>
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

        <TouchableOpacity style={screenStyles.scheduleLink} accessibilityRole="button" onPress={() => router.push("/marketplace/schedule" as never)}>
          <Text style={screenStyles.scheduleTitle}>Mój grafik</Text><Text style={screenStyles.scheduleDescription}>Zarządzaj dostępnością i rezerwacjami →</Text>
        </TouchableOpacity>

        <DogsCard
          pets={pets}
          isLoading={isLoading}
          error={error}
          onAddDog={() => router.push("../mainScreen/AddDogScreen")}
          onOpenPet={(petId) => router.push(`../mainScreen/pets/${petId}`)}
        />

        {walksError ? <TouchableOpacity onPress={() => void refreshWalks()}><Text>{walksError} · Spróbuj ponownie</Text></TouchableOpacity> : null}
        <WalksCard
          walks={walks}
          onBookWalk={openCaregivers}
          onOpenWalk={(walkId) => router.push(`../mainScreen/walks/${walkId}`)}
        />
      </ScrollView>

      <BottomMenu activeTab="home" />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  scheduleLink: { borderWidth: 1, borderColor: "#F1DED0", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 4, marginBottom: 18 },
  scheduleTitle: { color: "#3D2415", fontSize: 16, fontWeight: "800" },
  scheduleDescription: { color: "#8A6D5B", fontSize: 13 },
  shell: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  }
});
