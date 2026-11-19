import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { ReviewSummary } from "../types/reviews";

export function RatingSummary({ summary }: { summary?: ReviewSummary }) {
  return <View style={styles.row}>
    <MaterialCommunityIcons name="star" size={19} color="#B56A00" />
    <Text style={styles.rating}>{summary?.reviewCount && summary.averageRating !== null ? `${summary.averageRating.toFixed(2).replace(".", ",")}/5 · Opinie: ${summary.reviewCount}` : "Brak ocen"}</Text>
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 5, marginVertical: 6 }, rating: { color: "#7A3B12", fontSize: 13, fontWeight: "700" } });
