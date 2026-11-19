import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getBooking } from "@/features/marketplace/services/bookings-service";
import { Booking } from "@/features/marketplace/types/marketplace";
import { createReview } from "@/features/reviews/services/reviews-service";
import { ReviewDetails } from "@/features/reviews/components/ReviewDetails";
import { ApiError } from "@/shared/api/api-client";
import { getAccountId } from "@/shared/session/auth-storage";
import { getSessionRevision, subscribeSessionChanged } from "@/shared/session/session-events";

const back = () => router.canGoBack() ? router.back() : router.replace("/marketplace/bookings");
export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  return typeof bookingId === "string" && bookingId.length > 0 && bookingId.length <= 100
    ? <ReviewForm key={bookingId} bookingId={bookingId} />
    : <SafeAreaView style={styles.shell}><Text style={styles.error}>Wybierz spacer w „Moje rezerwacje”.</Text><TouchableOpacity accessibilityRole="button" onPress={back}><Text style={styles.link}>Wróć</Text></TouchableOpacity></SafeAreaView>;
}

function ReviewForm({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<Booking | null>(null), [accountId, setAccountId] = useState<string | null>(null);
  const [scores, setScores] = useState({ punctuality: 0, communication: 0, quality: 0 });
  const [comment, setComment] = useState(""), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);
  const generation = useRef(0), busy = useRef(false), controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    const started = ++generation.current, revision = getSessionRevision();
    setLoading(true); setError("");
    try {
      const [result, mine] = await Promise.all([getBooking(bookingId), getAccountId()]);
      if (started !== generation.current || revision !== getSessionRevision()) return;
      setBooking(result.booking); setAccountId(mine); setLoadedAt(Date.now());
    } catch (e) {
      if (started !== generation.current || revision !== getSessionRevision()) return;
      if (e instanceof ApiError && e.status === 401) router.replace("/");
      else setError(e instanceof Error ? e.message : "Nie udało się pobrać spaceru.");
    } finally { if (started === generation.current && revision === getSessionRevision()) setLoading(false); }
  }, [bookingId]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current += 1; controller.current?.abort(); busy.current = false; setSaving(false); }; }, [load]));
  useEffect(() => subscribeSessionChanged(() => { generation.current += 1; controller.current?.abort(); setBooking(null); setComment(""); setScores({ punctuality: 0, communication: 0, quality: 0 }); router.replace("/"); }), []);
  const canReview = booking?.ownerAccountId === accountId && booking?.status === "COMPLETED" && booking?.sitterService.type === "DOG_WALK" && Date.parse(booking.endsAt) <= loadedAt;
  const complete = Object.values(scores).every(score => score >= 1 && score <= 5);
  const save = async () => {
    if (!canReview || !complete || busy.current) return;
    busy.current = true; setSaving(true); setError("");
    const started = generation.current, revision = getSessionRevision();
    const active = () => started === generation.current && revision === getSessionRevision();
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 20000);
    try {
      const response = await createReview(bookingId, { ...scores, comment: comment.trim() }, abort.signal);
      if (active()) { setBooking(current => current ? { ...current, review: response.review } : current); setSuccess("Opublikowano ocenę spacerowicza."); }
    } catch (e) {
      if (!active()) return;
      if (e instanceof ApiError && e.code === "REVIEW_ALREADY_EXISTS") {
        await load(); if (revision === getSessionRevision()) setSuccess("Ten spacer ma już zapisaną ocenę.");
      } else if (e instanceof ApiError && e.status === 401) router.replace("/");
      else setError(e instanceof ApiError ? e.message : "Nie udało się potwierdzić zapisu. Możesz bezpiecznie ponowić publikację.");
    } finally { clearTimeout(timer); busy.current = false; controller.current = null; if (revision === getSessionRevision()) setSaving(false); }
  };
  return <SafeAreaView style={styles.shell}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Wróć do rezerwacji" onPress={back}><MaterialCommunityIcons name="arrow-left" size={26} color="#3D2415" /></TouchableOpacity><Text style={styles.title}>Ocena spacerowicza</Text></View>
    {loading ? <ActivityIndicator color="#D35400" /> : null}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    {success ? <Text style={styles.success} accessibilityLiveRegion="polite">{success}</Text> : null}
    {booking ? <View style={styles.card}>
      <Text style={styles.name}>{booking.sitter.userProfile?.fullName ?? "Opiekun Pupply"}</Text><Text style={styles.muted}>{booking.pet.name} · {new Date(booking.startsAt).toLocaleString("pl-PL")}</Text>
      {booking.review ? <><Text style={styles.label}>Zapisana ocena</Text><ReviewDetails review={booking.review} /><Text style={styles.muted}>Ten spacer został już oceniony. Ocena jest publiczna.</Text></> : canReview ? <>
        <Text style={styles.muted}>Oceń każde kryterium od 1 do 5. Wystawienie oceny jest dobrowolne.</Text>
        {([["punctuality", "Punktualność"], ["communication", "Kontakt"], ["quality", "Jakość spaceru"]] as const).map(([key, label]) => <View key={key} style={styles.criterion}>
          <Text style={styles.label}>{label}</Text><View style={styles.stars}>{[1, 2, 3, 4, 5].map(score => <TouchableOpacity key={score} accessibilityRole="button" accessibilityLabel={`${label}: ${score} z 5`} accessibilityState={{ selected: scores[key] === score }} disabled={saving} onPress={() => setScores(current => ({ ...current, [key]: score }))} style={styles.star}>
            <MaterialCommunityIcons name={score <= scores[key] ? "star" : "star-outline"} size={34} color="#B56A00" />
          </TouchableOpacity>)}</View>
        </View>)}
        <Text style={styles.label}>Opinia publiczna (opcjonalnie)</Text>
        <TextInput accessibilityLabel="Opinia publiczna" multiline maxLength={2000} value={comment} onChangeText={setComment} editable={!saving} style={styles.input} placeholder="Jak przebiegł spacer?" placeholderTextColor="#8A6D5B" />
        <Text style={styles.muted}>{comment.length}/2000 · Opinię będą mogli przeczytać inni użytkownicy.</Text>
        <Text style={styles.average}>{complete ? `Średnia: ${((scores.punctuality + scores.communication + scores.quality) / 3).toFixed(2).replace(".", ",")}/5` : "Wybierz ocenę w każdym z trzech kryteriów."}</Text>
        <TouchableOpacity accessibilityRole="button" style={[styles.button, (!complete || saving) && styles.disabled]} disabled={!complete || saving} onPress={() => void save()}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Opublikuj ocenę</Text>}</TouchableOpacity>
      </> : <Text style={styles.muted}>Ocenę może wystawić właściciel po zakończeniu spaceru.</Text>}
    </View> : !loading ? <TouchableOpacity accessibilityRole="button" onPress={() => void load()}><Text style={styles.link}>Spróbuj ponownie</Text></TouchableOpacity> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FFF8F0" }, content: { padding: 18, paddingBottom: 40 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  title: { fontSize: 23, fontWeight: "800", color: "#3D2415", flex: 1 }, card: { padding: 18, borderWidth: 1, borderColor: "#F2E4D8", backgroundColor: "#FFFFFF", borderRadius: 20, gap: 10 },
  name: { color: "#3D2415", fontSize: 19, fontWeight: "700" }, muted: { color: "#8A6D5B", fontSize: 13, lineHeight: 20 }, label: { color: "#6F5648", fontSize: 15, fontWeight: "700", marginTop: 8 },
  criterion: { gap: 5 }, stars: { flexDirection: "row", gap: 5 }, star: { padding: 4, minWidth: 42, minHeight: 44, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 110, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E8D8CB", color: "#3D2415", fontSize: 16, textAlignVertical: "top" },
  average: { color: "#7A3B12", fontWeight: "700", marginVertical: 6 }, button: { backgroundColor: "#D35400", minHeight: 48, padding: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 }, disabled: { opacity: 0.45 }, error: { color: "#B42318", paddingVertical: 12 }, success: { color: "#13713B", paddingVertical: 12 }, link: { color: "#D35400", padding: 16, textAlign: "center", fontWeight: "700" }
});
