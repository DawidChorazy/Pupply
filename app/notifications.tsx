import { useFocusEffect, Text } from "expo-router/react-navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View, StyleSheet } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/features/notifications/services/notifications-service";
import { AppNotification } from "@/features/notifications/types/notifications";

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setIsLoading(true); setError(""); try { const response = await listNotifications({ pageSize: 50 }); setItems(response.items); } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać powiadomień"); } finally { setIsLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const readOne = async (item: AppNotification) => { try { if (!item.readAt) { await markNotificationRead(item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)); } if (item.bookingId) router.push("/marketplace/bookings" as never); } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się otworzyć powiadomienia"); } };
  const readAll = async () => { try { await markAllNotificationsRead(); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się oznaczyć powiadomień"); } };
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.eyebrow}>Aktualności</Text><Text style={styles.title}>Powiadomienia</Text><Text style={styles.subtitle}>Zmiany dotyczące Twoich rezerwacji.</Text></View></View>
    {items.some((item) => !item.readAt) ? <TouchableOpacity style={styles.secondaryButton} onPress={readAll}><Text style={styles.secondaryButtonText}>Oznacz wszystkie jako przeczytane</Text></TouchableOpacity> : null}
    <View style={{ height: 14 }} />{error ? <Text style={styles.statusError}>{error}</Text> : null}{isLoading ? <ActivityIndicator color="#D35400" /> : null}
    {!isLoading && !items.length ? <View style={styles.card}><View style={styles.empty}><Text style={styles.cardTitle}>Wszystko spokojnie</Text><Text style={styles.muted}>Nie masz jeszcze powiadomień.</Text></View></View> : null}
    {items.map((item) => <TouchableOpacity key={item.id} style={[styles.card, !item.readAt && styles.unreadCard]} onPress={() => void readOne(item)}><View style={styles.spaceBetween}><Text style={styles.cardTitle}>{item.title}</Text>{!item.readAt ? <View style={styles.badge}><Text style={styles.badgeText}>Nowe</Text></View> : null}</View><Text style={styles.body}>{item.message}</Text><Text style={[styles.muted, { marginTop: 8 }]}>{new Date(item.createdAt).toLocaleString("pl-PL")}</Text></TouchableOpacity>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
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
  statusError: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  empty: { alignItems: "center", paddingVertical: 24 },
  cardTitle: { color: "#3D2415", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  muted: { color: "#9A7D6A", fontSize: 12, lineHeight: 17 },
  unreadCard: { borderColor: "#D35400", backgroundColor: "#FFFCF7" },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  badge: { borderRadius: 999, backgroundColor: "#FFF0D2", paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: "#9A4A10", fontSize: 11, fontWeight: "800" },
  body: { color: "#6F5648", fontSize: 13, lineHeight: 19 }
});
