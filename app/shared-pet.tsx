import { useEffect, useState } from "react";
import { useIsFocused } from "expo-router/react-navigation";
import Head from "expo-router/head";
import * as ExpoLinking from "expo-linking";
import { ActivityIndicator, AppState, Image, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ApiError } from "@/services/api-client";
import { getSharedDocumentUrl, getSharedPetCard } from "@/services/pet-sharing-service";
import type { SharedPetCard } from "@/types/pet-sharing";
import { parsePetAllergies, parsePetIllnesses } from "@/types/pet-health";
import { marketplaceStyles as styles } from "@/styles/marketplace";

function useShareToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const update = (url: string | null) => {
      if (!active) return;
      const hash = url?.split("#")[1] || "";
      const value = new URLSearchParams(hash).get("token") || "";
      setToken(/^[A-Za-z0-9_-]{43}$/.test(value) ? value : "");
    };
    if (Platform.OS === "web") {
      const changed = () => update(window.location.href);
      changed(); window.addEventListener("hashchange", changed);
      return () => { active = false; window.removeEventListener("hashchange", changed); };
    }
    ExpoLinking.getInitialURL().then(update).catch(() => update(null));
    const subscription = ExpoLinking.addEventListener("url", event => update(event.url));
    return () => { active = false; subscription.remove(); };
  }, []);
  return token;
}

