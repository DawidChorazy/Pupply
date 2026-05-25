import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { ActionCard } from "@/features/mainScreen/components/ActionCard";
import { DogsCard } from "@/features/mainScreen/components/DogsCard";
import { Header } from "@/features/mainScreen/components/Header";
import { WalksCard } from "@/features/mainScreen/components/WalksCard";
import { styles } from "@/features/mainScreen/styles";

export default function MainScreen() {
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

      <DogsCard onAddDog={() => router.push("../mainScreen/AddDogScreen")} />

      <WalksCard />
    </ScrollView>
  );
}
