import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { ScheduleCalendar } from "@/components/forms/schedule-calendar";
import { TimePicker } from "@/components/forms/time-picker";
import { ApiError } from "@/services/api-client";
import { addAvailabilityBatch, deleteAvailability, getMySchedule, updateAvailability } from "@/services/sitters-service";
import { marketplaceStyles as styles } from "@/styles/marketplace";
import { AvailabilitySlot, ScheduleBooking } from "@/types/marketplace";
import { addDays, buildSchedule, calendarWindow, dateKey, dayLabel, formatTime, freeRanges, intersectsDay, localDate, scheduleDates, timeLabel, WEEKDAYS } from "./calendar-utils";

const serviceLabels = { DOG_WALK: "Spacer", DROP_IN: "Wizyta domowa", DAY_CARE: "Opieka dzienna" };
const blocking = (booking: ScheduleBooking) => ["REQUESTED", "ACCEPTED"].includes(booking.status);
const rangeLabel = (range: { startsAt: string; endsAt: string }, day: string) => {
  const start = Math.max(Date.parse(range.startsAt), localDate(day).getTime());
  const end = Math.min(Date.parse(range.endsAt), localDate(addDays(day, 1)).getTime());
  return `${formatTime(new Date(start).toISOString())}–${end === localDate(addDays(day, 1)).getTime() ? "24:00" : formatTime(new Date(end).toISOString())}`;
};