export default function SharedPetScreen() {
  const token = useShareToken();
  const focused = useIsFocused();
  const [card, setCard] = useState<SharedPetCard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [opening, setOpening] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!focused) return;
    let active = true;
    let controller: AbortController | undefined;
    let expires: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (token === null) return;
      if (!token) { setCard(null); setError("Ten link jest nieprawidłowy, wygasł lub został cofnięty."); setLoading(false); return; }
      controller?.abort(); controller = new AbortController();
      try {
        const result = await getSharedPetCard(token, controller.signal);
        if (!active) return;
        const remaining = Date.parse(result.expiresAt) - Date.now();
        if (remaining <= 0) throw new ApiError("Ten link wygasł.", 404);
        setCard(result); setError("");
        clearTimeout(expires);
        expires = setTimeout(() => { setCard(null); setError("Ten link wygasł."); }, remaining);
      } catch (e) {
        if (!active || (e instanceof Error && e.name === "AbortError")) return;
        setCard(null);
        setError(e instanceof ApiError && e.status === 404 ? "Ten link jest nieprawidłowy, wygasł lub został cofnięty." : "Nie udało się pobrać karty. Sprawdź połączenie i spróbuj ponownie.");
      } finally { if (active) setLoading(false); }
    };
    const hide = () => { controller?.abort(); setCard(null); };
    // Clear the previous link's remote data before subscribing with a new token.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCard(null); setError(""); setDownloadError(""); setLoading(true); void refresh();
    const interval = setInterval(() => {
      if (Platform.OS === "web" ? document.visibilityState === "visible" : AppState.currentState === "active") void refresh();
    }, 30_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void refresh(); else hide(); });
    const visibility = () => { if (document.visibilityState === "visible") void refresh(); else hide(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false; controller?.abort(); clearInterval(interval); clearTimeout(expires); subscription.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", visibility);
    };
  }, [token, retry, focused]);

  const openDocument = async (documentId: string) => {
    if (!token || opening) return;
    // Open synchronously so browsers do not block the download as a popup.
    const tab = Platform.OS === "web" ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    setOpening(true); setDownloadError("");
    try {
      const url = await getSharedDocumentUrl(token, documentId);
      if (Platform.OS === "web") {
        if (!tab) throw new Error("Zezwól na otwieranie nowej karty, aby pobrać PDF.");
        tab.location.href = url;
      } else await Linking.openURL(url);
    } catch (e) {
      tab?.close();
      if (e instanceof ApiError && e.status === 404) { setCard(null); setError("Dokument lub udostępnienie nie jest już dostępne."); }
      else setDownloadError(e instanceof Error ? e.message : "Nie udało się pobrać dokumentu.");
    } finally { setOpening(false); }
  };

  const pet = card?.pet;
  const illnesses = parsePetIllnesses(pet?.illnesses);
  const allergies = parsePetAllergies(pet?.allergies);
  return <>
    <Head><title>Udostępniona karta pupila · Pupply</title><meta name="robots" content="noindex,nofollow,nosnippet" /><meta name="referrer" content="no-referrer" /></Head>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { maxWidth: 720, width: "100%", alignSelf: "center" }]}>
      <Text style={styles.eyebrow}>Pupply · karta pupila</Text>
      <Text style={styles.title}>{pet?.name || "Udostępniona karta pupila"}</Text>
      <Text style={[styles.subtitle, { marginBottom: 20 }]}>Dostęp tylko do odczytu</Text>
      {loading ? <ActivityIndicator color="#D35400" /> : null}
      {error ? <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.statusError}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => setRetry(value => value + 1)}><Text style={styles.secondaryButtonText}>Spróbuj ponownie</Text></TouchableOpacity>
      </View> : null}
      {card && pet ? <>
        <Text style={[styles.muted, { marginBottom: 12 }]}>Ważna do: {new Date(card.expiresAt).toLocaleString("pl-PL")}. Właściciel może wcześniej cofnąć dostęp.</Text>
        {pet.photoUrl ? <Image source={{ uri: pet.photoUrl }} accessibilityLabel={`Zdjęcie pupila ${pet.name}`} style={{ width: "100%", height: 240, borderRadius: 20, marginBottom: 14 }} resizeMode="cover" /> : null}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Podstawowe dane</Text>
          <Text selectable style={styles.body}>Rasa: {pet.breed || "Nie podano"}</Text>
          <Text selectable style={styles.body}>Wiek: {pet.age === null ? "Nie podano" : `${pet.age} lat`}</Text>
          <Text selectable style={styles.body}>Waga: {pet.weight === null ? "Nie podano" : `${pet.weight} kg`}</Text>
          <Text style={styles.body}>Płeć: {pet.gender === "FEMALE" ? "Samica" : "Samiec"}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historia chorób</Text>
          {!illnesses.length ? <Text style={styles.body}>Brak wpisów</Text> : null}
          {illnesses.map((illness, index) => <View key={index} style={{ marginBottom: 12 }}>
            <Text selectable style={styles.label}>{illness.name}{illness.date ? ` · ${illness.date}` : ""}</Text>
            {illness.description ? <Text selectable style={styles.body}>{illness.description}</Text> : null}
            {illness.medications ? <Text selectable style={styles.body}>Leki: {illness.medications}</Text> : null}
          </View>)}
          <Text style={styles.cardTitle}>Alergie</Text>
          <Text selectable style={styles.body}>{allergies.join(", ") || "Brak wpisów"}</Text>
        </View>
        {([ ["Szczepienia", pet.vaccines], ["Weterynarz", pet.vet], ["Notatki", pet.notes] ] as const).map(([title, value]) => <View style={styles.card} key={title}>
          <Text style={styles.cardTitle}>{title}</Text><Text selectable style={styles.body}>{value || "Brak wpisów"}</Text>
        </View>)}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dokumenty PDF</Text>
          {!card.includeDocuments ? <Text style={styles.body}>Właściciel nie udostępnił dokumentów.</Text> : !card.documents.length ? <Text style={styles.body}>Brak dokumentów</Text> : null}
          {downloadError ? <Text accessibilityRole="alert" style={styles.statusError}>{downloadError}</Text> : null}
          {card.documents.map(doc => <View key={doc.id} style={{ marginBottom: 12 }}>
            <Text style={styles.body}>{doc.name}</Text>
            {doc.expiresAt ? <Text style={styles.muted}>Termin ważności: {new Date(doc.expiresAt).toLocaleDateString("pl-PL", { timeZone: "UTC" })}</Text> : null}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Otwórz PDF: ${doc.name}`} disabled={opening} style={styles.secondaryButton} onPress={() => void openDocument(doc.id)}><Text style={styles.secondaryButtonText}>Otwórz PDF</Text></TouchableOpacity>
          </View>)}
        </View>
      </> : null}
    </ScrollView>
  </>;
}
