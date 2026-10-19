import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Platform, ScrollView, Share, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { authenticatedApiRequest } from "@/services/api-client";
import type { Pet } from "@/types/pets";
import { createPetShare, listPetShares, revokePetShare } from "@/services/pet-sharing-service";
import type { PetShare } from "@/types/pet-sharing";
import { marketplaceStyles as styles } from "@/styles/marketplace";
import QRCode from "react-native-qrcode-svg";

const date = (value: string) => new Date(value).toLocaleString("pl-PL");

async function copyLink(url: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(url); return; }
    catch { /* Fall back when the browser denies clipboard permissions. */ }
  }
  // Clipboard API requires HTTPS; this also works on the local HTTP preview.
  const field = document.createElement("textarea");
  field.value = url;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  try {
    field.select();
    if (!document.execCommand("copy")) throw new Error("Zaznacz link powyżej i skopiuj go ręcznie.");
  } finally { field.remove(); }
}

export default function PetSharingScreen() {
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const [petName, setPetName] = useState("");
  const [shares, setShares] = useState<PetShare[]>([]);
  const [label, setLabel] = useState("");
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [fresh, setFresh] = useState<{ id: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const mutation = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(""); setPetName(""); setShares([]); setFresh(null);
    if (!petId) { setError("Nie wskazano pupila."); setLoading(false); return; }
    Promise.all([authenticatedApiRequest<{ pet: Pet }>(`/pets/${encodeURIComponent(petId)}`), listPetShares(petId)]).then(([{ pet }, links]) => {
      if (active) { setPetName(pet.name); setShares(links); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Nie udało się pobrać udostępnień."); })
      .finally(() => { if (active) setLoading(false); });
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [petId]));

  const run = async (action: () => Promise<void>) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : "Nie udało się wykonać operacji."); }
    finally { mutation.current = false; setBusy(false); }
  };

  return <ScrollView style={styles.container} contentContainerStyle={[styles.content, { maxWidth: 720, width: "100%", alignSelf: "center" }]} keyboardShouldPersistTaps="handled">
    <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}><Text style={styles.secondaryButtonText}>Wróć do karty pupila</Text></TouchableOpacity>
    <Text style={styles.title}>Udostępnij kartę pupila</Text>
    <Text style={[styles.subtitle, { marginBottom: 20 }]}>{petName || "Pupply"} · dostęp tylko do odczytu</Text>
    {loading || busy ? <ActivityIndicator color="#D35400" /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.statusError}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.statusSuccess}>{message}</Text> : null}
    {!loading && petName && petId ? <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nowy link na 7 dni</Text>
        <Text style={styles.body}>Każdy, kto otrzyma link, zobaczy zdjęcie, dane pupila, historię chorób, alergie, szczepienia, weterynarza i notatki. Nie potrzebuje konta i nie może niczego edytować. Może też przekazać link dalej.</Text>
        <Text style={[styles.label, { marginTop: 14 }]}>Nazwa dla Ciebie (opcjonalnie)</Text>
        <TextInput style={styles.input} accessibilityLabel="Nazwa udostępnienia" placeholder="Np. opiekunka na weekend" value={label} maxLength={80} onChangeText={setLabel} editable={!busy} />
        <View style={styles.spaceBetween}>
          <Text style={[styles.body, { flex: 1 }]}>Dołącz dokumenty PDF</Text>
          <Switch accessibilityLabel="Dołącz dokumenty PDF" value={includeDocuments} onValueChange={setIncludeDocuments} disabled={busy} trackColor={{ true: "#D35400" }} />
        </View>
        <Text style={styles.muted}>Po włączeniu odbiorca zobaczy i pobierze wszystkie aktualne i dodane później PDF-y. Zapisanych przez niego kopii nie można cofnąć.</Text>
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]} onPress={() => void run(async () => {
          const result = await createPetShare(petId, { label, includeDocuments });
          setShares(previous => [result.share, ...previous].slice(0, 100));
          setFresh({ id: result.share.id, url: result.url }); setLabel(""); setNow(Date.now());
          setShares(await listPetShares(petId));
        })}><Text style={styles.primaryButtonText}>Utwórz link ważny 7 dni</Text></TouchableOpacity>
      </View>
      {fresh && shares.some(s => s.id === fresh.id && !s.revokedAt && Date.parse(s.expiresAt) > now) ? <View style={styles.card}>
        <Text style={styles.cardTitle}>Link gotowy</Text>
        <Text style={styles.body}>Skopiuj go teraz. Po opuszczeniu tego ekranu możesz utworzyć kolejny link lub cofnąć obecny.</Text>

        <View style={{alignItems: "center", marginVertical: 20}}>
          <QRCode
          value={fresh.url}
          size={220}
          color="#000000"
          backgroundColor="#ffffff"
          quietZone={16}></QRCode>
          <Text style={[styles.muted, {marginTop: 12}]}>
            Zeskanuj kod, aby otworzyć kartę pupila
          </Text>
        </View>

        <TextInput accessibilityLabel="Link do karty pupila" style={[styles.input, { marginTop: 12 }]} value={fresh.url} editable={false} selectTextOnFocus multiline />
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.primaryButton} onPress={() => void run(async () => {
          if (Platform.OS === "web") { await copyLink(fresh.url); setMessage("Skopiowano link do karty pupila."); }
          else await Share.share({ message: fresh.url, title: `Karta pupila ${petName}` });
        })}><Text style={styles.primaryButtonText}>{Platform.OS === "web" ? "Kopiuj link" : "Udostępnij link"}</Text></TouchableOpacity>
      </View> : null}
      <Text style={styles.cardTitle}>Twoje udostępnienia</Text>
      {!shares.length ? <Text style={styles.body}>Nie udostępniasz jeszcze tej karty.</Text> : null}
      {shares.map(share => {
        const active = !share.revokedAt && Date.parse(share.expiresAt) > now;
        return <View key={share.id} style={styles.card}>
          <Text style={styles.cardTitle}>{share.label || "Karta pupila"}</Text>
          <Text style={styles.body}>{share.revokedAt ? "Dostęp cofnięty" : active ? "Aktywny" : "Link wygasł"} · {share.includeDocuments ? "Z dokumentami PDF" : "Bez dokumentów PDF"}</Text>
          <Text style={styles.muted}>Utworzono: {date(share.createdAt)}</Text>
          <Text style={styles.muted}>Ważny do: {date(share.expiresAt)}</Text>
          {active ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Cofnij dostęp: ${share.label || "Karta pupila"}`} disabled={busy} style={[styles.secondaryButton, styles.dangerButton]} onPress={() => void run(async () => {
            await revokePetShare(petId, share.id);
            setShares(previous => previous.map(s => s.id === share.id ? { ...s, revokedAt: new Date().toISOString() } : s));
            if (fresh?.id === share.id) setFresh(null);
            setMessage("Cofnięto dostęp. Ten link już nie działa.");
          })}><Text style={styles.dangerButtonText}>Cofnij dostęp</Text></TouchableOpacity> : null}
        </View>;
      })}
    </> : null}
  </ScrollView>;
}
