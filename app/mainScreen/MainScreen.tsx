import { ScrollView } from "react-native";
import { ActionCard } from "./components/ActionCard";
import { Header } from "./components/Header";
import { styles } from './styles';
export default function MainScreen() {
  return (
    <ScrollView style={styles.container}>
      <Header />

      <ActionCard
        title="Znajdź petsittera"
        description="Znajdź najlepszych w okolicy!"
        buttonText="Szukaj"
        color="#D35400"
      />

      <ActionCard
        title="Zostań petsitterem"
        description="Wyprowadzaj zwierzęta i zarabiaj!"
        buttonText="Zarejestruj"
        color="#1E9B5A"
      />

      {/* <DogsCard /> */}
    </ScrollView>
  );
}