export function AvailabilityCalendar({ slots, onChange, disabled = false, onBusyChange, title = "Twój grafik" }: {
  slots: AvailabilitySlot[]; onChange: (slots: AvailabilitySlot[]) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void; title?: string;
}) {
  const [day, setDay] = useState(dateKey(new Date()));
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [month, setMonth] = useState(dateKey(new Date()).slice(0, 7));
  const [start, setStart] = useState(9 * 60), [end, setEnd] = useState(17 * 60);
  const [repeat, setRepeat] = useState(false), [weeks, setWeeks] = useState(2);
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4]);
  const [pause, setPause] = useState(false), [pauseStart, setPauseStart] = useState(12 * 60), [pauseEnd, setPauseEnd] = useState(13 * 60);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const locked = disabled || busy;
  const now = new Date();
  const bookings = slots.flatMap(slot => slot.bookings ?? []).filter(blocking);
  const daySlots = slots.filter(slot => intersectsDay(slot, day));
  const dayBookings = bookings.filter(booking => intersectsDay(booking, day)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days = editing ? [day] : repeat ? scheduleDates(day, weekdays, weeks) : selectedDays;
  const clearMessage = () => { setError(""); setSuccess(""); };
  const selectDay = (value: string) => {
    setDay(value); setRemoving(null); clearMessage();
    if (repeat || value < dateKey(now)) return;
    if (!selectedDays.includes(value) && selectedDays.length >= 28) { setError("Jednym zapisem możesz ustawić maksymalnie 28 dni."); return; }
    setSelectedDays(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value].sort());
  };

  const refresh = async (visibleMonth = month) => {
    setBusy(true); clearMessage();
    try {
      const window = calendarWindow(visibleMonth);
      const response = await getMySchedule(window);
      // Keep other explicitly loaded months so multi-selection can cross months.
      onChange([...slots.filter(slot => Date.parse(slot.endsAt) <= Date.parse(window.from) || Date.parse(slot.startsAt) >= Date.parse(window.to)), ...response.slots]
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }
    catch (err) { setError(err instanceof ApiError ? err.message : "Nie udało się odświeżyć grafiku."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (locked) return;
    clearMessage();
    let ranges;
    try {
      ranges = buildSchedule(days, start, end, pause && !editing ? { start: pauseStart, end: pauseEnd } : undefined);
      for (const range of ranges) {
        if (slots.some(slot => slot.id !== editing && Date.parse(slot.startsAt) < Date.parse(range.endsAt) && Date.parse(slot.endsAt) > Date.parse(range.startsAt))) {
          throw new Error(`Termin ${dayLabel(dateKey(new Date(range.startsAt)))} nakłada się na zapisane godziny. Edytuj istniejący przedział lub wybierz inne godziny.`);
        }
      }
    } catch (err) { setError((err as Error).message); return; }
    setBusy(true);
    try {
      if (editing) {
        const { slot } = await updateAvailability(editing, ranges[0].startsAt, ranges[0].endsAt);
        onChange(slots.map(item => item.id === editing ? slot : item).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
        setEditing(null); setSuccess("Zmieniono godziny dostępności.");
      } else {
        const response = await addAvailabilityBatch(ranges);
        onChange([...slots, ...response.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
        setSuccess(`Zapisano grafik: ${days.length} ${days.length === 1 ? "dzień" : "dni"}, ${timeLabel(start)}–${timeLabel(end)}${pause ? `, przerwa ${timeLabel(pauseStart)}–${timeLabel(pauseEnd)}` : ""}.`);
      }
    } catch (err) { setError(err instanceof ApiError ? err.message : "Nie udało się zapisać grafiku. Spróbuj ponownie."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (locked) return;
    clearMessage(); setBusy(true);
    try { await deleteAvailability(id); onChange(slots.filter(slot => slot.id !== id)); setRemoving(null); setSuccess("Usunięto przedział. Te godziny nie są już dostępne do rezerwacji."); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Nie udało się usunąć terminu."); }
    finally { setBusy(false); }
  };
  const edit = (slot: AvailabilitySlot) => {
    const from = new Date(slot.startsAt), to = new Date(slot.endsAt);
    setDay(dateKey(from)); setStart(from.getHours() * 60 + from.getMinutes());
    setEnd(dateKey(to) !== dateKey(from) ? 1440 : to.getHours() * 60 + to.getMinutes());
    setEditing(slot.id); setRemoving(null); clearMessage();
  };

  return <View style={styles.card}>
    <View style={styles.spaceBetween}><View style={styles.headerCopy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>Zaznacz kilka dni i ustaw im wspólne godziny.</Text></View><TouchableOpacity style={s.iconButton} accessibilityRole="button" accessibilityLabel="Odśwież grafik" disabled={locked} onPress={() => void refresh()}><MaterialCommunityIcons name="refresh" size={22} color="#D35400" /></TouchableOpacity></View>
    <ScheduleCalendar value={day} values={editing ? [day] : repeat ? days : selectedDays} disabled={locked || Boolean(editing)} onChange={selectDay} onMonthChange={value => { setMonth(value); void refresh(value); }} getMark={key => ({
      available: slots.some(slot => freeRanges(slot, (slot.bookings ?? []).filter(blocking), now).some(range => intersectsDay(range, key))),
      booked: bookings.some(booking => intersectsDay(booking, key))
    })} />
    {!editing && !repeat ? <View style={s.selection}>
      <View style={styles.spaceBetween}><Text style={s.windowTitle}>Zaznaczone dni: {selectedDays.length}</Text><TouchableOpacity disabled={locked || !selectedDays.length} accessibilityRole="button" onPress={() => { setSelectedDays([]); clearMessage(); }}><Text style={styles.secondaryButtonText}>Wyczyść wybór</Text></TouchableOpacity></View>
      <Text style={styles.muted}>Kliknij dzień, aby go dodać lub odznaczyć. Te same godziny zapiszesz dla wszystkich zaznaczonych dni.</Text>
      <View style={styles.wrap}>{selectedDays.map(key => <TouchableOpacity key={key} style={styles.chip} disabled={locked} accessibilityRole="button" accessibilityLabel={`Odznacz ${dayLabel(key)}`} onPress={() => { setSelectedDays(current => current.filter(item => item !== key)); clearMessage(); }}><Text style={styles.chipText}>{localDate(key).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} ×</Text></TouchableOpacity>)}</View>
    </View> : null}
    <View style={[styles.wrap, { marginTop: 12 }]}><Text style={s.legendFree}>● Wolne godziny</Text><Text style={s.legendBooked}>● Rezerwacje</Text></View>
    <View style={styles.divider} />
    <Text style={s.dayTitle}>{dayLabel(day)}</Text>
    {daySlots.length === 0 ? <View style={s.empty}><MaterialCommunityIcons name="calendar-blank-outline" size={24} color="#A98D7B" /><Text style={styles.muted}>Dzień wolny · brak ustawionej dostępności</Text></View> : daySlots.map(slot => {
      const free = freeRanges(slot, (slot.bookings ?? []).filter(blocking), now).filter(range => intersectsDay(range, day));
      const hasActiveBookings = Boolean(slot.bookings?.some(booking => blocking(booking) && Date.parse(booking.endsAt) > now.getTime()));
      const fromDay = dateKey(new Date(slot.startsAt));
      const singleDay = dateKey(new Date(Date.parse(slot.endsAt) - 1)) === fromDay;
      return <View key={slot.id} style={s.availability}>
        <View style={styles.spaceBetween}><View style={styles.headerCopy}><Text style={s.windowTitle}>{rangeLabel(slot, day)}</Text><Text style={styles.muted}>Godziny przyjmowania rezerwacji</Text></View>
          {singleDay && Date.parse(slot.startsAt) > now.getTime() ? <TouchableOpacity style={s.iconButton} disabled={locked} accessibilityRole="button" accessibilityLabel={`Edytuj godziny ${rangeLabel(slot, day)}`} onPress={() => edit(slot)}><MaterialCommunityIcons name="pencil-outline" size={20} color="#7A3B12" /></TouchableOpacity> : null}
          {!hasActiveBookings ? <TouchableOpacity style={s.iconButton} disabled={locked || Boolean(editing)} accessibilityRole="button" accessibilityLabel={`Usuń godziny ${rangeLabel(slot, day)}`} onPress={() => { setRemoving(slot.id); clearMessage(); }}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#B42318" /></TouchableOpacity> : null}
        </View>
        {free.length ? <Text style={s.legendFree}>Wolne: {free.map(range => rangeLabel(range, day)).join(", ")}</Text> : <Text style={styles.muted}>{Date.parse(slot.endsAt) <= now.getTime() ? "Termin minął" : "Brak wolnych godzin w tym przedziale"}</Text>}
        {hasActiveBookings ? <Text style={styles.muted}>Aktywne rezerwacje są chronione przed zmianą godzin.</Text> : null}
        {removing === slot.id ? <View style={{ marginTop: 8 }}><Text style={styles.body}>Usunąć ten przedział z grafiku?{!singleDay ? " Usunięty zostanie cały przedział, również w pozostałe dni." : ""}</Text><View style={styles.row}><TouchableOpacity style={[styles.secondaryButton, styles.dangerButton, styles.half]} disabled={locked} accessibilityRole="button" onPress={() => remove(slot.id)}><Text style={styles.dangerButtonText}>Usuń przedział</Text></TouchableOpacity><TouchableOpacity style={[styles.secondaryButton, styles.half]} disabled={locked} accessibilityRole="button" onPress={() => setRemoving(null)}><Text style={styles.secondaryButtonText}>Zostaw</Text></TouchableOpacity></View></View> : null}
      </View>;
    })}
    {dayBookings.map(booking => <TouchableOpacity key={booking.id} style={s.booking} disabled={locked} accessibilityRole="button" accessibilityLabel={`Rezerwacja ${booking.pet.name}, ${rangeLabel(booking, day)}`} onPress={() => router.push("/marketplace/bookings" as never)}>
      <View style={styles.spaceBetween}><Text style={s.bookingTime}>{rangeLabel(booking, day)}</Text><Text style={s.bookingStatus}>{booking.status === "REQUESTED" ? "Oczekuje" : "Potwierdzona"}</Text></View><Text style={s.windowTitle}>{booking.pet.name} · {serviceLabels[booking.sitterService.type]}</Text>
    </TouchableOpacity>)}
    <View style={styles.divider} />
    <View style={styles.spaceBetween}><Text style={styles.cardTitle}>{editing ? "Zmień godziny" : "Zaplanuj dostępność"}</Text>{editing ? <TouchableOpacity accessibilityRole="button" disabled={locked} onPress={() => { setEditing(null); clearMessage(); }}><Text style={styles.secondaryButtonText}>Anuluj edycję</Text></TouchableOpacity> : null}</View>
    <Text style={[styles.muted, { marginBottom: 12 }]}>{editing ? "Nowe godziny muszą obejmować aktywne rezerwacje. Anulowane wizyty nie blokują zmian." : `Wspólne godziny dla ${days.length} ${days.length === 1 ? "zaznaczonego dnia" : "zaznaczonych dni"}. Właściciele wybiorą długość opieki w tym przedziale.`}</Text>
    {!editing ? <View style={[styles.wrap, { marginBottom: 14 }]}>{[{ label: "Rano", start: 8 * 60, end: 12 * 60 }, { label: "Popołudnie", start: 14 * 60, end: 18 * 60 }, { label: "Cały dzień", start: 9 * 60, end: 17 * 60 }].map(preset => <TouchableOpacity key={preset.label} accessibilityRole="button" disabled={locked} style={styles.chip} onPress={() => { setStart(preset.start); setEnd(preset.end); setPause(false); clearMessage(); }}><Text style={styles.chipText}>{preset.label} {timeLabel(preset.start)}–{timeLabel(preset.end)}</Text></TouchableOpacity>)}</View> : null}
    <View style={styles.row}><TimePicker label="Początek pracy" value={start} onChange={value => { setStart(value); clearMessage(); }} disabled={locked} /><TimePicker label="Koniec pracy" value={end} onChange={value => { setEnd(value); clearMessage(); }} disabled={locked} allowMidnight /></View>
    {!editing ? <>
      <View style={s.setting}><View style={styles.headerCopy}><Text style={s.windowTitle}>Przerwa w ciągu dnia</Text><Text style={styles.muted}>W tym czasie nikt nie zarezerwuje opieki.</Text></View><Switch value={pause} disabled={locked} onValueChange={value => { setPause(value); clearMessage(); }} trackColor={{ false: "#DCCABD", true: "#D35400" }} accessibilityLabel="Dodaj przerwę" /></View>
      {pause ? <View style={styles.row}><TimePicker label="Początek przerwy" value={pauseStart} onChange={value => { setPauseStart(value); clearMessage(); }} disabled={locked} /><TimePicker label="Koniec przerwy" value={pauseEnd} onChange={value => { setPauseEnd(value); clearMessage(); }} disabled={locked} /></View> : null}
      <View style={s.setting}><View style={styles.headerCopy}><Text style={s.windowTitle}>Powtórz w wybrane dni</Text><Text style={styles.muted}>Ustaw godziny raz na kilka tygodni.</Text></View><Switch value={repeat} disabled={locked} onValueChange={value => { setRepeat(value); clearMessage(); }} trackColor={{ false: "#DCCABD", true: "#D35400" }} accessibilityLabel="Powtarzaj grafik" /></View>
      {repeat ? <View style={s.repeat}>
        <Text style={styles.label}>Dni tygodnia</Text><View style={styles.wrap}>{WEEKDAYS.map((label, index) => <TouchableOpacity key={label} style={[styles.chip, weekdays.includes(index) && styles.chipActive]} disabled={locked} accessibilityRole="button" accessibilityLabel={`Powtarzaj: ${label}`} accessibilityState={{ selected: weekdays.includes(index) }} onPress={() => { setWeekdays(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index]); clearMessage(); }}><Text style={[styles.chipText, weekdays.includes(index) && styles.chipTextActive]}>{label}</Text></TouchableOpacity>)}</View>
        <Text style={[styles.label, { marginTop: 14 }]}>Okres od wybranej daty</Text><View style={styles.wrap}>{[1, 2, 4].map(count => <TouchableOpacity key={count} style={[styles.chip, weeks === count && styles.chipActive]} disabled={locked} accessibilityRole="button" accessibilityState={{ selected: weeks === count }} onPress={() => { setWeeks(count); clearMessage(); }}><Text style={[styles.chipText, weeks === count && styles.chipTextActive]}>{count === 1 ? "1 tydzień" : `${count} tygodnie`}</Text></TouchableOpacity>)}</View>
        <Text style={[styles.muted, { marginTop: 12 }]}>Od {localDate(day).toLocaleDateString("pl-PL")} do {localDate(addDays(day, weeks * 7 - 1)).toLocaleDateString("pl-PL")} · {days.length} dni. Grafik nie przedłuża się automatycznie.</Text>
      </View> : null}
    </> : null}
    {error ? <Text style={[styles.statusError, { marginTop: 14 }]} accessibilityRole="alert">{error}</Text> : null}
    {success ? <Text style={[styles.statusSuccess, { marginTop: 14 }]} accessibilityRole="alert">{success}</Text> : null}
    <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }, (locked || !days.length) && styles.buttonDisabled]} accessibilityRole="button" disabled={locked || !days.length} onPress={save}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{editing ? "Zapisz godziny" : `Dodaj grafik · ${days.length} ${days.length === 1 ? "dzień" : "dni"}`}</Text>}</TouchableOpacity>
    <Text style={[styles.muted, { marginTop: 8 }]}>Grafik zapisuje się od razu. Rezerwacje automatycznie zajmują czas w kalendarzu.</Text>
  </View>;
}

const s = StyleSheet.create({
  iconButton: { minWidth: 40, minHeight: 44, alignItems: "center", justifyContent: "center" },
  legendFree: { color: "#16815D", fontSize: 12, lineHeight: 19 }, legendBooked: { color: "#9A5B12", fontSize: 12, lineHeight: 19 },
  dayTitle: { color: "#3D2415", fontSize: 16, fontWeight: "800", textTransform: "capitalize", marginBottom: 12 },
  empty: { alignItems: "center", padding: 20, gap: 8, borderRadius: 14, backgroundColor: "#FFF8F0", marginBottom: 8 },
  availability: { borderWidth: 1, borderColor: "#CCE7DA", backgroundColor: "#F5FBF8", borderRadius: 14, padding: 12, marginBottom: 10, gap: 6 },
  windowTitle: { color: "#3D2415", fontSize: 13, fontWeight: "700", lineHeight: 20 },
  booking: { backgroundColor: "#FFF3DF", borderLeftWidth: 4, borderLeftColor: "#B3630C", padding: 12, borderRadius: 12, marginBottom: 8 },
  bookingTime: { color: "#7A3B12", fontSize: 13, fontWeight: "800" }, bookingStatus: { color: "#9A5B12", fontSize: 11, fontWeight: "700" },
  setting: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  repeat: { padding: 12, borderRadius: 14, backgroundColor: "#FFF8F0" },
  selection: { gap: 10, backgroundColor: "#FFF8F0", padding: 12, borderRadius: 14, marginTop: 12 }
});
