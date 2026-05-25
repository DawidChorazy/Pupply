import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { ActionCard } from "@/features/home/components/ActionCard";
import { DogsCard } from "@/features/home/components/DogsCard";
import { Header } from "@/features/home/components/Header";
import { WalksCard } from "@/features/home/components/WalksCard";
import { styles } from "@/features/home/styles";
import { usePetsList } from "@/features/pets/usePetsList";

export default function MainScreen() {
  const { pets, isLoading, error } = usePetsList();

  return (
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
        />

        <ActionCard
          title="Zostań opiekunem"
          description="Spaceruj ze zwierzakami i zarabiaj"
          buttonText="Dołącz"
          color="#1E9B5A"
          iconName="walk"
        />
      </View>

      <DogsCard
        pets={pets}
        isLoading={isLoading}
        error={error}
        onAddDog={() => router.push("../mainScreen/AddDogScreen")}
        onOpenPet={(petId) => router.push(`../mainScreen/pets/${petId}`)}
      />

      <WalksCard />
    </ScrollView>
  );
}
