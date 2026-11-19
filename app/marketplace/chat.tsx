import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useConversation } from "@/features/chat/hooks/use-conversation";
import { openConversation } from "@/features/chat/services/chat-service";
import { getSessionRevision, subscribeSessionChanged } from "@/shared/session/session-events";

const parameter = (value: string | string[] | undefined) => typeof value === "string" && value.length <= 100 ? value : undefined;
const back = () => router.canGoBack() ? router.back() : router.replace("/marketplace/conversations");

export default function ChatScreen() {
  const params = useLocalSearchParams<{ conversationId?: string; bookingId?: string; sitterProfileId?: string }>();
  const conversationId = parameter(params.conversationId), bookingId = parameter(params.bookingId), sitterProfileId = parameter(params.sitterProfileId);
  if (conversationId) return <ConversationView key={conversationId} id={conversationId} />;
  return <ResolveConversation key={`${bookingId ?? ""}:${sitterProfileId ?? ""}`} bookingId={bookingId} sitterProfileId={sitterProfileId} />;
}

function ResolveConversation({ bookingId, sitterProfileId }: { bookingId?: string; sitterProfileId?: string }) {
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [error, setError] = useState(!bookingId && !sitterProfileId ? "Wybierz rozmowę z listy lub opiekuna." : "");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => subscribeSessionChanged(() => { setResolvedId(null); setError(""); router.replace("/"); }), []);
  useEffect(() => {
    let active = true;
    const revision = getSessionRevision();
    if (!bookingId && !sitterProfileId) return;
    openConversation(bookingId ? { bookingId } : { sitterProfileId: sitterProfileId! })
      .then(result => { if (active && revision === getSessionRevision()) setResolvedId(result.conversation.id); })
      .catch(e => { if (active && revision === getSessionRevision()) setError(e instanceof Error ? e.message : "Nie udało się otworzyć rozmowy."); });
    return () => { active = false; };
  }, [bookingId, sitterProfileId, attempt]);
  if (resolvedId) return <ConversationView key={resolvedId} id={resolvedId} />;
  return <SafeAreaView style={styles.shell}><View style={styles.header}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Wróć" onPress={back}><MaterialCommunityIcons name="arrow-left" size={26} color="#3D2415" /></TouchableOpacity>
    <Text style={styles.title}>Czat</Text></View><View style={styles.center}>
    {error ? <><Text style={styles.error}>{error}</Text>{bookingId || sitterProfileId ? <TouchableOpacity accessibilityRole="button" onPress={() => { setError(""); setAttempt(value => value + 1); }}><Text style={styles.link}>Spróbuj ponownie</Text></TouchableOpacity> : null}
      <TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/marketplace/conversations")}><Text style={styles.link}>Moje rozmowy</Text></TouchableOpacity></> : <ActivityIndicator color="#D35400" />}
  </View></SafeAreaView>;
}

