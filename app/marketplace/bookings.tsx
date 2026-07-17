import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from "react-native";

import { ApiError } from "@/services/api-client";
import { getAccountId } from "@/services/auth-storage";
import { listBookings, updateBookingStatus } from "@/services/bookings-service";
import { Booking, BookingStatus } from "@/types/marketplace";
import { marketplaceStyles as styles } from "@/styles/marketplace";

const statusLabels: Record<BookingStatus, string> = {
  REQUESTED: "Oczekuje",
  ACCEPTED: "Zaakceptowana",
  REJECTED: "Odrzucona",
  CANCELLED: "Anulowana",
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

  const changeStatus = async (booking: Booking, status: Exclude<BookingStatus, "REQUESTED">) => {
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
        const canComplete = isSitter && booking.status === "ACCEPTED" && new Date(booking.availabilitySlot.endsAt) <= new Date();
        return (
          <View style={styles.card} key={booking.id}>
            <View style={styles.spaceBetween}>
              <View style={styles.headerCopy}><Text style={styles.cardTitle}>{booking.pet.name}</Text><Text style={styles.muted}>{isSitter ? `Właściciel: ${booking.owner.userProfile?.fullName ?? "Użytkownik"}` : `Opiekun: ${booking.sitter.userProfile?.fullName ?? "Opiekun Pupply"}`}</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>{statusLabels[booking.status]}</Text></View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.body}>{new Date(booking.availabilitySlot.startsAt).toLocaleString("pl-PL")}</Text>
            <Text style={styles.muted}>{booking.sitterService.durationMinutes} min • {(booking.priceCents / 100).toFixed(2)} zł</Text>
            {booking.note ? <Text style={[styles.body, { marginTop: 8 }]}>{booking.note}</Text> : null}
            {changingId === booking.id ? <ActivityIndicator style={{ marginTop: 12 }} color="#D35400" /> : (
              <View style={styles.wrap}>
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
