import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type BottomMenuTab = "home" | "profile" | "leaderboard" | "quests";

type BottomMenuItem = {
  key: BottomMenuTab;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  href: Href;
};

const menuItems: BottomMenuItem[] = [
  { key: "home", label: "Home", icon: "home-variant-outline", href: "/mainScreen/MainScreen" },
  { key: "profile", label: "Profil", icon: "account-circle-outline", href: "/mainScreen/ProfileScreen" },
  { key: "leaderboard", label: "Ranking", icon: "podium", href: "/mainScreen/LeaderboardScreen" },
  { key: "quests", label: "Questy", icon: "clipboard-check-outline", href: "/mainScreen/QuestsScreen" }
];

export function BottomMenu({ activeTab }: { activeTab: BottomMenuTab }) {
  return (
    <View style={styles.wrapper}>
      {menuItems.map((item) => {
        const isActive = activeTab === item.key;

        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.item, isActive && styles.itemActive]}
            activeOpacity={0.85}
            onPress={() => router.replace(item.href)}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={22}
              color={isActive ? "#D35400" : "#8A6D5B"}
            />
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: "#F2E4D8",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  item: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  itemActive: {
    backgroundColor: "#FFF0D2"
  },
  label: {
    color: "#8A6D5B",
    fontSize: 11,
    fontWeight: "800"
  },
  labelActive: {
    color: "#D35400"
  }
});
