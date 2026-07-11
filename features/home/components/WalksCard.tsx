import { UpcomingWalk } from "@/features/walks/mockData";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { TouchableOpacity, View } from "react-native";

import { styles } from "../styles";

type WalksCardProps = {
  walks?: UpcomingWalk[];
  onBookWalk?: () => void;
};

export function WalksCard({ walks = [], onBookWalk }: WalksCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#D35400" />
          <Text style={styles.sectionTitle}>Najbliższe spacery</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        {walks.length ? (
          <View style={styles.walksList}>
            {walks.map((walk, index) => (
              <View key={walk.id} style={[styles.walkRow, index === walks.length - 1 && styles.walkRowLast]}>
                <View style={styles.walksIconCircleSmall}>
                  <MaterialCommunityIcons name="walk" size={22} color="#D35400" />
                </View>

                <View style={styles.walkInfo}>
                  <Text style={styles.walkTitle}>
                    {walk.petName} z {walk.caregiverName}
                  </Text>
                  <Text style={styles.walkMeta}>{walk.time}</Text>
                </View>

                <View style={styles.walkStatusBadge}>
                  <Text style={styles.walkStatusText}>{walk.status === "confirmed" ? "Aktywny" : "Oczekuje"}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.secondaryButton} onPress={onBookWalk}>
              <Text style={styles.secondaryButtonText}>Umów kolejny spacer</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}
      </View>
    </View>
  );
}
