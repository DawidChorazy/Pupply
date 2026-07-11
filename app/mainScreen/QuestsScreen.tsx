import { useGamification } from "@/features/gamification/GamificationContext";
import { BottomMenu } from "@/features/navigation/BottomMenu";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

export default function QuestsScreen() {
  const { quests, userPoints, claimQuest } = useGamification();

  return (
    <View style={styles.shell}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Questy</Text>
          <Text style={styles.title}>Zadania za punkty</Text>
          <Text style={styles.subtitle}>Zdobywaj punkty za opiekę, zdrowie i aktywność pupila.</Text>
        </View>

        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Aktualny wynik</Text>
          <Text style={styles.pointsValue}>{userPoints} pkt</Text>
        </View>

        <View style={styles.list}>
          {quests.map((quest) => {
            const isClaimed = quest.status === "claimed";
            const isLocked = quest.status === "locked";

            return (
              <View key={quest.id} style={[styles.questCard, isClaimed && styles.questCardClaimed]}>
                <View style={styles.questHeader}>
                  <View style={styles.questIcon}>
                    <MaterialCommunityIcons name={quest.icon} size={24} color="#D35400" />
                  </View>

                  <View style={styles.questCopy}>
                    <Text style={styles.questTitle}>{quest.title}</Text>
                    <Text style={styles.questDescription}>{quest.description}</Text>
                  </View>
                </View>

                <View style={styles.questFooter}>
                  <View style={styles.rewardPill}>
                    <MaterialCommunityIcons name="star-four-points-outline" size={15} color="#D35400" />
                    <Text style={styles.rewardText}>+{quest.points} pkt</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.claimButton,
                      isClaimed && styles.claimButtonClaimed,
                      isLocked && styles.claimButtonLocked
                    ]}
                    activeOpacity={0.85}
                    disabled={isClaimed || isLocked}
                    onPress={() => claimQuest(quest.id)}
                  >
                    <Text style={styles.claimButtonText}>
                      {isClaimed ? "Odebrane" : isLocked ? "Zablokowane" : "Odbierz"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <BottomMenu activeTab="quests" />
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
    backgroundColor: "#3D2415",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14
  },
  pointsLabel: {
    color: "#FFF0D2",
    fontSize: 12,
    fontWeight: "800"
  },
  pointsValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4
  },
  list: {
    gap: 12
  },
  questCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8"
  },
  questCardClaimed: {
    backgroundColor: "#F8FFF9",
    borderColor: "#ABEFC6"
  },
  questHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14
  },
  questIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  questCopy: {
    flex: 1
  },
  questTitle: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "900"
  },
  questDescription: {
    color: "#8A6D5B",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  questFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  rewardPill: {
    borderRadius: 999,
    backgroundColor: "#FFF0D2",
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  rewardText: {
    color: "#D35400",
    fontSize: 12,
    fontWeight: "900"
  },
  claimButton: {
    minHeight: 40,
    minWidth: 106,
    borderRadius: 12,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  claimButtonClaimed: {
    backgroundColor: "#067647"
  },
  claimButtonLocked: {
    backgroundColor: "#8A6D5B"
  },
  claimButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  }
});
