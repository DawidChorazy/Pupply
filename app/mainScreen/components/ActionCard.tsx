import { Text } from "@react-navigation/elements";
import { TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

type ActionCardProps = {
  title: string;
  description: string;
  buttonText: string;
  color: string;
};

export function ActionCard({
  title,
  description,
  buttonText,
  color,
}: ActionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.icons}>🐾</Text>

      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{description}</Text>

      <TouchableOpacity style={[styles.button, { backgroundColor: color }]}>
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
}