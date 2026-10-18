import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { getBooking } from "@/services/bookings-service";
import { Booking } from "@/types/marketplace";
import { marketplaceStyles as styles } from "@/styles/marketplace";

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
