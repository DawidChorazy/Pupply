import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CareLocationPicker } from "@/components/forms/care-location-picker";
import { SitterPhotoPicker } from "@/components/forms/sitter-photo-picker";
import { ApiError } from "@/services/api-client";
import { CareLocation } from "@/services/location-service";
import { addAvailability, createSitterProfile, deleteAvailability, getMySitterProfile, updateSitterProfile } from "@/services/sitters-service";
import { uploadSitterPhoto } from "@/services/uploads-service";
import { AvailabilitySlot, SitterServiceType } from "@/types/marketplace";
import { marketplaceStyles as styles } from "@/styles/marketplace";
import { formatPolishDateTimeInput, polishDateTimeToIso } from "@/utils/input-masks";

const serviceLabels: Record<SitterServiceType, string> = { DOG_WALK: "Spacer", DROP_IN: "Wizyta domowa", DAY_CARE: "Opieka dzienna" };
const serviceDescriptions: Record<SitterServiceType, string> = { DOG_WALK: "Spacer ze zwierzakiem w okolicy.", DROP_IN: "Wizyta u właściciela: karmienie, zabawa i opieka.", DAY_CARE: "Opieka nad zwierzakiem przez część dnia." };
type Offer = { key: string; type: SitterServiceType; duration: string; price: string };
let nextOffer = 0;
const newOffer = (type: SitterServiceType): Offer => ({ key: `new-${++nextOffer}`, type, duration: type === "DAY_CARE" ? "480" : "30", price: "" });

