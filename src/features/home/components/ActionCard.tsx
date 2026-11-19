import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { TouchableOpacity, View, Platform, StyleSheet } from "react-native";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type ActionCardProps = {
  title: string;
  description: string;
  buttonText: string;
  color: string;
  iconName?: IconName;
  onPress?: () => void;
};

export function ActionCard({
  title,
  description,
  buttonText,
  color,
  iconName = "paw",
  onPress,
}: ActionCardProps) {
  return (
    <TouchableOpacity style={styles.actionCard} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.actionIconBox, { backgroundColor: `${color}18` }]}>
        <MaterialCommunityIcons name={iconName} size={24} color={color} />
      </View>

      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>

      <View style={styles.actionFooter}>
        <Text style={[styles.actionText, { color }]}>{buttonText}</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={color} />
      </View>
    </TouchableOpacity>
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
  actionCard: {
    flex: 1,
    minHeight: 164,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  actionTitle: {
    color: "#3D2415",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6
  },
  actionDescription: {
    color: "#8A6D5B",
    fontSize: 12,
    lineHeight: 17,
    flex: 1
  },
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12
  },
  actionText: {
    fontSize: 13,
    fontWeight: "800"
  }
});