function ConversationView({ id }: { id: string }) {
  const scroll = useRef<ScrollView>(null), atBottom = useRef(true), height = useRef(0), offset = useRef(0);
  const chat = useConversation(id, () => atBottom.current);
  const [draft, setDraft] = useState("");
  const anchor = useRef<{ height: number; offset: number } | null>(null);
  const send = () => { if (chat.send(draft)) { setDraft(""); atBottom.current = true; } };
  const other = chat.conversation?.otherParticipant;
  return <SafeAreaView style={styles.shell}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Wróć" onPress={back}><MaterialCommunityIcons name="arrow-left" size={26} color="#3D2415" /></TouchableOpacity>
        {other?.photoUrl ? <Image source={{ uri: other.photoUrl }} style={styles.avatar} /> : <MaterialCommunityIcons name="account-circle-outline" size={38} color="#8A6D5B" />}
        <View style={styles.flex}><Text style={styles.title}>{other?.displayName ?? "Rozmowa"}</Text><Text style={styles.muted}>Wiadomości prywatne</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Moje rozmowy" onPress={() => router.push("/marketplace/conversations")}><MaterialCommunityIcons name="message-outline" size={25} color="#D35400" /></TouchableOpacity>
      </View>
      {chat.error ? <Text accessibilityRole="alert" style={styles.error}>{chat.error}</Text> : null}
      {chat.isLoading ? <ActivityIndicator style={styles.center} color="#D35400" /> : null}
      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" scrollEventThrottle={100}
        onScroll={event => { const view = event.nativeEvent; offset.current = view.contentOffset.y; atBottom.current = view.contentSize.height - view.layoutMeasurement.height - view.contentOffset.y < 100; }}
        onContentSizeChange={(_width, nextHeight) => {
          if (anchor.current) {
            if (!chat.isLoadingOlder) { scroll.current?.scrollTo({ y: anchor.current.offset + nextHeight - anchor.current.height, animated: false }); anchor.current = null; }
          }
          else if (atBottom.current) scroll.current?.scrollToEnd({ animated: false });
          height.current = nextHeight;
        }}>
        {chat.nextBefore ? <TouchableOpacity accessibilityRole="button" disabled={chat.isLoadingOlder} onPress={async () => { atBottom.current = false; anchor.current = { height: height.current, offset: offset.current }; if (!await chat.loadOlder()) anchor.current = null; }}>
          <Text style={styles.link}>{chat.isLoadingOlder ? "Ładowanie…" : "Wczytaj starsze wiadomości"}</Text></TouchableOpacity> : null}
        {!chat.isLoading && !chat.error && !chat.messages.length && !chat.pending.length ? <Text style={styles.empty}>Brak wiadomości. Przywitaj się i ustal szczegóły opieki.</Text> : null}
        {chat.messages.map(message => {
          const mine = message.senderAccountId === chat.conversation?.myAccountId;
          return <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
            <Text style={[styles.messageText, mine && styles.mineText]}>{message.text}</Text>
            <Text style={[styles.time, mine && styles.mineText]}>{new Date(message.createdAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Text>
          </View>;
        })}
        {chat.pending.map(item => <View key={item.clientMessageId} style={[styles.bubble, styles.mine, styles.pending]}>
          <Text style={[styles.messageText, styles.mineText]}>{item.text}</Text>
          {item.status === "sending" ? <Text style={styles.mineText}>Wysyłanie…</Text> : <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ponów wysłanie wiadomości" disabled={chat.isSending || !chat.conversation?.canSend} onPress={() => chat.retry(item)}><Text style={styles.retry}>Nie potwierdzono wysyłki — Ponów</Text></TouchableOpacity>}
        </View>)}
      </ScrollView>
      {Boolean(chat.conversation?.unreadCount) ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Przejdź do nowych wiadomości" onPress={() => { atBottom.current = true; scroll.current?.scrollToEnd({ animated: false }); }}><Text style={styles.link}>Nowe wiadomości ↓</Text></TouchableOpacity> : null}
      {chat.conversation && !chat.conversation.canSend ? <Text style={styles.notice}>Wysyłanie jest niedostępne. Oba konta muszą być aktywne i mieć potwierdzony e-mail.</Text> : null}
      <View style={styles.composer}>
        <TextInput accessibilityLabel="Wiadomość" placeholder="Napisz wiadomość" placeholderTextColor="#8A7A70" style={styles.input}
          value={draft} onChangeText={setDraft} multiline maxLength={4000} editable={Boolean(chat.conversation?.canSend)}
          onKeyPress={event => {
            const native = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean };
            if (Platform.OS === "web" && native.key === "Enter" && !native.shiftKey && !native.isComposing) { event.preventDefault(); send(); }
          }} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Wyślij wiadomość" onPress={send}
          disabled={!draft.trim() || chat.isSending || !chat.conversation?.canSend} style={[styles.send, (!draft.trim() || chat.isSending || !chat.conversation?.canSend) && styles.disabled]}>
          <MaterialCommunityIcons name="send" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.counter}>{draft.length}/4000</Text>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FFF8F0" }, flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: "#F2E4D8" },
  title: { fontSize: 20, fontWeight: "800", color: "#3D2415" }, muted: { color: "#8A6D5B", fontSize: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19 }, center: { padding: 30, alignItems: "center", gap: 16 },
  messages: { padding: 16, gap: 12, flexGrow: 1 }, empty: { color: "#8A6D5B", textAlign: "center", padding: 24 },
  bubble: { maxWidth: "85%", borderRadius: 18, padding: 13, gap: 5 }, mine: { alignSelf: "flex-end", backgroundColor: "#D35400" },
  theirs: { alignSelf: "flex-start", backgroundColor: "#F3E8DE" }, messageText: { color: "#3D2415", fontSize: 16, lineHeight: 23 },
  mineText: { color: "#FFFFFF" }, time: { fontSize: 11, color: "#6F5648", alignSelf: "flex-end" }, pending: { opacity: 0.75 },
  retry: { color: "#FFFFFF", textDecorationLine: "underline", fontSize: 12 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  input: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8D8CB", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, minHeight: 48, maxHeight: 140, color: "#3D2415" },
  send: { padding: 13, borderRadius: 18, backgroundColor: "#D35400", minHeight: 48 }, disabled: { opacity: 0.4 },
  counter: { fontSize: 11, color: "#8A6D5B", paddingHorizontal: 20, paddingVertical: 5 }, error: { color: "#B42318", padding: 12, textAlign: "center" },
  notice: { padding: 12, color: "#7A3B12", fontSize: 13 }, link: { color: "#D35400", fontWeight: "700", padding: 12, textAlign: "center" }
});
