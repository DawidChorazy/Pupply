import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { AvailabilitySlot } from "@/features/marketplace/types/marketplace";
import { addAvailabilityBatch, updateAvailability } from "@/features/marketplace/services/sitters-service";
import { marketplaceStyles as styles } from "@/features/marketplace/styles/marketplace";
import { ApiError } from "@/shared/api/api-client";
import { getSessionRevision } from "@/shared/session/session-events";
import { addDays, buildSchedule, dateKey, dayLabel, intersectsDay, localDate, MAX_DAILY_BREAKS, ScheduleBreak, scheduleDates, suggestScheduleBreak, timeLabel, TIME_STEP, WEEKDAYS } from "./calendar-utils";
import { TimePicker } from "./TimePicker";

type Props = {
  day: string; selectedDays: string[]; slots: AvailabilitySlot[]; editing: AvailabilitySlot | null;
  onClose: () => void; onSaved: (slots: AvailabilitySlot[], days: string[]) => void;
};

function initialHours(day: string, slots: AvailabilitySlot[], editing: AvailabilitySlot | null) {
  if (editing) {
    const from = new Date(editing.startsAt), to = new Date(editing.endsAt);
    return { start: from.getHours() * 60 + from.getMinutes(), end: dateKey(to) !== dateKey(from) ? 1440 : to.getHours() * 60 + to.getMinutes() };
  }
  const now = new Date();
  const earliest = day === dateKey(now) ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / TIME_STEP) * TIME_STEP : 0;
  // Prefer ordinary daytime hours, then any remaining gap in this civil day.
  const occupied = slots.filter(slot => intersectsDay(slot, day))
    .map(slot => ({ start: dateKey(new Date(slot.startsAt)) < day ? 0 : new Date(slot.startsAt).getHours() * 60 + new Date(slot.startsAt).getMinutes(),
      end: dateKey(new Date(slot.endsAt)) !== day ? 1440 : new Date(slot.endsAt).getHours() * 60 + new Date(slot.endsAt).getMinutes() }))
    .sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let cursor = earliest;
  for (const range of occupied) { if (range.start > cursor) gaps.push({ start: cursor, end: range.start }); cursor = Math.max(cursor, range.end); }
  if (cursor < 1440) gaps.push({ start: cursor, end: 1440 });
  const daytime = gaps.map(gap => ({ start: Math.max(gap.start, 540), end: Math.min(gap.end, 1020) })).filter(gap => gap.end > gap.start);
  return [...(daytime.length ? daytime : gaps)].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] ?? { start: 540, end: 1020 };
}

