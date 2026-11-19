import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CareLocationPicker } from "@/features/marketplace/components/CareLocationPicker";
import { SitterPhotoPicker } from "@/features/marketplace/components/SitterPhotoPicker";
import { ApiError } from "@/shared/api/api-client";
import { CareLocation } from "@/features/marketplace/services/location-service";
import { createSitterProfile, getMySchedule, getMySitterProfile, updateSitterProfile } from "@/features/marketplace/services/sitters-service";
import { uploadSitterPhoto } from "@/shared/api/uploads-service";
import { AvailabilitySlot, SitterServiceType } from "@/features/marketplace/types/marketplace";
import { calendarWindow, dateKey } from "@/features/scheduling/calendar-utils";
import { AvailabilityCalendar } from "@/features/scheduling/AvailabilityCalendar";
import { SERVICE_LABELS as serviceLabels, SERVICE_DESCRIPTIONS as serviceDescriptions } from "@/features/marketplace/services/service-catalog";

type Offer = { key: string; type: SitterServiceType; duration: string; price: string };
let nextOffer = 0;
const newOffer = (type: SitterServiceType): Offer => ({ key: `new-${++nextOffer}`, type, duration: type === "DAY_CARE" ? "480" : "30", price: "" });

export default function SitterProfileScreen() {
  const [exists, setExists] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { profile } = await getMySitterProfile();
        const { slots } = await getMySchedule(calendarWindow(dateKey(new Date()).slice(0, 7)));
        if (!mounted) return;
        setExists(true); setProfileId(profile.id); setBio(profile.bio); setRadius(profile.serviceRadiusKm); setAvailability(slots); setIsActive(profile.isActive);
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
    if (isSaving || scheduleBusy) return;
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
      setExists(true); setProfileId(response.profile.id); if (!exists) setAvailability(response.profile.availability); setPhotoKey(response.profile.photoKey); setPhotoUrl(response.profile.photoUrl);
      setOffers(response.profile.services.filter(item => item.isActive).map(service => ({ key: service.id, type: service.type, duration: String(service.durationMinutes), price: (service.priceCents / 100).toFixed(2).replace(".", ",") })));
      setSuccess(isActive ? "Profil zapisany. Dodaj wolne terminy, aby właściciele mogli rezerwować Twoje usługi." : "Profil zapisany. Oferta jest wstrzymana i nie pojawia się w wyszukiwaniu.");
    } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się zapisać profilu. Sprawdź połączenie i spróbuj ponownie."); }
    finally { setIsSaving(false); }
  };
  const imageUri = pendingPhoto || photoUrl;
  if (isLoading) return <View style={[styles.container, styles.center]}><ActivityIndicator color="#D35400" /></View>;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Wróć"><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.eyebrow}>Dla opiekuna</Text><Text style={styles.title}>{exists ? "Twój profil opiekuna" : "Zostań opiekunem"}</Text><Text style={styles.subtitle}>Przedstaw się, dodaj usługi i ustal własne ceny.</Text></View></View>
      <View pointerEvents={isSaving || scheduleBusy ? "none" : "auto"}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Poznajmy Cię</Text>
          <SitterPhotoPicker uri={imageUri} disabled={isSaving} onSelected={uri => { setPendingPhoto(uri); changed(); }} onRemove={() => { setPendingPhoto(null); setPhotoUrl(null); setPhotoKey(null); changed(); }} onError={setError} />
          <View style={styles.divider} /><Text style={styles.label}>Kilka słów o Tobie</Text><Text style={styles.hint}>Opowiedz o doświadczeniu, zwierzętach, którymi się opiekujesz, i tym, jak wygląda opieka u Ciebie.</Text>
          <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={text => { setBio(text); changed(); }} multiline maxLength={2000} placeholder="Np. Od 3 lat opiekuję się psami. Lubię spokojne spacery i dopasowuję je do potrzeb zwierzaka…" placeholderTextColor="#A98D7B" accessibilityLabel="Opis opiekuna" />
          <Text style={styles.counter}>{bio.trim().length}/2000 znaków · minimum 20</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Twoja okolica</Text><Text style={styles.hint}>Wybierz miejscowość, w której oferujesz opiekę. Nie musisz podawać dokładnego adresu.</Text>
          <CareLocationPicker value={location} label="Gdzie oferujesz opiekę?" onChange={value => { setLocation(value); changed(); }} />
          <Text style={styles.label}>Jak daleko możesz dojechać?</Text><View style={styles.wrap}>{[5, 10, 25, 50].map(km => <TouchableOpacity key={km} style={[styles.chip, radius === km && styles.chipActive]} onPress={() => { setRadius(km); changed(); }} accessibilityRole="button" accessibilityState={{ selected: radius === km }}><Text style={[styles.chipText, radius === km && styles.chipTextActive]}>Do {km} km</Text></TouchableOpacity>)}</View>
          {![5, 10, 25, 50].includes(radius) ? <Text style={styles.muted}>Obecny zasięg: {radius} km. Możesz zmienić go powyżej.</Text> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Usługi i ceny</Text><Text style={styles.hint}>Podaj cenę i minimalny czas usługi. Właściciel może wybrać dłuższą opiekę — cena wzrośnie proporcjonalnie, np. 30 zł za 30 minut to 60 zł za godzinę.</Text>
          {offers.map((offer, index) => <View key={offer.key} style={styles.offer}>
            <View style={styles.spaceBetween}><Text style={styles.offerTitle}>{serviceLabels[offer.type]}</Text><TouchableOpacity onPress={() => { setOffers(current => current.filter(item => item.key !== offer.key)); changed(); }} accessibilityRole="button" accessibilityLabel={`Usuń usługę ${serviceLabels[offer.type]}, oferta ${index + 1}`}><MaterialCommunityIcons name="trash-can-outline" size={22} color="#B42318" /></TouchableOpacity></View>
            <Text style={styles.hint}>{serviceDescriptions[offer.type]}</Text>
            <View style={styles.row}><View style={styles.half}><Text style={styles.label}>Czas usługi (min)</Text><TextInput style={styles.input} value={offer.duration} onChangeText={duration => updateOffer(offer.key, { duration })} keyboardType="number-pad" maxLength={4} accessibilityLabel={`Czas usługi ${index + 1} w minutach`} /></View><View style={styles.half}><Text style={styles.label}>Cena (zł)</Text><TextInput style={styles.input} value={offer.price} onChangeText={price => updateOffer(offer.key, { price })} keyboardType="decimal-pad" maxLength={9} placeholder="Np. 35,00" placeholderTextColor="#A98D7B" accessibilityLabel={`Cena usługi ${index + 1} w złotych`} /></View></View>
            <View style={styles.wrap}>{(offer.type === "DAY_CARE" ? [240, 480, 720] : [30, 60, 90]).map(minutes => <TouchableOpacity key={minutes} onPress={() => updateOffer(offer.key, { duration: String(minutes) })} style={[styles.smallChip, Number(offer.duration) === minutes && styles.smallChipActive]} accessibilityRole="button"><Text style={styles.smallChipText}>{minutes >= 120 ? `${minutes / 60} godz.` : `${minutes} min`}</Text></TouchableOpacity>)}</View>
          </View>)}
          {!offers.length ? <View style={styles.empty}><MaterialCommunityIcons name="briefcase-plus-outline" size={28} color="#D35400" /><Text style={styles.body}>Zacznij od dodania pierwszej usługi poniżej.</Text></View> : null}
          <Text style={[styles.label, { marginTop: 16 }]}>Dodaj usługę</Text><View style={styles.wrap}>{(Object.keys(serviceLabels) as SitterServiceType[]).map(type => <TouchableOpacity key={type} style={styles.addService} disabled={offers.length >= 20} onPress={() => { setOffers(current => [...current, newOffer(type)]); changed(); }} accessibilityRole="button" accessibilityLabel={`Dodaj usługę: ${serviceLabels[type]}`}><MaterialCommunityIcons name="plus" size={18} color="#D35400" /><Text style={styles.addServiceText}>{serviceLabels[type]}</Text></TouchableOpacity>)}</View>
          <Text style={[styles.muted, { marginTop: 10 }]}>Możesz dodać kilka wariantów tej samej usługi, np. spacer 30 i 60 minut. Maksymalnie 20 ofert.</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.spaceBetween}><View style={styles.headerCopy}><Text style={styles.cardTitle}>Widoczność oferty</Text><Text style={styles.muted}>{isActive ? "Profil będzie widoczny dla właścicieli." : "Oferta jest wstrzymana. Twoje rezerwacje pozostają dostępne."}</Text></View><Switch value={isActive} onValueChange={value => { setIsActive(value); changed(); }} trackColor={{ false: "#DCCABD", true: "#D35400" }} accessibilityLabel="Widoczność profilu opiekuna" /></View>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPreview(value => !value)} accessibilityRole="button"><Text style={styles.secondaryButtonText}>{preview ? "Ukryj podgląd" : "Zobacz podgląd oferty"}</Text></TouchableOpacity>
          {preview ? <View style={styles.preview}><View style={styles.previewHeader}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.previewAvatar} /> : <MaterialCommunityIcons name="account-heart-outline" size={36} color="#D35400" />}<View style={styles.headerCopy}><Text style={styles.offerTitle}>Twój profil opiekuna</Text><Text style={styles.muted}>{location ? [location.city, location.region && `woj. ${location.region}`].filter(Boolean).join(" · ") : "Wybierz miejscowość"}</Text></View></View><Text style={styles.body}>{bio.trim() || "Tu pojawi się Twój opis."}</Text>{offers.map(offer => <Text key={offer.key} style={[styles.body, { marginTop: 8 }]}>{serviceLabels[offer.type]} · {offer.duration || "—"} min · {offer.price || "—"} zł</Text>)}<Text style={[styles.muted, { marginTop: 10 }]}>Podgląd niezapisanych zmian. W wynikach pojawi się również Twoje imię z konta.</Text></View> : null}
        </View>
      </View>
      {error ? <Text style={styles.statusError} accessibilityRole="alert">{error}</Text> : null}{success ? <Text style={styles.statusSuccess} accessibilityRole="alert">{success}</Text> : null}
      <TouchableOpacity style={[styles.primaryButton, (isSaving || scheduleBusy) && styles.buttonDisabled]} disabled={isSaving || scheduleBusy} onPress={save} accessibilityRole="button">{isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{exists ? "Zapisz zmiany" : "Zapisz profil opiekuna"}</Text>}</TouchableOpacity>
      <Text style={[styles.muted, { marginTop: 8, marginBottom: 20 }]}>Zdjęcie, opis, usługi i widoczność zostaną zapisane po kliknięciu przycisku.</Text>
      {profileId ? <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => router.push({ pathname: "/marketplace/reviews", params: { sitterId: profileId } })}><Text style={styles.secondaryButtonText}>Zobacz moje opinie</Text></TouchableOpacity> : null}
      {exists ? <AvailabilityCalendar title="4. Twój grafik" slots={availability} onChange={setAvailability} disabled={isSaving} onBusyChange={setScheduleBusy} /> : <View style={styles.card}><Text style={styles.cardTitle}>4. Twój grafik</Text><Text style={styles.body}>Najpierw zapisz profil. Następnie wybierz dni w kalendarzu i ustaw godziny dostępności.</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F0" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  cardTitle: { color: "#3D2415", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  divider: { height: 1, backgroundColor: "#F2E4D8", marginVertical: 12 },
  label: { color: "#6F5648", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#F1DED0",
    paddingHorizontal: 14,
    color: "#3D2415",
    fontSize: 14,
    marginBottom: 10
  },
  textArea: { minHeight: 100, paddingTop: 13, textAlignVertical: "top" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7CBB8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF"
  },
  chipActive: { backgroundColor: "#D35400", borderColor: "#D35400" },
  chipText: { color: "#7A3B12", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  muted: { color: "#9A7D6A", fontSize: 12, lineHeight: 17 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  body: { color: "#6F5648", fontSize: 13, lineHeight: 19 },
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
  statusSuccess: { color: "#067647", fontSize: 13, textAlign: "center", marginBottom: 10 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 6
  },
  buttonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  hint: { color: "#8A6D5B", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  counter: { color: "#8A6D5B", fontSize: 11, textAlign: "right" },
  offer: { padding: 14, backgroundColor: "#FFF8F0", borderRadius: 16, borderWidth: 1, borderColor: "#F1DED0", marginTop: 12 },
  offerTitle: { color: "#3D2415", fontWeight: "700", fontSize: 16, marginBottom: 5 },
  smallChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F1DED0" },
  smallChipActive: { backgroundColor: "#FFE2CC", borderColor: "#D35400" },
  smallChipText: { color: "#6F5648", fontSize: 12 },
  addService: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#FFF0E5" },
  addServiceText: { color: "#D35400", fontWeight: "600", fontSize: 13 },
  empty: { alignItems: "center", gap: 10, padding: 20, backgroundColor: "#FFF8F0", borderRadius: 14 },
  preview: { padding: 14, borderWidth: 1, borderColor: "#F1DED0", borderRadius: 14, marginTop: 14 },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  previewAvatar: { width: 56, height: 56, borderRadius: 18 }
});
