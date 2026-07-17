import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from "react-native";

import { ApiError } from "@/services/api-client";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/services/notifications-service";
import { AppNotification } from "@/types/notifications";
import { marketplaceStyles as styles } from "@/styles/marketplace";

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState("");
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
