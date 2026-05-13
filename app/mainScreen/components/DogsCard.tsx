import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

type DogsCardProps = {
  onAddDog?: () => void;
};

export function DogsCard({ onAddDog }: DogsCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="dog" size={20} color="#D35400" />
          <Text style={styles.sectionTitle}>Moje zwierzaki</Text>
        </View>

        <TouchableOpacity onPress={onAddDog}>
          <Text style={styles.sectionAction}>Dodaj</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.emptyCard} onPress={onAddDog}>
        <View style={styles.emptyIllustration}>
          <MaterialCommunityIcons name="dog" size={40} color="#D35400" />
        </View>

        <Text style={styles.emptyTitle}>Dodaj pierwszego zwierzaka</Text>
        <Text style={styles.emptySubtitle}>Profil pomoże szybciej dobrać opiekę.</Text>
      </TouchableOpacity>
    </View>
  );
}
