import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

type WalksCardProps = {
  onBookWalk?: () => void;
};

export function WalksCard({ onBookWalk }: WalksCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#D35400" />
          <Text style={styles.sectionTitle}>Najbliższe spacery</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.walksEmptyContent}>
          <View style={styles.walksIconCircle}>
            <MaterialCommunityIcons name="clock-outline" size={30} color="#D35400" />
          </View>

          <Text style={styles.emptyTitle}>Brak spacerów w planie</Text>
          <Text style={styles.emptySubtitle}>Umów spacer, kiedy tylko będzie potrzebny.</Text>

          <TouchableOpacity style={styles.secondaryButton} onPress={onBookWalk}>
            <Text style={styles.secondaryButtonText}>Umów spacer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
