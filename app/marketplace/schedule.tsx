import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { calendarWindow, dateKey } from "@/features/scheduling/calendar-utils";
import { AvailabilityCalendar } from "@/features/scheduling/AvailabilityCalendar";
import { ApiError } from "@/services/api-client";
import { getMySchedule } from "@/services/sitters-service";
import { marketplaceStyles as styles } from "@/styles/marketplace";
import { AvailabilitySlot } from "@/types/marketplace";

export default function ScheduleScreen() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [missing, setMissing] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const revision = ++request.current;
    setLoading(true); setError(""); setMissing(false);
    try { const { slots } = await getMySchedule(calendarWindow(dateKey(new Date()).slice(0, 7))); if (revision === request.current) setSlots(slots); }
    catch (err) {
      if (revision !== request.current) return;
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setError(err instanceof Error ? err.message : "Nie udało się pobrać grafiku.");
    } finally { if (revision === request.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current += 1; }; }, [load]));
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity style={styles.backButton} accessibilityRole="button" accessibilityLabel="Wróć" onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.eyebrow}>Dla opiekuna</Text><Text style={styles.title}>Mój grafik</Text><Text style={styles.subtitle}>Dostępność, przerwy i rezerwacje w jednym miejscu.</Text></View></View>
    {loading ? <View style={styles.center}><ActivityIndicator color="#D35400" /></View> : missing ? <View style={styles.card}><Text style={styles.cardTitle}>Zacznij od profilu opiekuna</Text><Text style={styles.body}>Dodaj swoje usługi, a potem ustawisz dostępność w kalendarzu.</Text><TouchableOpacity style={styles.primaryButton} accessibilityRole="button" onPress={() => router.push("/marketplace/sitter-profile" as never)}><Text style={styles.primaryButtonText}>Utwórz profil opiekuna</Text></TouchableOpacity></View> : error ? <View style={styles.card}><Text style={styles.statusError} accessibilityRole="alert">{error}</Text><TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={load}><Text style={styles.secondaryButtonText}>Spróbuj ponownie</Text></TouchableOpacity></View> : <AvailabilityCalendar slots={slots} onChange={setSlots} />}
  </ScrollView>;
}
