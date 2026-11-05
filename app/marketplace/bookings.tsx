import { useFocusEffect, Text } from "expo-router/react-navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View, StyleSheet } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { getAccountId } from "@/shared/session/auth-storage";
import { listBookings, updateBookingStatus } from "@/features/marketplace/services/bookings-service";
import { Booking, BookingStatus } from "@/features/marketplace/types/marketplace";
import { ReviewDetails } from "@/features/reviews/components/ReviewDetails";
import { SERVICE_LABELS, SERVICE_DESCRIPTIONS } from "@/features/marketplace/services/service-catalog";

const statusLabels: Record<BookingStatus, string> = {
  REQUESTED: "Oczekuje",
  ACCEPTED: "Zaakceptowana",
  REJECTED: "Odrzucona",
  CANCELLED: "Anulowana",
  EXPIRED: "Wygasła",
  COMPLETED: "Zakończona"
};

export default function BookingsScreen() {
  const [items, setItems] = useState<Booking[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [changingId, setChangingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [response, storedAccountId] = await Promise.all([listBookings({ pageSize: 50 }), getAccountId()]);
      setItems(response.items);
      setAccountId(storedAccountId);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać rezerwacji");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const changeStatus = async (booking: Booking, status: Exclude<BookingStatus, "REQUESTED" | "EXPIRED">) => {
    setChangingId(booking.id);
    setError("");
    try {
      const response = await updateBookingStatus(booking.id, status);
      setItems((current) => current.map((item) => item.id === booking.id ? response.booking : item));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Nie udało się zmienić statusu");
    } finally {
      setChangingId("");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>Terminy</Text><Text style={styles.title}>Moje rezerwacje</Text><Text style={styles.subtitle}>Prośby wysłane do opiekunów i otrzymane od właścicieli.</Text></View>
      </View>
      {error ? <Text style={styles.statusError}>{error}</Text> : null}
      {isLoading ? <View style={styles.card}><View style={styles.center}><ActivityIndicator color="#D35400" /></View></View> : null}
      {!isLoading && !items.length ? <View style={styles.card}><View style={styles.empty}><Text style={styles.cardTitle}>Brak rezerwacji</Text><Text style={styles.muted}>Pierwsza rezerwacja pojawi się tutaj.</Text></View></View> : null}
      {items.map((booking) => {
        const isSitter = accountId === booking.sitterAccountId;
        const canCancel = booking.status === "REQUESTED" || booking.status === "ACCEPTED";
        const canComplete = isSitter && booking.status === "ACCEPTED" && new Date(booking.endsAt) <= new Date();
        return (
          <View style={styles.card} key={booking.id}>
            <View style={styles.spaceBetween}>
              <View style={styles.headerCopy}><Text style={styles.cardTitle}>{booking.pet.name}</Text><Text style={styles.muted}>{isSitter ? `Właściciel: ${booking.owner.userProfile?.fullName ?? "Użytkownik"}` : `Opiekun: ${booking.sitter.userProfile?.fullName ?? "Opiekun Pupply"}`}</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>{statusLabels[booking.status]}</Text></View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.body}>{SERVICE_LABELS[booking.sitterService.type]}</Text>
            {booking.sitterService.type !== "DOG_WALK" ? <Text style={styles.muted}>{SERVICE_DESCRIPTIONS[booking.sitterService.type]}</Text> : null}
            <Text style={styles.body}>{new Date(booking.startsAt).toLocaleString("pl-PL")}</Text>
            <Text style={styles.muted}>{Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000)} min • {(booking.priceCents / 100).toFixed(2)} zł</Text>
            {booking.note ? <Text style={[styles.body, { marginTop: 8 }]}>{booking.note}</Text> : null}
            {booking.review ? <><Text style={[styles.label, { marginTop: 12 }]}>{isSitter ? "Ocena właściciela" : "Twoja ocena"}</Text><ReviewDetails review={booking.review} /></> : null}
            {changingId === booking.id ? <ActivityIndicator style={{ marginTop: 12 }} color="#D35400" /> : (
              <View style={styles.wrap}>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push({ pathname: "/marketplace/chat", params: { bookingId: booking.id } })}>
                  <Text style={styles.secondaryButtonText}>Czat</Text>
                </TouchableOpacity>
                {!isSitter && accountId === booking.ownerAccountId && booking.status === "COMPLETED" && booking.sitterService.type === "DOG_WALK" && !booking.review ?
                  <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => router.push({ pathname: "/marketplace/review", params: { bookingId: booking.id } })}><Text style={styles.secondaryButtonText}>Oceń spacerowicza</Text></TouchableOpacity> : null}

                {isSitter && booking.status === "REQUESTED" ? <>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => changeStatus(booking, "ACCEPTED")}><Text style={styles.secondaryButtonText}>Akceptuj</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.secondaryButton, styles.dangerButton]} onPress={() => changeStatus(booking, "REJECTED")}><Text style={[styles.secondaryButtonText, styles.dangerButtonText]}>Odrzuć</Text></TouchableOpacity>
                </> : null}
                {canCancel ? <TouchableOpacity style={[styles.secondaryButton, styles.dangerButton]} onPress={() => changeStatus(booking, "CANCELLED")}><Text style={[styles.secondaryButtonText, styles.dangerButtonText]}>Anuluj</Text></TouchableOpacity> : null}
                {canComplete ? <TouchableOpacity style={styles.secondaryButton} onPress={() => changeStatus(booking, "COMPLETED")}><Text style={styles.secondaryButtonText}>Zakończ</Text></TouchableOpacity> : null}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { color: "#6F5648", fontSize: 14, fontWeight: "700" },
  container: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#D35400", fontSize: 13, fontWeight: "700", marginBottom: 3 },
  title: { color: "#3D2415", fontSize: 27, fontWeight: "800" },
  subtitle: { color: "#8A6D5B", fontSize: 13, lineHeight: 18, marginTop: 4 },
  statusError: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  empty: { alignItems: "center", paddingVertical: 24 },
  cardTitle: { color: "#3D2415", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  muted: { color: "#9A7D6A", fontSize: 12, lineHeight: 17 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  badge: { borderRadius: 999, backgroundColor: "#FFF0D2", paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: "#9A4A10", fontSize: 11, fontWeight: "800" },
  divider: { height: 1, backgroundColor: "#F2E4D8", marginVertical: 12 },
  body: { color: "#6F5648", fontSize: 13, lineHeight: 19 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 8
  },
  secondaryButtonText: { color: "#D35400", fontSize: 13, fontWeight: "800" },
  dangerButton: { borderColor: "#B42318" },
  dangerButtonText: { color: "#B42318" }
});
