import { BottomMenu } from "@/features/navigation/BottomMenu";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { ScrollView, StyleSheet, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={styles.shell}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account-heart-outline" size={36} color="#D35400" />
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Profil</Text>
            <Text style={styles.title}>Twój profil</Text>
            <Text style={styles.subtitle}>Dane konta i szybki podgląd aktywności.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Konto</Text>
          <View style={styles.row}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#D35400" />
            <Text style={styles.rowText}>user@pupply.local</Text>
          </View>
          <View style={styles.row}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#D35400" />
            <Text style={styles.rowText}>Zweryfikowany opiekun pupila</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>pupile</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>spacery</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>860</Text>
            <Text style={styles.statLabel}>pkt</Text>
          </View>
        </View>
      </ScrollView>

      <BottomMenu activeTab="profile" />
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
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
    paddingBottom: 22
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: {
    flex: 1
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  cardTitle: {
    color: "#3D2415",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12
  },
  row: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowText: {
    color: "#6F5648",
    fontSize: 14,
    fontWeight: "700"
  },
  statsRow: {
    flexDirection: "row",
    gap: 10
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    alignItems: "center"
  },
  statValue: {
    color: "#D35400",
    fontSize: 24,
    fontWeight: "900"
  },
  statLabel: {
    color: "#8A6D5B",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  }
});
