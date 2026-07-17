import { ActionCard } from "@/features/home/components/ActionCard";
import { DogsCard } from "@/features/home/components/DogsCard";
import { Header } from "@/features/home/components/Header";
import { WalksCard } from "@/features/home/components/WalksCard";
import { styles } from "@/features/home/styles";
import { BottomMenu } from "@/features/navigation/BottomMenu";
import { usePetsList } from "@/features/pets/usePetsList";
import { useWalksList } from "@/features/walks/useWalksList";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

export default function MainScreen() {
  const { pets, isLoading, error } = usePetsList();
  const { walks } = useWalksList();
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

        <DogsCard
          pets={pets}
          isLoading={isLoading}
          error={error}
          onAddDog={() => router.push("../mainScreen/AddDogScreen")}
          onOpenPet={(petId) => router.push(`../mainScreen/pets/${petId}`)}
        />

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
  shell: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  }
});