export default function SitterProfileScreen() {
  const [exists, setExists] = useState(false);
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState<CareLocation | null>(null);
  const [radius, setRadius] = useState(10);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [preview, setPreview] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [slotBusy, setSlotBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { profile } = await getMySitterProfile();
        if (!mounted) return;
        setExists(true); setBio(profile.bio); setRadius(profile.serviceRadiusKm); setAvailability(profile.availability); setIsActive(profile.isActive);
        setLocation({ id: profile.id, city: profile.city, region: profile.region || "", county: "", latitude: profile.latitude, longitude: profile.longitude });
        setPhotoKey(profile.photoKey); setPhotoUrl(profile.photoUrl);
        setOffers(profile.services.filter(item => item.isActive).map(service => ({ key: service.id, type: service.type, duration: String(service.durationMinutes), price: (service.priceCents / 100).toFixed(2).replace(".", ",") })));
      } catch (requestError) {
        if (mounted && !(requestError instanceof ApiError && requestError.status === 404)) setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać profilu. Odśwież ekran, aby spróbować ponownie.");
      } finally { if (mounted) setIsLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const changed = () => { setSuccess(""); setError(""); };
  const updateOffer = (key: string, changes: Partial<Offer>) => { changed(); setOffers(current => current.map(offer => offer.key === key ? { ...offer, ...changes } : offer)); };
  const save = async () => {
    if (isSaving) return;
    setError(""); setSuccess("");
    if (bio.trim().length < 20) { setError("Napisz kilka słów o sobie — opis musi mieć co najmniej 20 znaków."); return; }
    if (!location) { setError("Wybierz miejscowość z podpowiedzi lub użyj swojej lokalizacji."); return; }
    if (!offers.length) { setError("Dodaj co najmniej jedną usługę i jej cenę."); return; }
    const services = offers.map(offer => ({ type: offer.type, durationMinutes: Number(offer.duration), priceCents: Math.round(Number(offer.price.replace(",", ".")) * 100), isActive: true }));
    for (let index = 0; index < services.length; index++) {
      const service = services[index];
      if (!Number.isInteger(service.durationMinutes) || service.durationMinutes < 15 || service.durationMinutes > 1440) { setError(`${serviceLabels[service.type]}: czas usługi musi wynosić od 15 do 1440 minut.`); return; }
      if (!/^\d+(?:[.,]\d{1,2})?$/.test(offers[index].price.trim()) || service.priceCents < 0 || service.priceCents > 10_000_000) { setError(`${serviceLabels[service.type]}: wpisz cenę w złotych, z maksymalnie dwoma miejscami po przecinku.`); return; }
    }
    if (new Set(services.map(item => `${item.type}:${item.durationMinutes}`)).size !== services.length) { setError("Masz dwie takie same usługi o tym samym czasie. Zmień czas lub usuń powtórzoną ofertę."); return; }
    setIsSaving(true);
    try {
      let savedPhotoKey = photoKey;
      if (pendingPhoto) { savedPhotoKey = await uploadSitterPhoto(pendingPhoto, "image/jpeg"); setPhotoKey(savedPhotoKey); setPhotoUrl(pendingPhoto); setPendingPhoto(null); }
      const payload = { bio: bio.trim(), city: location.city, region: location.region || null, latitude: location.latitude, longitude: location.longitude, serviceRadiusKm: radius, isActive, photoKey: savedPhotoKey, services };
      const response = exists ? await updateSitterProfile(payload) : await createSitterProfile(payload);
      setExists(true); setAvailability(response.profile.availability); setPhotoKey(response.profile.photoKey); setPhotoUrl(response.profile.photoUrl);
      setOffers(response.profile.services.filter(item => item.isActive).map(service => ({ key: service.id, type: service.type, duration: String(service.durationMinutes), price: (service.priceCents / 100).toFixed(2).replace(".", ",") })));
      setSuccess(isActive ? "Profil zapisany. Dodaj wolne terminy, aby właściciele mogli rezerwować Twoje usługi." : "Profil zapisany. Oferta jest wstrzymana i nie pojawia się w wyszukiwaniu.");
    } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się zapisać profilu. Sprawdź połączenie i spróbuj ponownie."); }
    finally { setIsSaving(false); }
  };
  const addSlot = async () => {
    if (slotBusy) return;
    const start = polishDateTimeToIso(startsAt); const end = polishDateTimeToIso(endsAt);
    if (!start || !end) { setError("Termin podaj jako DD.MM.RRRR GG:MM"); return; }
    if (new Date(start) <= new Date()) { setError("Początek terminu musi być w przyszłości."); return; }
    if (new Date(end) <= new Date(start)) { setError("Koniec terminu musi być później niż początek."); return; }
    setError(""); setSuccess(""); setSlotBusy(true);
    try { const response = await addAvailability(start, end); setAvailability(current => [...current, response.slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt))); setStartsAt(""); setEndsAt(""); setSuccess("Dodano wolny termin."); }
    catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się dodać terminu."); }
    finally { setSlotBusy(false); }
  };
  const removeSlot = async (slotId: string) => {
    if (slotBusy) return;
    setSlotBusy(true); changed();
    try { await deleteAvailability(slotId); setAvailability(current => current.filter(slot => slot.id !== slotId)); }
    catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się usunąć terminu."); }
    finally { setSlotBusy(false); }
  };
  const imageUri = pendingPhoto || photoUrl;
  if (isLoading) return <View style={[styles.container, styles.center]}><ActivityIndicator color="#D35400" /></View>;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Wróć"><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.eyebrow}>Dla opiekuna</Text><Text style={styles.title}>{exists ? "Twój profil opiekuna" : "Zostań opiekunem"}</Text><Text style={styles.subtitle}>Przedstaw się, dodaj usługi i ustal własne ceny.</Text></View></View>
      <View pointerEvents={isSaving ? "none" : "auto"}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Poznajmy Cię</Text>
          <SitterPhotoPicker uri={imageUri} disabled={isSaving} onSelected={uri => { setPendingPhoto(uri); changed(); }} onRemove={() => { setPendingPhoto(null); setPhotoUrl(null); setPhotoKey(null); changed(); }} onError={setError} />
          <View style={styles.divider} /><Text style={styles.label}>Kilka słów o Tobie</Text><Text style={local.hint}>Opowiedz o doświadczeniu, zwierzętach, którymi się opiekujesz, i tym, jak wygląda opieka u Ciebie.</Text>
          <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={text => { setBio(text); changed(); }} multiline maxLength={2000} placeholder="Np. Od 3 lat opiekuję się psami. Lubię spokojne spacery i dopasowuję je do potrzeb zwierzaka…" placeholderTextColor="#A98D7B" accessibilityLabel="Opis opiekuna" />
          <Text style={local.counter}>{bio.trim().length}/2000 znaków · minimum 20</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Twoja okolica</Text><Text style={local.hint}>Wybierz miejscowość, w której oferujesz opiekę. Nie musisz podawać dokładnego adresu.</Text>
          <CareLocationPicker value={location} label="Gdzie oferujesz opiekę?" onChange={value => { setLocation(value); changed(); }} />
          <Text style={styles.label}>Jak daleko możesz dojechać?</Text><View style={styles.wrap}>{[5, 10, 25, 50].map(km => <TouchableOpacity key={km} style={[styles.chip, radius === km && styles.chipActive]} onPress={() => { setRadius(km); changed(); }} accessibilityRole="button" accessibilityState={{ selected: radius === km }}><Text style={[styles.chipText, radius === km && styles.chipTextActive]}>Do {km} km</Text></TouchableOpacity>)}</View>
          {![5, 10, 25, 50].includes(radius) ? <Text style={styles.muted}>Obecny zasięg: {radius} km. Możesz zmienić go powyżej.</Text> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Usługi i ceny</Text><Text style={local.hint}>Dodaj usługi, które chcesz oferować. Cena dotyczy jednej rezerwacji o podanym czasie — nie stawki za godzinę.</Text>
          {offers.map((offer, index) => <View key={offer.key} style={local.offer}>
            <View style={styles.spaceBetween}><Text style={local.offerTitle}>{serviceLabels[offer.type]}</Text><TouchableOpacity onPress={() => { setOffers(current => current.filter(item => item.key !== offer.key)); changed(); }} accessibilityRole="button" accessibilityLabel={`Usuń usługę ${serviceLabels[offer.type]}, oferta ${index + 1}`}><MaterialCommunityIcons name="trash-can-outline" size={22} color="#B42318" /></TouchableOpacity></View>
            <Text style={local.hint}>{serviceDescriptions[offer.type]}</Text>
            <View style={styles.row}><View style={styles.half}><Text style={styles.label}>Czas usługi (min)</Text><TextInput style={styles.input} value={offer.duration} onChangeText={duration => updateOffer(offer.key, { duration })} keyboardType="number-pad" maxLength={4} accessibilityLabel={`Czas usługi ${index + 1} w minutach`} /></View><View style={styles.half}><Text style={styles.label}>Cena (zł)</Text><TextInput style={styles.input} value={offer.price} onChangeText={price => updateOffer(offer.key, { price })} keyboardType="decimal-pad" maxLength={9} placeholder="Np. 35,00" placeholderTextColor="#A98D7B" accessibilityLabel={`Cena usługi ${index + 1} w złotych`} /></View></View>
            <View style={styles.wrap}>{(offer.type === "DAY_CARE" ? [240, 480, 720] : [30, 60, 90]).map(minutes => <TouchableOpacity key={minutes} onPress={() => updateOffer(offer.key, { duration: String(minutes) })} style={[local.smallChip, Number(offer.duration) === minutes && local.smallChipActive]} accessibilityRole="button"><Text style={local.smallChipText}>{minutes >= 120 ? `${minutes / 60} godz.` : `${minutes} min`}</Text></TouchableOpacity>)}</View>
          </View>)}
          {!offers.length ? <View style={local.empty}><MaterialCommunityIcons name="briefcase-plus-outline" size={28} color="#D35400" /><Text style={styles.body}>Zacznij od dodania pierwszej usługi poniżej.</Text></View> : null}
          <Text style={[styles.label, { marginTop: 16 }]}>Dodaj usługę</Text><View style={styles.wrap}>{(Object.keys(serviceLabels) as SitterServiceType[]).map(type => <TouchableOpacity key={type} style={local.addService} disabled={offers.length >= 20} onPress={() => { setOffers(current => [...current, newOffer(type)]); changed(); }} accessibilityRole="button" accessibilityLabel={`Dodaj usługę: ${serviceLabels[type]}`}><MaterialCommunityIcons name="plus" size={18} color="#D35400" /><Text style={local.addServiceText}>{serviceLabels[type]}</Text></TouchableOpacity>)}</View>
          <Text style={[styles.muted, { marginTop: 10 }]}>Możesz dodać kilka wariantów tej samej usługi, np. spacer 30 i 60 minut. Maksymalnie 20 ofert.</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.spaceBetween}><View style={styles.headerCopy}><Text style={styles.cardTitle}>Widoczność oferty</Text><Text style={styles.muted}>{isActive ? "Profil będzie widoczny dla właścicieli." : "Oferta jest wstrzymana. Twoje rezerwacje pozostają dostępne."}</Text></View><Switch value={isActive} onValueChange={value => { setIsActive(value); changed(); }} trackColor={{ false: "#DCCABD", true: "#D35400" }} accessibilityLabel="Widoczność profilu opiekuna" /></View>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPreview(value => !value)} accessibilityRole="button"><Text style={styles.secondaryButtonText}>{preview ? "Ukryj podgląd" : "Zobacz podgląd oferty"}</Text></TouchableOpacity>
          {preview ? <View style={local.preview}><View style={local.previewHeader}>{imageUri ? <Image source={{ uri: imageUri }} style={local.previewAvatar} /> : <MaterialCommunityIcons name="account-heart-outline" size={36} color="#D35400" />}<View style={styles.headerCopy}><Text style={local.offerTitle}>Twój profil opiekuna</Text><Text style={styles.muted}>{location ? [location.city, location.region && `woj. ${location.region}`].filter(Boolean).join(" · ") : "Wybierz miejscowość"}</Text></View></View><Text style={styles.body}>{bio.trim() || "Tu pojawi się Twój opis."}</Text>{offers.map(offer => <Text key={offer.key} style={[styles.body, { marginTop: 8 }]}>{serviceLabels[offer.type]} · {offer.duration || "—"} min · {offer.price || "—"} zł</Text>)}<Text style={[styles.muted, { marginTop: 10 }]}>Podgląd niezapisanych zmian. W wynikach pojawi się również Twoje imię z konta.</Text></View> : null}
        </View>
      </View>
      {error ? <Text style={styles.statusError} accessibilityRole="alert">{error}</Text> : null}{success ? <Text style={styles.statusSuccess} accessibilityRole="alert">{success}</Text> : null}
      <TouchableOpacity style={[styles.primaryButton, isSaving && styles.buttonDisabled]} disabled={isSaving} onPress={save} accessibilityRole="button">{isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{exists ? "Zapisz zmiany" : "Zapisz profil opiekuna"}</Text>}</TouchableOpacity>
      <Text style={[styles.muted, { marginTop: 8, marginBottom: 20 }]}>Zdjęcie, opis, usługi i widoczność zostaną zapisane po kliknięciu przycisku.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>4. Wolne terminy</Text>
        {!exists ? <Text style={styles.body}>Najpierw zapisz profil. Następnie dodaj godziny, w których możesz przyjąć rezerwacje.</Text> : <>
          <Text style={local.hint}>Podaj przedział dostępności. Musi pomieścić całą usługę, którą właściciel chce zarezerwować.</Text>
          <Text style={styles.label}>Od</Text><TextInput style={styles.input} value={startsAt} onChangeText={value => setStartsAt(formatPolishDateTimeInput(value))} placeholder="DD.MM.RRRR GG:MM" placeholderTextColor="#A98D7B" keyboardType="number-pad" maxLength={16} accessibilityLabel="Początek dostępności" />
          <Text style={styles.label}>Do</Text><TextInput style={styles.input} value={endsAt} onChangeText={value => setEndsAt(formatPolishDateTimeInput(value))} placeholder="DD.MM.RRRR GG:MM" placeholderTextColor="#A98D7B" keyboardType="number-pad" maxLength={16} accessibilityLabel="Koniec dostępności" />
          <TouchableOpacity style={styles.secondaryButton} onPress={addSlot} disabled={slotBusy || isSaving} accessibilityRole="button">{slotBusy ? <ActivityIndicator color="#D35400" /> : <Text style={styles.secondaryButtonText}>Dodaj wolny termin</Text>}</TouchableOpacity><View style={styles.divider} />
          {availability.length === 0 ? <Text style={styles.muted}>Nie masz jeszcze wolnych terminów.</Text> : availability.map(slot => <View key={slot.id} style={[styles.spaceBetween, { marginBottom: 14 }]}><Text style={[styles.body, styles.headerCopy]}>{new Date(slot.startsAt).toLocaleString("pl-PL")} – {new Date(slot.endsAt).toLocaleString("pl-PL")}</Text><TouchableOpacity onPress={() => removeSlot(slot.id)} disabled={slotBusy || isSaving} accessibilityLabel="Usuń wolny termin"><MaterialCommunityIcons name="trash-can-outline" size={20} color="#B42318" /></TouchableOpacity></View>)}
        </>}
      </View>
    </ScrollView>
  );
}
const local = StyleSheet.create({
  hint: { color: "#8A6D5B", fontSize: 12, lineHeight: 18, marginBottom: 12 }, counter: { color: "#8A6D5B", fontSize: 11, textAlign: "right" },
  offer: { padding: 14, backgroundColor: "#FFF8F0", borderRadius: 16, borderWidth: 1, borderColor: "#F1DED0", marginTop: 12 }, offerTitle: { color: "#3D2415", fontWeight: "700", fontSize: 16, marginBottom: 5 },
  smallChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F1DED0" }, smallChipActive: { backgroundColor: "#FFE2CC", borderColor: "#D35400" }, smallChipText: { color: "#6F5648", fontSize: 12 },
  addService: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#FFF0E5" }, addServiceText: { color: "#D35400", fontWeight: "600", fontSize: 13 },
  empty: { alignItems: "center", gap: 10, padding: 20, backgroundColor: "#FFF8F0", borderRadius: 14 }, preview: { padding: 14, borderWidth: 1, borderColor: "#F1DED0", borderRadius: 14, marginTop: 14 }, previewHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }, previewAvatar: { width: 56, height: 56, borderRadius: 18 }
});
