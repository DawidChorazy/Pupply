import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { ActionCard } from "@/components/main-screen/ActionCard";
import { DogsCard } from "@/components/main-screen/DogsCard";
import { Header } from "@/components/main-screen/Header";
import { WalksCard } from "@/components/main-screen/WalksCard";
import { styles } from "@/styles/main-screen";

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
          onPress={() => router.push("/marketplace/sitters" as never)}
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

      <DogsCard onAddDog={() => router.push("../mainScreen/AddDogScreen")} />

      <WalksCard
        onBookWalk={() => router.push("/marketplace/sitters" as never)}
        onOpenBookings={() => router.push("/marketplace/bookings" as never)}
      />
    </ScrollView>
  );
}
