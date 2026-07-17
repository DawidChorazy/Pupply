import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, TouchableOpacity, View } from "react-native";

import { ApiError } from "@/services/api-client";
import { addAvailability, createSitterProfile, deleteAvailability, getMySitterProfile, updateSitterProfile } from "@/services/sitters-service";
import { AvailabilitySlot, SitterServiceType } from "@/types/marketplace";
import { marketplaceStyles as styles } from "@/styles/marketplace";
import { formatPolishDateTimeInput, polishDateTimeToIso } from "@/utils/input-masks";

const serviceLabels: Record<SitterServiceType, string> = { DOG_WALK: "Spacer", DROP_IN: "Wizyta domowa", DAY_CARE: "Opieka dzienna" };

export default function SitterProfileScreen() {
  const [exists, setExists] = useState(false);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("52.2297");
  const [longitude, setLongitude] = useState("21.0122");
  const [radius, setRadius] = useState("10");
  const [serviceType, setServiceType] = useState<SitterServiceType>("DOG_WALK");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("40");
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const { profile } = await getMySitterProfile();
        const service = profile.services.find((item) => item.isActive) ?? profile.services[0];
        setExists(true); setBio(profile.bio); setCity(profile.city); setLatitude(String(profile.latitude)); setLongitude(String(profile.longitude)); setRadius(String(profile.serviceRadiusKm)); setAvailability(profile.availability);
        if (service) { setServiceType(service.type); setDuration(String(service.durationMinutes)); setPrice(String(service.priceCents / 100)); }
      } catch (requestError) {
        if (!(requestError instanceof ApiError && requestError.status === 404)) setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać profilu");
      } finally { setIsLoading(false); }
    })();
  }, []);

  const save = async () => {
    const lat = Number(latitude.replace(",", ".")); const lng = Number(longitude.replace(",", ".")); const radiusKm = Number(radius); const durationMinutes = Number(duration); const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (bio.trim().length < 20 || !city.trim() || ![lat, lng, radiusKm, durationMinutes, priceCents].every(Number.isFinite)) { setError("Uzupełnij opis (min. 20 znaków), miasto i prawidłowe liczby"); return; }
    setIsSaving(true); setError(""); setSuccess("");
    const payload = { bio: bio.trim(), city: city.trim(), latitude: lat, longitude: lng, serviceRadiusKm: radiusKm, isActive: true, services: [{ type: serviceType, durationMinutes, priceCents, isActive: true }] };
    try {
      const response = exists ? await updateSitterProfile(payload) : await createSitterProfile(payload);
      setExists(true); setAvailability(response.profile.availability); setSuccess("Profil opiekuna został zapisany");
    } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się zapisać profilu"); }
    finally { setIsSaving(false); }
  };

  const addSlot = async () => {
    const start = polishDateTimeToIso(startsAt); const end = polishDateTimeToIso(endsAt);
    if (!start || !end) { setError("Termin podaj jako DD.MM.RRRR GG:MM"); return; }
    if (new Date(end) <= new Date(start)) { setError("Koniec terminu musi być później niż początek"); return; }
    setError("");
    try { const response = await addAvailability(start, end); setAvailability((current) => [...current, response.slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt))); setStartsAt(""); setEndsAt(""); }
    catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się dodać terminu"); }
  };

  const removeSlot = async (slotId: string) => {
    try { await deleteAvailability(slotId); setAvailability((current) => current.filter((slot) => slot.id !== slotId)); }
    catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Nie udało się usunąć terminu"); }
  };

  if (isLoading) return <View style={[styles.container, styles.center]}><ActivityIndicator color="#D35400" /></View>;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity><View style={styles.headerCopy}><Text style={styles.eyebrow}>Dla opiekuna</Text><Text style={styles.title}>{exists ? "Twój profil" : "Zostań opiekunem"}</Text><Text style={styles.subtitle}>Ustaw ofertę i godziny dostępności.</Text></View></View>
      <View style={styles.card}>
        <Text style={styles.label}>Opis</Text><TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} multiline placeholder="Napisz o swoim doświadczeniu..." placeholderTextColor="#A98D7B" />
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Miasto" placeholderTextColor="#A98D7B" />
        <View style={styles.row}><TextInput style={[styles.input, styles.half]} value={latitude} onChangeText={setLatitude} keyboardType="decimal-pad" placeholder="Szerokość" /><TextInput style={[styles.input, styles.half]} value={longitude} onChangeText={setLongitude} keyboardType="decimal-pad" placeholder="Długość" /></View>
        <TextInput style={styles.input} value={radius} onChangeText={setRadius} keyboardType="number-pad" placeholder="Promień działania (km)" />
        <Text style={styles.label}>Usługa</Text><View style={styles.wrap}>{(Object.keys(serviceLabels) as SitterServiceType[]).map((type) => <TouchableOpacity key={type} style={[styles.chip, serviceType === type && styles.chipActive]} onPress={() => setServiceType(type)}><Text style={[styles.chipText, serviceType === type && styles.chipTextActive]}>{serviceLabels[type]}</Text></TouchableOpacity>)}</View>
        <View style={[styles.row, { marginTop: 12 }]}><TextInput style={[styles.input, styles.half]} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="Minuty" /><TextInput style={[styles.input, styles.half]} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Cena PLN" /></View>
        <TouchableOpacity style={[styles.primaryButton, isSaving && styles.buttonDisabled]} disabled={isSaving} onPress={save}>{isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Zapisz profil</Text>}</TouchableOpacity>
      </View>
      {error ? <Text style={styles.statusError}>{error}</Text> : null}{success ? <Text style={styles.statusSuccess}>{success}</Text> : null}
      {exists ? <View style={styles.card}><Text style={styles.cardTitle}>Dostępność</Text><Text style={styles.muted}>Format: DD.MM.RRRR GG:MM</Text><TextInput style={[styles.input, { marginTop: 12 }]} value={startsAt} onChangeText={(value) => setStartsAt(formatPolishDateTimeInput(value))} placeholder="Od, np. 20.07.2026 10:00" placeholderTextColor="#A98D7B" keyboardType="number-pad" maxLength={16} /><TextInput style={styles.input} value={endsAt} onChangeText={(value) => setEndsAt(formatPolishDateTimeInput(value))} placeholder="Do, np. 20.07.2026 12:00" placeholderTextColor="#A98D7B" keyboardType="number-pad" maxLength={16} /><TouchableOpacity style={styles.secondaryButton} onPress={addSlot}><Text style={styles.secondaryButtonText}>Dodaj termin</Text></TouchableOpacity><View style={styles.divider} />{availability.length === 0 ? <Text style={styles.muted}>Brak dodanych terminów.</Text> : availability.map((slot) => <View key={slot.id} style={styles.spaceBetween}><Text style={styles.body}>{new Date(slot.startsAt).toLocaleString("pl-PL")} – {new Date(slot.endsAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</Text><TouchableOpacity onPress={() => removeSlot(slot.id)}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#B42318" /></TouchableOpacity></View>)}</View> : null}
    </ScrollView>
  );
}
