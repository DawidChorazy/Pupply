import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listConversations } from "@/features/chat/services/chat-service";
import { Conversation } from "@/features/chat/types/chat";
import { ApiError } from "@/shared/api/api-client";
import { useFocusedPolling } from "@/shared/hooks/use-focused-polling";
import { getSessionRevision, subscribeSessionChanged } from "@/shared/session/session-events";

export default function ConversationsScreen() {
  const [items, setItems] = useState<Conversation[]>([]), [error, setError] = useState("");
  const [isLoading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const expanded = useRef(false), busy = useRef(false), generation = useRef(0);
  const merge = (incoming: Conversation[]) => setItems(current => {
    const map = new Map(current.map(item => [item.id, item]));
    incoming.forEach(item => map.set(item.id, item));
    return [...map.values()].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || b.id.localeCompare(a.id));
  });
  useFocusEffect(useCallback(() => {
    generation.current += 1; expanded.current = false; busy.current = false;
    setItems([]); setLoading(true); setLoadingMore(false); setNextCursor(null);
    return () => { generation.current += 1; };
  }, []));
  useEffect(() => subscribeSessionChanged(() => { setItems([]); setError(""); router.replace("/"); }), []);
  const failure = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { router.replace("/"); return; }
    setError(e instanceof Error ? e.message : "Nie udało się pobrać rozmów.");
  };
  useFocusedPolling(async isCurrent => {
    try {
      const page = await listConversations();
      if (!isCurrent()) return;
      merge(page.items);
      if (!expanded.current) setNextCursor(page.nextCursor);
      setError(""); setLoading(false);
    } catch (e) { if (isCurrent()) { failure(e); setLoading(false); } }
  });
  const more = async () => {
    if (!nextCursor || busy.current) return;
    busy.current = true; setLoadingMore(true);
    const revision = getSessionRevision(), started = generation.current;
    try {
      const page = await listConversations(nextCursor);
      if (revision !== getSessionRevision() || started !== generation.current) return;
      merge(page.items); setNextCursor(page.nextCursor); expanded.current = true;
    } catch (e) { if (revision === getSessionRevision() && started === generation.current) failure(e); }
    finally { if (started === generation.current) { busy.current = false; setLoadingMore(false); } }
  };
  return <SafeAreaView style={styles.shell}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Wróć" onPress={() => router.canGoBack() ? router.back() : router.replace("/home")}><MaterialCommunityIcons name="arrow-left" size={26} color="#3D2415" /></TouchableOpacity>
      <View><Text style={styles.title}>Moje rozmowy</Text><Text style={styles.muted}>Ustal szczegóły opieki z drugą osobą.</Text></View>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error} Spróbujemy ponownie za chwilę.</Text> : null}
    {isLoading ? <ActivityIndicator color="#D35400" /> : null}
    {!isLoading && !items.length && !error ? <View style={styles.card}><Text style={styles.name}>Nie masz jeszcze rozmów</Text><Text style={styles.muted}>Napisz do opiekuna w wyszukiwarce lub otwórz czat przy rezerwacji.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/marketplace/sitters")}><Text style={styles.link}>Znajdź opiekuna</Text></TouchableOpacity></View> : null}
    {items.map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`Rozmowa z ${item.otherParticipant.displayName}${item.unreadCount ? `, ${item.unreadCount} nieprzeczytanych` : ""}`}
      style={[styles.card, item.unreadCount > 0 && styles.unread]} onPress={() => router.push({ pathname: "/marketplace/chat", params: { conversationId: item.id } })}>
      <View style={styles.row}>
        {item.otherParticipant.photoUrl ? <Image source={{ uri: item.otherParticipant.photoUrl }} style={styles.avatar} /> : <MaterialCommunityIcons name="account-circle-outline" size={42} color="#8A6D5B" />}
        <View style={styles.flex}><Text style={styles.name}>{item.otherParticipant.displayName}</Text><Text style={styles.preview} numberOfLines={2}>{item.lastMessage ? `${item.lastMessage.senderAccountId === item.myAccountId ? "Ty: " : ""}${item.lastMessage.text}` : "Rozpocznij rozmowę"}</Text></View>
        {item.unreadCount > 0 ? <Text style={styles.badge}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text> : null}
      </View>
      <Text style={styles.date}>{new Date(item.lastActivityAt).toLocaleString("pl-PL")}</Text>
    </TouchableOpacity>)}
    {nextCursor ? <TouchableOpacity accessibilityRole="button" disabled={loadingMore} onPress={() => void more()}><Text style={styles.link}>{loadingMore ? "Ładowanie…" : "Wczytaj kolejne rozmowy"}</Text></TouchableOpacity> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FFF8F0" }, content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 }, title: { color: "#3D2415", fontSize: 25, fontWeight: "800" },
  card: { backgroundColor: "#FFFFFF", padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "#F2E4D8", marginBottom: 12, gap: 8 },
  unread: { borderColor: "#D35400", backgroundColor: "#FFFCF7" }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, flex: { flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21 }, name: { fontSize: 17, fontWeight: "700", color: "#3D2415" },
  muted: { color: "#8A6D5B", fontSize: 13, marginTop: 5 }, preview: { color: "#6F5648", fontSize: 14, marginTop: 5 },
  badge: { color: "#FFFFFF", backgroundColor: "#D35400", paddingVertical: 4, paddingHorizontal: 9, borderRadius: 15, fontWeight: "700" },
  date: { color: "#8A6D5B", fontSize: 11, alignSelf: "flex-end" }, error: { color: "#B42318", paddingVertical: 14 },
  link: { color: "#D35400", fontWeight: "700", textAlign: "center", padding: 14 }
});
