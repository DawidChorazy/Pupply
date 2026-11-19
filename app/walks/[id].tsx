import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { getBooking } from "@/features/marketplace/services/bookings-service";
import { Booking } from "@/features/marketplace/types/marketplace";

const labels = { REQUESTED: "Oczekuje na akceptację", ACCEPTED: "Zaakceptowana", REJECTED: "Odrzucona", CANCELLED: "Anulowana", COMPLETED: "Zakończona", EXPIRED: "Wygasła" };
export default function WalkDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError(""); setBooking(null);
    try {
      const result = await getBooking(String(id));
      if (current === requestId.current) setBooking(result.booking);
    } catch (error) {
      if (current === requestId.current) setError(error instanceof Error ? error.message : "Nie udało się pobrać spaceru");
    } finally { if (current === requestId.current) setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current++; };
  }, [load]));
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <TouchableOpacity onPress={() => router.back()}><Text style={styles.secondaryButtonText}>Wróć</Text></TouchableOpacity>
    <Text style={styles.title}>Szczegóły rezerwacji</Text>
    {loading ? <ActivityIndicator /> : null}
    {error ? <TouchableOpacity onPress={() => void load()}><Text style={styles.statusError}>{error} · Spróbuj ponownie</Text></TouchableOpacity> : null}
    {booking ? <View style={styles.card}>
      <Text style={styles.cardTitle}>{booking.pet.name} z {booking.sitter.userProfile?.fullName ?? "opiekunem"}</Text>
      <Text style={styles.body}>{labels[booking.status]}</Text>
      <Text style={styles.body}>{new Date(booking.startsAt).toLocaleString("pl-PL")} – {new Date(booking.endsAt).toLocaleTimeString("pl-PL")}</Text>
      <Text style={styles.body}>{(booking.priceCents / 100).toFixed(2)} zł</Text>
      {booking.note ? <Text style={styles.body}>{booking.note}</Text> : null}
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/marketplace/bookings" as never)}><Text style={styles.secondaryButtonText}>Zarządzaj rezerwacjami</Text></TouchableOpacity>
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { padding: 20, paddingBottom: 48 },
  secondaryButtonText: { color: "#D35400", fontSize: 13, fontWeight: "800" },
  title: { color: "#3D2415", fontSize: 27, fontWeight: "800" },
  statusError: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  cardTitle: { color: "#3D2415", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  body: { color: "#6F5648", fontSize: 13, lineHeight: 19 },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 8
  }
});