export function AvailabilityEditor({ day, selectedDays, slots, editing, onClose, onSaved }: Props) {
  const [hours, setHours] = useState(() => initialHours(day, slots, editing));
  const [breaks, setBreaks] = useState<(ScheduleBreak & { id: number })[]>([]), nextId = useRef(0);
  const [repeat, setRepeat] = useState(false), [weeks, setWeeks] = useState(2), [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4]);
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [note, setNote] = useState("");
  const busy = useRef(false), alive = useRef(true), controller = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const days = editing ? [dateKey(new Date(editing.startsAt))] : repeat ? scheduleDates(day, weekdays, weeks) : selectedDays;
  const suggestedBreak = suggestScheduleBreak(hours.start, hours.end, breaks);
  const clear = () => { setError(""); setNote(""); };
  const close = () => { if (!busy.current) onClose(); };
  const addBreak = () => {
    if (!suggestedBreak || busy.current) return;
    const pause = { ...suggestedBreak, id: ++nextId.current };
    setBreaks(current => [...current, pause].sort((a, b) => a.start - b.start)); clear();
  };
  const preset = (start: number, end: number) => {
    const remaining = breaks.filter(pause => pause.start > start && pause.end < end);
    setHours({ start, end }); setBreaks(remaining); clear();
    if (remaining.length !== breaks.length) setNote("Przerwy poza nowymi godzinami zostały usunięte.");
  };
  const save = async () => {
    if (busy.current || !days.length) return;
    clear();
    let ranges;
    try {
      ranges = buildSchedule(days, hours.start, hours.end, editing ? [] : breaks);
      for (const range of ranges) if (slots.some(slot => slot.id !== editing?.id && Date.parse(slot.startsAt) < Date.parse(range.endsAt) && Date.parse(slot.endsAt) > Date.parse(range.startsAt)))
        throw new Error(`${dayLabel(dateKey(new Date(range.startsAt)))} ma już godziny w tym zakresie. Wróć do dnia i wybierz edycję istniejącego przedziału.`);
    } catch (e) { setError((e as Error).message); return; }
    busy.current = true; setSaving(true);
    const revision = getSessionRevision(), abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 20000);
    try {
      const result = editing ? { slots: [(await updateAvailability(editing.id, ranges[0].startsAt, ranges[0].endsAt, abort.signal)).slot] }
        : await addAvailabilityBatch(ranges, abort.signal);
      if (alive.current && revision === getSessionRevision()) onSaved(result.slots, days);
    } catch (e) {
      if (alive.current && revision === getSessionRevision()) setError(e instanceof ApiError ? e.message : "Nie udało się potwierdzić zapisu. Zachowaliśmy formularz. Sprawdź połączenie i spróbuj ponownie; po odświeżeniu zobaczysz aktualny grafik.");
    } finally { clearTimeout(timer); busy.current = false; if (alive.current) setSaving(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Zamknij edytor grafiku" disabled={saving} />
      <View style={s.dialog} accessibilityViewIsModal>
        <View style={s.header}><View style={styles.headerCopy}><Text style={styles.cardTitle}>{editing ? "Zmień godziny" : "Dodaj godziny"}</Text><Text style={styles.muted}>{days.length === 1 ? dayLabel(days[0]) : `Wspólne godziny dla ${days.length} dni`}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Zamknij formularz" style={s.icon} disabled={saving} onPress={close}><MaterialCommunityIcons name="close" size={24} color="#6F5648" /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {!editing ? <View style={[styles.wrap, { marginBottom: 18 }]}>{[{ label: "Rano", start: 480, end: 720 }, { label: "Popołudnie", start: 840, end: 1080 }, { label: "Cały dzień", start: 540, end: 1020 }].map(item => <TouchableOpacity key={item.label} style={styles.chip} accessibilityRole="button" disabled={saving} onPress={() => preset(item.start, item.end)}><Text style={styles.chipText}>{item.label} {timeLabel(item.start)}–{timeLabel(item.end)}</Text></TouchableOpacity>)}</View> : <Text style={[styles.body, { marginBottom: 16 }]}>Nowe godziny muszą obejmować aktywne rezerwacje.</Text>}
          <View style={styles.row}><TimePicker label="Początek pracy" value={hours.start} max={(breaks[0]?.start ?? hours.end) - TIME_STEP} disabled={saving} onChange={start => { setHours(current => ({ ...current, start })); clear(); }} /><TimePicker label="Koniec pracy" value={hours.end} min={(breaks.at(-1)?.end ?? hours.start) + TIME_STEP} allowMidnight disabled={saving} onChange={end => { setHours(current => ({ ...current, end })); clear(); }} /></View>
          {!editing ? <>
            <View style={s.section}><Text style={s.label}>Przerwy</Text><Text style={styles.muted}>Opcjonalnie, do {MAX_DAILY_BREAKS}. W tym czasie nie przyjmujesz rezerwacji.</Text></View>
            {breaks.map((pause, index) => <View key={pause.id} style={s.pause}>
              <View style={styles.spaceBetween}><Text style={s.label}>Przerwa {index + 1}</Text><TouchableOpacity style={s.icon} accessibilityRole="button" accessibilityLabel={`Usuń przerwę ${index + 1}`} disabled={saving} onPress={() => { setBreaks(current => current.filter(item => item.id !== pause.id)); clear(); }}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#B42318" /></TouchableOpacity></View>
              <View style={styles.row}><TimePicker label={`Początek przerwy ${index + 1}`} value={pause.start} min={(breaks[index - 1]?.end ?? hours.start) + TIME_STEP} max={pause.end - TIME_STEP} disabled={saving} onChange={start => { setBreaks(current => current.map(item => item.id === pause.id ? { ...item, start } : item)); clear(); }} /><TimePicker label={`Koniec przerwy ${index + 1}`} value={pause.end} min={pause.start + TIME_STEP} max={(breaks[index + 1]?.start ?? hours.end) - TIME_STEP} disabled={saving} onChange={end => { setBreaks(current => current.map(item => item.id === pause.id ? { ...item, end } : item)); clear(); }} /></View>
            </View>)}
            <TouchableOpacity accessibilityRole="button" style={[styles.secondaryButton, (!suggestedBreak || saving) && styles.buttonDisabled]} disabled={!suggestedBreak || saving} onPress={addBreak}><Text style={styles.secondaryButtonText}>Dodaj przerwę</Text></TouchableOpacity>
            {!suggestedBreak && breaks.length < MAX_DAILY_BREAKS ? <Text style={styles.muted}>Skróć przerwy lub wydłuż godziny pracy, aby dodać kolejną.</Text> : null}
            <View style={s.sectionRow}><View style={styles.headerCopy}><Text style={s.label}>Powtórz w wybrane dni</Text><Text style={styles.muted}>Te same godziny i przerwy przez kilka tygodni.</Text></View><Switch value={repeat} disabled={saving} onValueChange={value => { setRepeat(value); clear(); }} trackColor={{ false: "#DCCABD", true: "#D35400" }} accessibilityLabel="Powtarzaj grafik" /></View>
            {repeat ? <View style={s.pause}><Text style={styles.label}>Dni tygodnia</Text><View style={styles.wrap}>{WEEKDAYS.map((label, index) => <TouchableOpacity key={label} style={[styles.chip, weekdays.includes(index) && styles.chipActive]} disabled={saving} accessibilityRole="button" accessibilityLabel={`Powtarzaj: ${label}`} accessibilityState={{ selected: weekdays.includes(index) }} onPress={() => { setWeekdays(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index]); clear(); }}><Text style={[styles.chipText, weekdays.includes(index) && styles.chipTextActive]}>{label}</Text></TouchableOpacity>)}</View><Text style={[styles.label, { marginTop: 16 }]}>Okres od wybranego dnia</Text><View style={styles.wrap}>{[1, 2, 4].map(count => <TouchableOpacity key={count} style={[styles.chip, weeks === count && styles.chipActive]} disabled={saving} accessibilityRole="button" accessibilityState={{ selected: weeks === count }} onPress={() => { setWeeks(count); clear(); }}><Text style={[styles.chipText, weeks === count && styles.chipTextActive]}>{count === 1 ? "1 tydzień" : `${count} tygodnie`}</Text></TouchableOpacity>)}</View><Text style={[styles.muted, { marginTop: 12 }]}>Od {localDate(day).toLocaleDateString("pl-PL")} do {localDate(addDays(day, weeks * 7 - 1)).toLocaleDateString("pl-PL")} · {days.length} dni. Grafik nie przedłuża się automatycznie.</Text></View> : null}
          </> : null}
          {note ? <Text style={styles.body}>{note}</Text> : null}
          {error ? <Text style={[styles.statusError, { marginTop: 16 }]} accessibilityRole="alert">{error}</Text> : null}
        </ScrollView>
        <View style={s.footer}><TouchableOpacity accessibilityRole="button" disabled={saving} style={s.cancel} onPress={close}><Text style={styles.secondaryButtonText}>Anuluj</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, s.submit, (saving || !days.length) && styles.buttonDisabled]} disabled={saving || !days.length} onPress={() => void save()}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{editing ? "Zapisz godziny" : `Dodaj grafik · ${days.length} ${days.length === 1 ? "dzień" : "dni"}`}</Text>}</TouchableOpacity></View>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(61,36,21,0.42)", padding: 12, justifyContent: "center", alignItems: "center" },
  dialog: { width: "100%", maxWidth: 640, maxHeight: "92%", borderRadius: 22, backgroundColor: "#FFFFFF", overflow: "hidden", flexShrink: 1 },
  header: { flexDirection: "row", alignItems: "center", padding: 18, borderBottomWidth: 1, borderColor: "#F2E4D8" },
  content: { padding: 18 }, footer: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderTopWidth: 1, borderColor: "#F2E4D8" },
  icon: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, section: { marginTop: 20, marginBottom: 10, gap: 4 },
  label: { color: "#3D2415", fontWeight: "700", fontSize: 14 }, sectionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  pause: { backgroundColor: "#FFF8F0", borderRadius: 14, padding: 12, marginBottom: 10 }, submit: { flex: 1, marginTop: 0 }, cancel: { minHeight: 48, paddingHorizontal: 10, justifyContent: "center" }
});
