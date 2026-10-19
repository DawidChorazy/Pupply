import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ScheduleCalendar } from "@/components/forms/schedule-calendar";
import { addDays, bookingPrice, bookableTimes, calendarWindow, commonBookableTimes, dateKey, dayLabel, durationLabel, formatTime, localDate } from "@/features/scheduling/calendar-utils";
import { ApiError } from "@/services/api-client";
import { createBooking, createBookings, recoverPendingBookings } from "@/services/bookings-service";
import { getAccessToken } from "@/services/auth-storage";
import { listPets } from "@/services/pets-service";
import { getSitterAvailability } from "@/services/sitters-service";
import { AvailabilitySlot, SitterService } from "@/types/marketplace";
import { Pet } from "@/types/pets";
import { marketplaceStyles as styles } from "@/styles/marketplace";

const labels = { DOG_WALK: "Spacer", DROP_IN: "Wizyta domowa", DAY_CARE: "Opieka dzienna" };

export default function BookScreen() {
  const params = useLocalSearchParams<{ sitterId?: string; sitterName?: string; sitterServiceId?: string }>();
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [service, setService] = useState<SitterService | null>(null);
  const [day, setDay] = useState(dateKey(new Date()));
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [now, setNow] = useState(new Date());
  const revision = useRef(0);
  const month = useRef(dateKey(new Date()).slice(0, 7));
  const cachedAvailability = useRef<AvailabilitySlot[]>([]);
  const selectedDates = useRef(selectedDays);
  useEffect(() => { selectedDates.current = selectedDays; }, [selectedDays]);

  const loadSchedule = useCallback(async () => {
    const current = ++revision.current;
    setScheduleLoading(true); setScheduleError(""); setSelectedTime(null);
    try {
      if (!params.sitterId || !params.sitterServiceId) throw new Error("Wybierz opiekuna i usługę w wyszukiwarce, aby zobaczyć kalendarz.");
      if (await recoverPendingBookings()) { router.replace("/marketplace/bookings" as never); return; }
      const months = [...new Set([month.current, ...selectedDates.current.map(key => key.slice(0, 7))])];
      let cache = cachedAvailability.current;
      let response: Awaited<ReturnType<typeof getSitterAvailability>> | undefined;
      for (const visibleMonth of months) {
        const window = calendarWindow(visibleMonth);
        const loaded = await getSitterAvailability(params.sitterId, params.sitterServiceId, window);
        if (current !== revision.current) return;
        cache = [...cache.filter(slot => Date.parse(slot.endsAt) <= Date.parse(window.from) || Date.parse(slot.startsAt) >= Date.parse(window.to)), ...loaded.availability];
        if (visibleMonth === month.current) response = loaded;
      }
      if (!response) return;
      cachedAvailability.current = cache;
      if (current !== revision.current) return;
      const loadedAt = new Date();
      setNow(loadedAt); setService(response.service); setAvailability(cache);
      setDuration(current => current >= response.service.durationMinutes ? current : response.service.durationMinutes);
      const first = response.availability.flatMap(slot => {
        const key = dateKey(new Date(slot.startsAt));
        return [key, addDays(key, 1)].flatMap(date => bookableTimes([slot], date, response.service.durationMinutes, loadedAt));
      }).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      if (first) {
        const firstDay = dateKey(new Date(first.startsAt));
        setDay(firstDay); setSelectedDays(current => current.length ? current : [firstDay]);
      } else setDay(`${month.current}-01`);
    } catch (err) {
      if (current === revision.current) { setAvailability([]); setService(null); setScheduleError(err instanceof Error ? err.message : "Nie udało się pobrać terminów."); }
    } finally { if (current === revision.current) setScheduleLoading(false); }
  }, [params.sitterId, params.sitterServiceId]);

  useFocusEffect(useCallback(() => { void loadSchedule(); return () => { revision.current += 1; }; }, [loadSchedule]));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new ApiError("Zaloguj się ponownie", 401);
        const response = await listPets(token);
        if (active) { setPets(response.pets); setPetId(response.pets[0]?.id ?? ""); }
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : "Nie udało się pobrać pupili");
      } finally { if (active) setIsLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const durationMinutes = duration || service?.durationMinutes || 30;
  const times = service ? commonBookableTimes(availability, selectedDays, durationMinutes, now) : [];
  const selection = times.find(time => time.time === selectedTime);
  const validSelection = Boolean(selection?.bookings.length);
  const priceCents = service ? bookingPrice(service.priceCents, service.durationMinutes, durationMinutes) : 0;
  const totalPriceCents = priceCents * selectedDays.length;
  const visitLabel = selectedDays.length === 1 ? "wizyta"
    : selectedDays.length % 10 >= 2 && selectedDays.length % 10 <= 4 && (selectedDays.length % 100 < 12 || selectedDays.length % 100 > 14) ? "wizyty" : "wizyt";
  const changeDuration = (minutes: number) => { setDuration(minutes); setSelectedTime(null); setError(""); };
  const selectDay = (value: string) => {
    setDay(value); setSelectedTime(null); setError("");
    if (!selectedDays.includes(value) && selectedDays.length >= 28) { setError("Jednorazowo możesz zarezerwować maksymalnie 28 dni."); return; }
    setSelectedDays(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value].sort());
  };
  const submit = async () => {
    if (isSubmitting) return;
    if (!petId || !params.sitterServiceId || !selection || selection.bookings.some(time => Date.parse(time.startsAt) <= Date.now())) {
      setError(pets.length ? "Zaznacz dni i wybierz wspólną wolną godzinę w kalendarzu." : "Najpierw dodaj pupila");
      return;
    }
    setIsSubmitting(true); setError("");
    try {
      const shared = { petId, sitterServiceId: params.sitterServiceId, durationMinutes, expectedPriceCents: priceCents, note: note.trim() || undefined };
      if (selection.bookings.length === 1) {
        const time = selection.bookings[0];
        await createBooking({ ...shared, availabilitySlotId: time.slotId, startsAt: time.startsAt });
      } else {
        await createBookings({ ...shared, slots: selection.bookings.map(time => ({ availabilitySlotId: time.slotId, startsAt: time.startsAt })) });
      }
      router.replace("/marketplace/bookings" as never);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await loadSchedule();
        setError(err.code === "PRICE_CHANGED" ? err.message : "Nie udało się zarezerwować wybranych terminów. Nie zapisano nowych rezerwacji. Kalendarz został odświeżony — sprawdź dni i wybierz wolną godzinę.");
      } else setError(err instanceof ApiError ? err.message : "Nie udało się utworzyć rezerwacji");
    } finally { setIsSubmitting(false); }
  };

  return <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} accessibilityRole="button" accessibilityLabel="Wróć" onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>Rezerwacja</Text><Text style={styles.title}>Umów opiekę</Text><Text style={styles.subtitle}>{params.sitterName ?? "Wybrany opiekun"}</Text></View>
    </View>
    <View style={styles.card}>
      <View style={styles.spaceBetween}><View style={styles.headerCopy}><Text style={styles.cardTitle}>Wybierz termin</Text><Text style={styles.muted}>{service ? `${labels[service.type]} · ${(service.priceCents / 100).toFixed(2)} zł / ${durationLabel(service.durationMinutes)}` : "Wolne godziny opiekuna"}</Text></View><TouchableOpacity style={local.refresh} disabled={scheduleLoading || isSubmitting} accessibilityRole="button" accessibilityLabel="Odśwież wolne terminy" onPress={loadSchedule}><MaterialCommunityIcons name="refresh" size={22} color="#D35400" /></TouchableOpacity></View>
      {scheduleLoading ? <View style={styles.center}><ActivityIndicator color="#D35400" /><Text style={styles.muted}>Sprawdzam dostępność…</Text></View> : scheduleError ? <View><Text style={[styles.statusError, { marginTop: 14 }]} accessibilityRole="alert">{scheduleError}</Text><TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={loadSchedule}><Text style={styles.secondaryButtonText}>Spróbuj ponownie</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={() => router.push("/marketplace/sitters" as never)}><Text style={styles.secondaryButtonText}>Wybierz opiekuna</Text></TouchableOpacity></View> : service ? <>
        <Text style={[styles.label, { marginTop: 16 }]}>Jak długo ma trwać opieka?</Text>
        <View style={styles.wrap}>{[1, 2, 3, 4].map(multiplier => service.durationMinutes * multiplier).filter(minutes => minutes <= 1440).map(minutes => <TouchableOpacity key={minutes} style={[styles.chip, durationMinutes === minutes && styles.chipActive]} disabled={isSubmitting} accessibilityRole="button" accessibilityLabel={`Czas opieki: ${durationLabel(minutes)}`} accessibilityState={{ selected: durationMinutes === minutes }} onPress={() => changeDuration(minutes)}><Text style={[styles.chipText, durationMinutes === minutes && styles.chipTextActive]}>{durationLabel(minutes)}</Text></TouchableOpacity>)}</View>
        <View style={local.durationRow}>
          <TouchableOpacity style={local.step} disabled={isSubmitting || durationMinutes <= service.durationMinutes} accessibilityRole="button" accessibilityLabel="Skróć opiekę o 15 minut" onPress={() => changeDuration(Math.max(service.durationMinutes, durationMinutes - 15))}><MaterialCommunityIcons name="minus" size={20} color={durationMinutes <= service.durationMinutes ? "#CDB9AB" : "#D35400"} /></TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}><Text style={local.duration}>{durationLabel(durationMinutes)}</Text><Text style={styles.price}>{(priceCents / 100).toFixed(2)} zł za wizytę</Text></View>
          <TouchableOpacity style={local.step} disabled={isSubmitting || durationMinutes >= 1440} accessibilityRole="button" accessibilityLabel="Wydłuż opiekę o 15 minut" onPress={() => changeDuration(Math.min(1440, durationMinutes + 15))}><MaterialCommunityIcons name="plus" size={20} color={durationMinutes >= 1440 ? "#CDB9AB" : "#D35400"} /></TouchableOpacity>
        </View>
        <Text style={[styles.muted, { marginBottom: 12 }]}>Cena rośnie proporcjonalnie do czasu. Minimalny czas: {durationLabel(service.durationMinutes)}.</Text>
        <Text style={styles.label}>Zaznacz dni opieki</Text><Text style={[styles.muted, { marginBottom: 8 }]}>Kliknij kilka dni. Poniżej wybierzesz wspólną godzinę dla wszystkich.</Text>
        <ScheduleCalendar key={`${params.sitterId}:${params.sitterServiceId}`} value={day} values={selectedDays} disabled={isSubmitting} minDate={dateKey(now)} isDayAvailable={key => bookableTimes(availability, key, durationMinutes, now).length > 0} onChange={selectDay} onMonthChange={value => { month.current = value; void loadSchedule(); }} />
        <View style={[styles.spaceBetween, { marginVertical: 12 }]}><Text style={styles.label}>Zaznaczone dni: {selectedDays.length}</Text><TouchableOpacity disabled={isSubmitting || !selectedDays.length} accessibilityRole="button" onPress={() => { setSelectedDays([]); setSelectedTime(null); setError(""); }}><Text style={styles.secondaryButtonText}>Wyczyść wybór</Text></TouchableOpacity></View>
        <View style={styles.wrap}>{selectedDays.map(key => <TouchableOpacity key={key} style={styles.chip} disabled={isSubmitting} accessibilityRole="button" accessibilityLabel={`Odznacz ${dayLabel(key)}`} onPress={() => selectDay(key)}><Text style={styles.chipText}>{localDate(key).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} ×</Text></TouchableOpacity>)}</View>
        <View style={styles.divider} /><Text style={local.day}>{selectedDays.length === 1 ? dayLabel(selectedDays[0]) : "Wspólne godziny opieki"}</Text><Text style={[styles.muted, { marginBottom: 12 }]}>Cała opieka musi zmieścić się w wolnym czasie każdego wybranego dnia, bez przerw i innych rezerwacji.</Text>
        {!times.length ? <Text style={styles.body}>{selectedDays.length ? "Brak wspólnej godziny dla tych dni i długości opieki. Skróć czas lub odznacz część dni." : "Zaznacz co najmniej jeden dzień w kalendarzu."}</Text> : <View style={styles.wrap}>{times.map(choice => {
          const time = choice.bookings[0], active = selectedTime === choice.time;
          return <TouchableOpacity key={choice.time} style={[local.time, active && styles.chipActive]} disabled={isSubmitting} accessibilityRole="button" accessibilityLabel={`Termin ${formatTime(time.startsAt)}–${formatTime(time.endsAt)}`} accessibilityState={{ selected: active }} onPress={() => { setSelectedTime(choice.time); setError(""); }}><Text style={[styles.chipText, active && styles.chipTextActive]}>{choice.time}</Text></TouchableOpacity>;
        })}</View>}
        <View style={local.summary}>
          <MaterialCommunityIcons name="calendar-check-outline" size={22} color="#16815D" />
          <View style={{ flex: 1 }}><Text style={local.summaryText}>{selectedDays.length} {visitLabel} × {durationLabel(durationMinutes)} · {(priceCents / 100).toFixed(2)} zł za wizytę</Text><Text style={local.total}>Łącznie: {(totalPriceCents / 100).toFixed(2)} zł</Text>{selection ? <Text style={local.summaryText}>Każdego dnia {selection.time}–{formatTime(selection.bookings[0].endsAt)}</Text> : null}</View>
        </View>

      </> : null}
    </View>
    <View style={styles.card}>
      <Text style={styles.label}>Wybierz pupila</Text>
      {isLoading ? <ActivityIndicator color="#D35400" /> : <View style={styles.wrap}>{pets.map(pet => <TouchableOpacity key={pet.id} style={[styles.chip, petId === pet.id && styles.chipActive]} disabled={isSubmitting} accessibilityRole="button" accessibilityState={{ selected: petId === pet.id }} onPress={() => setPetId(pet.id)}><Text style={[styles.chipText, petId === pet.id && styles.chipTextActive]}>{pet.name}</Text></TouchableOpacity>)}</View>}
      {!isLoading && !pets.length ? <><Text style={styles.muted}>Nie masz jeszcze dodanego pupila.</Text><TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={() => router.push("/mainScreen/AddDogScreen" as never)}><Text style={styles.secondaryButtonText}>Dodaj pupila</Text></TouchableOpacity></> : null}
      <Text style={[styles.label, { marginTop: 18 }]}>Wiadomość do opiekuna</Text>
      <TextInput style={[styles.input, styles.textArea]} value={note} onChangeText={setNote} editable={!isSubmitting} multiline maxLength={1000} placeholder="Ważne informacje, potrzeby pupila..." placeholderTextColor="#A98D7B" accessibilityLabel="Wiadomość do opiekuna" />
    </View>
    {error ? <View><Text style={styles.statusError} accessibilityRole="alert">{error}</Text>{error.includes("email") || error.includes("e-mail") ? <TouchableOpacity onPress={() => router.push("/verify-email" as never)}><Text style={styles.secondaryButtonText}>Potwierdź e-mail</Text></TouchableOpacity> : null}</View> : null}
    <TouchableOpacity style={[styles.primaryButton, (isSubmitting || !pets.length || !validSelection || scheduleLoading) && styles.buttonDisabled]} disabled={isSubmitting || !pets.length || !validSelection || scheduleLoading} accessibilityRole="button" onPress={submit}>{isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Wyślij prośbę o rezerwację</Text>}</TouchableOpacity>
  </ScrollView>;
}

const local = StyleSheet.create({
  durationRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14 },
  duration: { color: "#3D2415", fontSize: 18, fontWeight: "800", marginBottom: 4 },
  step: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8F0", borderWidth: 1, borderColor: "#F1DED0", borderRadius: 12 },
  total: { color: "#16815D", fontSize: 19, fontWeight: "800", marginVertical: 4 },
  refresh: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  day: { color: "#3D2415", fontSize: 16, fontWeight: "800", textTransform: "capitalize", marginBottom: 6 },
  time: { minWidth: 66, minHeight: 44, borderWidth: 1, borderColor: "#E7CBB8", borderRadius: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8F0" },
  summary: { backgroundColor: "#F0FAF4", borderRadius: 14, padding: 12, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  summaryText: { color: "#16815D", fontSize: 13, lineHeight: 20, fontWeight: "700", flex: 1 }
});
