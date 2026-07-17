import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

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
