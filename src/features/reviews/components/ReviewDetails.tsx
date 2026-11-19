import { StyleSheet, Text, View } from "react-native";
import { Review } from "../types/reviews";

export function ReviewDetails({ review }: { review: Review }) {
  const rating = (review.punctuality + review.communication + review.quality) / 3;
  return <View style={styles.box}>
    <Text style={styles.rating}>★ {rating.toFixed(2).replace(".", ",")}/5</Text>
    <Text style={styles.criteria}>Punktualność: {review.punctuality}/5 · Kontakt: {review.communication}/5 · Jakość: {review.quality}/5</Text>
    {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ box: { gap: 8, marginTop: 10 }, rating: { color: "#8A5100", fontSize: 18, fontWeight: "800" }, criteria: { color: "#6F5648", fontSize: 13, lineHeight: 20 }, comment: { color: "#3D2415", fontSize: 15, lineHeight: 22 } });
