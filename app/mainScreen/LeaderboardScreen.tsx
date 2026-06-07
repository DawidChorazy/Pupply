import { useGamification } from "@/features/gamification/GamificationContext";
import { BottomMenu } from "@/features/navigation/BottomMenu";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { ScrollView, StyleSheet, View } from "react-native";

export default function LeaderboardScreen() {
  const { leaderboard, userPoints } = useGamification();

  return (
    <View style={styles.shell}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Leaderboard</Text>
          <Text style={styles.title}>Ranking punktów</Text>
          <Text style={styles.subtitle}>Punkty z questów wpływają na Twoje miejsce w rankingu.</Text>
        </View>

        <View style={styles.pointsCard}>
          <MaterialCommunityIcons name="star-four-points-outline" size={28} color="#D35400" />
          <View>
            <Text style={styles.pointsLabel}>Twoje punkty</Text>
            <Text style={styles.pointsValue}>{userPoints} pkt</Text>
          </View>
        </View>

        <View style={styles.list}>
          {leaderboard.map((user, index) => {
            const isCurrentUser = user.id === "current-user";

            return (
              <View key={user.id} style={[styles.rankRow, isCurrentUser && styles.rankRowCurrent]}>
                <View style={[styles.rankBadge, index < 3 && styles.rankBadgeTop]}>
                  <Text style={[styles.rankNumber, index < 3 && styles.rankNumberTop]}>{index + 1}</Text>
                </View>

                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{user.name}</Text>
                  <Text style={styles.rankBadgeText}>{user.badge}</Text>
                </View>

                <Text style={styles.rankPoints}>{user.points}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <BottomMenu activeTab="leaderboard" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 28
  },
  header: {
    paddingTop: 8,
    paddingBottom: 18
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4
  },
  pointsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14
  },
  pointsLabel: {
    color: "#8A6D5B",
    fontSize: 12,
    fontWeight: "800"
  },
  pointsValue: {
    color: "#3D2415",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2
  },
  list: {
    gap: 10
  },
  rankRow: {
    minHeight: 68,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  rankRowCurrent: {
    borderColor: "#D35400",
    backgroundColor: "#FFF8F0"
  },
  rankBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F7E7D7",
    alignItems: "center",
    justifyContent: "center"
  },
  rankBadgeTop: {
    backgroundColor: "#D35400"
  },
  rankNumber: {
    color: "#8A6D5B",
    fontSize: 14,
    fontWeight: "900"
  },
  rankNumberTop: {
    color: "#FFFFFF"
  },
  rankInfo: {
    flex: 1
  },
  rankName: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "900"
  },
  rankBadgeText: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 2
  },
  rankPoints: {
    color: "#D35400",
    fontSize: 16,
    fontWeight: "900"
  }
});
