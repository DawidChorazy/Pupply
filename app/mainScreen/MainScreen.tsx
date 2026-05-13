import { ScrollView, View } from "react-native";
import { ActionCard } from "./components/ActionCard";
import { DogsCard } from "./components/DogsCard";
import { Header } from "./components/Header";
import { WalksCard } from "./components/WalksCard";
import { styles } from "./styles";

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
          title="Znajdz opieke"
          description="Sprawdzeni petsitterzy w okolicy"
          buttonText="Szukaj"
          color="#D35400"
          iconName="magnify"
        />

        <ActionCard
          title="Zostan opiekunem"
          description="Spaceruj ze zwierzakami i zarabiaj"
          buttonText="Dolacz"
          color="#1E9B5A"
          iconName="walk"
        />
      </View>

      <DogsCard />

      <WalksCard />
    </ScrollView>
  );
}
