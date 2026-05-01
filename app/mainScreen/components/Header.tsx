import { Text } from "@react-navigation/elements";
import { View } from "react-native";
import { styles } from '../styles';
export function Header() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>"Imię placeholder"</Text>
        <Text style={styles.subtitle}>Witaj spowrotem!</Text>
      </View>

      <View style={styles.icons}>
        <Text>"Dzwoneczek placeholder"</Text>
      </View>
    </View>
  );
}