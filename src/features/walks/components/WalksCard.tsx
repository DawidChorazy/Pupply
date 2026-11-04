import { UpcomingWalk } from "@/features/walks/types/walks";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { TouchableOpacity, View, Platform, StyleSheet } from "react-native";

type WalksCardProps = {
  walks?: UpcomingWalk[];
  onBookWalk?: () => void;
  onOpenWalk?: (walkId: string) => void;
};

const labels = { REQUESTED: "Oczekuje", ACCEPTED: "Zaakceptowany", REJECTED: "Odrzucony", CANCELLED: "Anulowany", COMPLETED: "Zakończony", EXPIRED: "Wygasły" };
function getStatusBadgeLabel(walk: UpcomingWalk) { return labels[walk.bookingStatus]; }
function getStatusBadgeStyle(walk: UpcomingWalk) {
  return walk.bookingStatus === "COMPLETED" ? styles.walkStatusBadgeCompleted : styles.walkStatusBadge;
}

export function WalksCard({ walks = [], onBookWalk, onOpenWalk }: WalksCardProps) {
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
              <TouchableOpacity
                key={walk.id}
                style={[styles.walkRow, index === walks.length - 1 && styles.walkRowLast]}
                activeOpacity={0.85}
                onPress={() => onOpenWalk?.(walk.id)}
              >
                <View style={styles.walksIconCircleSmall}>
                  <MaterialCommunityIcons name="walk" size={22} color="#D35400" />
                </View>

                <View style={styles.walkInfo}>
                  <Text style={styles.walkTitle}>
                    {walk.petName} z {walk.caregiverName}
                  </Text>
                  <Text style={styles.walkMeta}>
                    {walk.time} · {walk.durationLabel} · {walk.price} zł
                  </Text>
                </View>

                <View style={getStatusBadgeStyle(walk)}>
                  <Text style={styles.walkStatusText}>{getStatusBadgeLabel(walk)}</Text>
                </View>
              </TouchableOpacity>
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

const raisedShadow = Platform.select({
  web: {
    boxShadow: "0 8px 14px rgba(107, 58, 24, 0.06)"
  },
  default: {
    shadowColor: "#6B3A18",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  }
});

const styles = StyleSheet.create({
  walkStatusBadgeCompleted: {
    borderRadius: 999,
    backgroundColor: "#F4F3FF",
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#D9D6FE"
  },
  walkStatusBadge: {
    borderRadius: 999,
    backgroundColor: "#FFF8F0",
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#F2E4D8"
  },
  section: {
    marginBottom: 22
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  sectionTitle: {
    color: "#3D2415",
    fontSize: 18,
    fontWeight: "800"
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  walksList: {
    gap: 10
  },
  walkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E4D8",
    gap: 10
  },
  walkRowLast: {
    borderBottomWidth: 0
  },
  walksIconCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  walkInfo: {
    flex: 1
  },
  walkTitle: {
    color: "#3D2415",
    fontSize: 14,
    fontWeight: "800"
  },
  walkMeta: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 2
  },
  walkStatusText: {
    color: "#067647",
    fontSize: 11,
    fontWeight: "800"
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#D35400"
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },
  walksEmptyContent: {
    minHeight: 148,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10
  },
  walksIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  emptyTitle: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 5
  },
  emptySubtitle: {
    color: "#8A6D5B",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  }
});
