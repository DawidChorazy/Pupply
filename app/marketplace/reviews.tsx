import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RatingSummary } from "@/features/reviews/components/RatingSummary";
import { ReviewDetails } from "@/features/reviews/components/ReviewDetails";
import { listSitterReviews } from "@/features/reviews/services/reviews-service";
import { ReviewsPage } from "@/features/reviews/types/reviews";

export default function ReviewsScreen() {
  const { sitterId } = useLocalSearchParams<{ sitterId?: string }>();
  return typeof sitterId === "string" && sitterId.length > 0 && sitterId.length <= 100 ? <ReviewsList key={sitterId} profileId={sitterId} />
    : <SafeAreaView style={styles.shell}><Text style={styles.error}>Wybierz opiekuna, aby zobaczyć opinie.</Text></SafeAreaView>;
}
function ReviewsList({ profileId }: { profileId: string }) {
  const [page, setPage] = useState<ReviewsPage | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0), busy = useRef(false);
  const load = useCallback(async () => {
    const started = ++generation.current; setLoading(true); setError("");
    try { const result = await listSitterReviews(profileId); if (started === generation.current) setPage(result); }
    catch (e) { if (started === generation.current) setError(e instanceof Error ? e.message : "Nie udało się pobrać opinii."); }
    finally { if (started === generation.current) setLoading(false); }
  }, [profileId]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current += 1; busy.current = false; setLoadingMore(false); }; }, [load]));
  const more = async () => {
    if (!page?.nextCursor || busy.current) return;
    const started = generation.current; busy.current = true; setLoadingMore(true);
    try {
      const result = await listSitterReviews(profileId, page.nextCursor);
      if (started !== generation.current) return;
      setPage(current => current ? { ...result, items: [...new Map([...current.items, ...result.items].map(item => [item.id, item])).values()] } : result);
      setError("");
    } catch (e) { if (started === generation.current) setError(e instanceof Error ? e.message : "Nie udało się pobrać kolejnej strony."); }
    finally { if (started === generation.current) { busy.current = false; setLoadingMore(false); } }
  };
  const summary = page?.summary;
  return <SafeAreaView style={styles.shell}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Wróć" onPress={() => router.canGoBack() ? router.back() : router.replace("/marketplace/sitters")}><MaterialCommunityIcons name="arrow-left" size={26} color="#3D2415" /></TouchableOpacity><Text style={styles.title}>Opinie o spacerowiczu</Text></View>
    {loading ? <ActivityIndicator color="#D35400" /> : null}
    {error ? <View><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void load()}><Text style={styles.link}>Spróbuj ponownie</Text></TouchableOpacity></View> : null}
    {page ? <>
      <View style={styles.card}><View style={styles.row}>{page.sitter.photoUrl ? <Image source={{ uri: page.sitter.photoUrl }} style={styles.avatar} /> : null}<View style={styles.flex}><Text style={styles.name}>{page.sitter.displayName}</Text><Text style={styles.muted}>{page.sitter.city}</Text></View></View>
        <RatingSummary summary={summary} /><Text style={styles.muted}>Zakończone spacery: {summary?.completedWalkCount ?? 0}</Text>
        {summary?.reviewCount ? <Text style={styles.muted}>Punktualność: {summary.averagePunctuality?.toFixed(2)}/5 · Kontakt: {summary.averageCommunication?.toFixed(2)}/5 · Jakość: {summary.averageQuality?.toFixed(2)}/5</Text> : null}
        <Text style={styles.muted}>Oceny pochodzą od właścicieli zakończonych spacerów w aplikacji.</Text>
      </View>
      {!page.items.length ? <View style={styles.card}><Text style={styles.muted}>Ten opiekun nie ma jeszcze opinii.</Text></View> : null}
      {page.items.map(review => <View key={review.id} style={styles.card}><View style={styles.row}><Text style={[styles.name, styles.flex]}>{review.authorName}</Text><Text style={styles.muted}>{new Date(review.createdAt).toLocaleDateString("pl-PL")}</Text></View><ReviewDetails review={review} /></View>)}
      {page.nextCursor ? <TouchableOpacity accessibilityRole="button" disabled={loadingMore} onPress={() => void more()}><Text style={styles.link}>{loadingMore ? "Ładowanie…" : "Wczytaj starsze opinie"}</Text></TouchableOpacity> : null}
    </> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ shell: { flex: 1, backgroundColor: "#FFF8F0" }, content: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }, title: { color: "#3D2415", fontSize: 23, fontWeight: "800", flex: 1 },
  card: { backgroundColor: "#FFFFFF", padding: 18, borderWidth: 1, borderColor: "#F2E4D8", borderRadius: 18, marginBottom: 14, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 }, flex: { flex: 1 }, avatar: { width: 52, height: 52, borderRadius: 18 },
  name: { color: "#3D2415", fontSize: 17, fontWeight: "700" }, muted: { color: "#8A6D5B", fontSize: 13, lineHeight: 20 },
  error: { color: "#B42318", paddingVertical: 12 }, link: { color: "#D35400", textAlign: "center", fontWeight: "700", padding: 16 }
});
