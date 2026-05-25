import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { TouchableOpacity, View } from "react-native";
import { styles } from "../styles";

export function Header() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>Pupply</Text>
        <Text style={styles.title}>Cześć!</Text>
        <Text style={styles.subtitle}>Zaplanuj opiekę bez stresu.</Text>
      </View>

      <TouchableOpacity style={styles.headerIconButton}>
        <MaterialCommunityIcons name="bell-outline" size={22} color="#7A3B12" />
      </TouchableOpacity>
    </View>
  );
}
