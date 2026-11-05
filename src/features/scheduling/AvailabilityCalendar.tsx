import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { ApiError } from "@/shared/api/api-client";
import { getSessionRevision, subscribeSessionChanged } from "@/shared/session/session-events";
import { archiveAvailability, getMySchedule, restoreAvailability } from "@/features/marketplace/services/sitters-service";
import { marketplaceStyles as styles } from "@/features/marketplace/styles/marketplace";
import { AvailabilitySlot, ScheduleBooking } from "@/features/marketplace/types/marketplace";
import { addDays, calendarWindow, dateKey, dayLabel, formatTime, freeRanges, intersectsDay, localDate } from "./calendar-utils";
import { SERVICE_LABELS as serviceLabels } from "@/features/marketplace/services/service-catalog";

const blocking = (booking: ScheduleBooking) => ["REQUESTED", "ACCEPTED"].includes(booking.status);
const protectedSlot = (slot: AvailabilitySlot, now: Date) => Boolean(slot.bookings?.some(booking => blocking(booking) && Date.parse(booking.endsAt) > now.getTime()));
const singleDay = (slot: AvailabilitySlot) => dateKey(new Date(slot.startsAt)) === dateKey(new Date(Date.parse(slot.endsAt) - 1));
const sortSlots = (slots: AvailabilitySlot[]) => slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
const mergeSlots = (slots: AvailabilitySlot[], changed: AvailabilitySlot[]) => sortSlots([...new Map([...slots, ...changed].map(slot => [slot.id, slot])).values()]);
const rangeLabel = (range: { startsAt: string; endsAt: string }, day: string) => {
  const start = Math.max(Date.parse(range.startsAt), localDate(day).getTime());
  const dayEnd = localDate(addDays(day, 1)).getTime(), end = Math.min(Date.parse(range.endsAt), dayEnd);
  return `${formatTime(new Date(start).toISOString())}–${end === dayEnd ? "24:00" : formatTime(new Date(end).toISOString())}`;
};
type Editor = { editing: AvailabilitySlot | null; days: string[]; day: string };

export function AvailabilityCalendar({ slots, onChange, disabled = false, onBusyChange, title = "Twój grafik" }: {
  slots: AvailabilitySlot[]; onChange: (slots: AvailabilitySlot[]) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void; title?: string;
}) {
  const [day, setDay] = useState(dateKey(new Date())), [month, setMonth] = useState(dateKey(new Date()).slice(0, 7));
  const [multiple, setMultiple] = useState(false), [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null), [pendingRemoval, setPendingRemoval] = useState<AvailabilitySlot[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [undo, setUndo] = useState<string[] | null>(null);
  const alive = useRef(true), working = useRef(false);
  const { width } = useWindowDimensions(), now = new Date(), today = dateKey(now);
  const locked = disabled || busy || Boolean(editor);
  useEffect(() => { onBusyChange?.(busy || Boolean(editor)); return () => onBusyChange?.(false); }, [busy, editor, onBusyChange]);
  useEffect(() => {
    alive.current = true;
    const unsubscribe = subscribeSessionChanged(() => { working.current = false; setBusy(false); setEditor(null); setUndo(null); setSuccess(""); setError(""); });
    return () => { alive.current = false; unsubscribe(); };
  }, []);
  const current = (revision: number) => alive.current && getSessionRevision() === revision;
  const daySlots = slots.filter(slot => intersectsDay(slot, day));
  const dayBookings = [...new Map(daySlots.flatMap(slot => slot.bookings ?? []).filter(booking => blocking(booking) && intersectsDay(booking, day)).map(booking => [booking.id, booking])).values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const targetDays = multiple ? selectedDays : [day];
  // Bulk removal includes only whole intervals within the selected dates.
  const removable = slots.filter(slot => !protectedSlot(slot, now) && targetDays.some(key => intersectsDay(slot, key)) && (() => {
    let key = dateKey(new Date(slot.startsAt));
    const last = dateKey(new Date(Date.parse(slot.endsAt) - 1));
    for (let count = 0; count < 29; count++, key = addDays(key, 1)) { if (!targetDays.includes(key)) return false; if (key === last) return true; }
    return false;
  })());
  const clearMessage = () => { setError(""); setSuccess(""); };
  const selectDay = (value: string) => {
    setDay(value); setError("");
    if (!multiple || value < today) return;
    if (!selectedDays.includes(value) && selectedDays.length >= 28) { setError("Wybierz maksymalnie 28 dni naraz."); return; }
    setSelectedDays(items => items.includes(value) ? items.filter(item => item !== value) : [...items, value].sort());
  };
  const refresh = async (visibleMonth = month) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    const revision = getSessionRevision();
    try {
      const window = calendarWindow(visibleMonth), response = await getMySchedule(window);
      if (current(revision)) onChange(sortSlots([...slots.filter(slot => Date.parse(slot.endsAt) <= Date.parse(window.from) || Date.parse(slot.startsAt) >= Date.parse(window.to)), ...response.slots]));
    } catch (e) { if (current(revision)) setError(e instanceof Error ? e.message : "Nie udało się odświeżyć grafiku."); }
    finally { working.current = false; if (current(revision)) setBusy(false); }
  };
  const remove = async (targets: AvailabilitySlot[]) => {
    if (working.current || locked || !targets.length) return;
    working.current = true; setBusy(true); clearMessage(); setPendingRemoval(null); setUndo(null);
    const revision = getSessionRevision(), ids = targets.map(slot => slot.id);
    try {
      await archiveAvailability(ids);
      if (current(revision)) {
        onChange(slots.filter(slot => !ids.includes(slot.id))); setUndo(ids);
        setSuccess(targets.length === 1 ? "Usunięto przedział." : `Usunięto przedziały: ${targets.length}.`);
      }
    } catch (e) {
      if (current(revision)) {
        setError(e instanceof ApiError ? e.message : "Nie udało się potwierdzić usunięcia. Możesz odświeżyć grafik lub cofnąć operację.");
        if (!(e instanceof ApiError)) setUndo(ids);
      }
    } finally { working.current = false; if (current(revision)) setBusy(false); }
  };
  const undoRemove = async () => {
    if (!undo || working.current || locked) return;
    working.current = true; setBusy(true); setError("");
    const revision = getSessionRevision();
    try {
      const response = await restoreAvailability(undo);
      if (current(revision)) { onChange(mergeSlots(slots, response.slots)); setUndo(null); setSuccess("Przywrócono usunięte godziny."); }
    } catch (e) { if (current(revision)) setError(e instanceof Error ? e.message : "Nie udało się cofnąć usunięcia. Spróbuj ponownie."); }
    finally { working.current = false; if (current(revision)) setBusy(false); }
  };
  const openEditor = (editing: AvailabilitySlot | null = null) => {
    if (locked || (!editing && (!targetDays.length || targetDays.some(key => key < today)))) return;
    clearMessage(); setEditor({ editing, day: editing ? dateKey(new Date(editing.startsAt)) : day, days: [...targetDays] });
  };

  return <View style={[styles.card, s.shell]}>
    <View style={styles.spaceBetween}><View style={styles.headerCopy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>Wybierz dzień, aby zobaczyć i zmienić jego godziny.</Text></View><TouchableOpacity style={s.iconButton} accessibilityRole="button" accessibilityLabel="Odśwież grafik" disabled={locked} onPress={() => void refresh()}>{busy ? <ActivityIndicator color="#D35400" /> : <MaterialCommunityIcons name="refresh" size={22} color="#D35400" />}</TouchableOpacity></View>
    <View style={[s.layout, width >= 900 && s.wide]}>
      <View style={[s.calendarPane, width >= 900 && s.calendarWide]}>
        <View style={s.mode}>{[false, true].map(value => <TouchableOpacity key={String(value)} accessibilityRole="button" accessibilityState={{ selected: multiple === value }} aria-pressed={multiple === value} disabled={locked} style={[s.modeButton, multiple === value && s.modeActive]} onPress={() => { setMultiple(value); setSelectedDays(value && day >= today ? [day] : []); setError(""); }}><Text style={[s.modeText, multiple === value && s.modeActiveText]}>{value ? "Kilka dni" : "Jeden dzień"}</Text></TouchableOpacity>)}</View>
        <ScheduleCalendar value={day} visibleMonth={month} values={multiple ? selectedDays : undefined} disabled={locked} onChange={selectDay} onMonthChange={value => { setMonth(value); setDay(value === today.slice(0, 7) ? today : `${value}-01`); void refresh(value); }} getMark={key => ({
          available: slots.some(slot => freeRanges(slot, (slot.bookings ?? []).filter(blocking), now).some(range => intersectsDay(range, key))),
          booked: slots.some(slot => slot.bookings?.some(booking => blocking(booking) && intersectsDay(booking, key)))
        })} />
        <View style={s.legend}><Text style={s.legendFree}>● Wolne godziny</Text><Text style={s.legendBooked}>● Rezerwacje</Text></View>
        {multiple ? <View style={s.selection}>
          <View style={styles.spaceBetween}><Text style={s.windowTitle}>Zaznaczone dni: {selectedDays.length}</Text><TouchableOpacity accessibilityRole="button" disabled={locked || !selectedDays.length} onPress={() => setSelectedDays([])} style={s.clear}><Text style={styles.secondaryButtonText}>Wyczyść wybór</Text></TouchableOpacity></View>
          <Text style={styles.muted}>Kliknij daty, które chcesz zmienić. Maksymalnie 28 dni.</Text>
          <View style={styles.wrap}>{selectedDays.slice(0, 6).map(key => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`Odznacz ${dayLabel(key)}`} disabled={locked} style={styles.chip} onPress={() => setSelectedDays(items => items.filter(item => item !== key))}><Text style={styles.chipText}>{localDate(key).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} ×</Text></TouchableOpacity>)}{selectedDays.length > 6 ? <Text style={styles.muted}>+{selectedDays.length - 6} dni</Text> : null}</View>
        </View> : null}
      </View>
      <View style={[s.dayPane, width >= 900 && s.dayWide]}>
        <View style={s.dayHeader}><Text style={s.dayTitle}>{multiple ? `Wybrane dni: ${selectedDays.length}` : dayLabel(day)}</Text><Text style={styles.muted}>{multiple ? "Dodaj te same godziny lub usuń wolne przedziały z zaznaczonych dni." : daySlots.length ? `Przedziały: ${daySlots.length} · Rezerwacje: ${dayBookings.length}` : "Brak zaplanowanych godzin"}</Text></View>
    {error ? <View style={s.error}><Text style={styles.dangerButtonText} accessibilityRole="alert">{error}</Text></View> : null}
    {success || undo ? <View style={s.notice}><Text style={[styles.body, styles.headerCopy]} accessibilityLiveRegion="polite">{success || "Możesz cofnąć ostatnią operację."}</Text>{undo ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cofnij usunięcie" disabled={locked} onPress={() => void undoRemove()} style={s.undo}><MaterialCommunityIcons name="undo" size={18} color="#D35400" /><Text style={styles.secondaryButtonText}>Cofnij usunięcie</Text></TouchableOpacity> : null}</View> : null}

        <TouchableOpacity style={[styles.primaryButton, s.addButton, (locked || !targetDays.length || targetDays.some(key => key < today)) && styles.buttonDisabled]} accessibilityRole="button" accessibilityLabel={multiple ? `Dodaj godziny · ${selectedDays.length} dni` : "Dodaj godziny"} disabled={locked || !targetDays.length || targetDays.some(key => key < today)} onPress={() => openEditor()}><MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" /><Text style={styles.primaryButtonText}>{multiple ? `Dodaj godziny · ${selectedDays.length} dni` : "Dodaj godziny"}</Text></TouchableOpacity>
        {removable.length > 1 ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Usuń wolne przedziały (${removable.length})`} style={s.removeAll} disabled={locked || removable.length > 168} onPress={() => void remove(removable)}><MaterialCommunityIcons name="trash-can-outline" size={18} color="#B42318" /><Text style={styles.dangerButtonText}>Usuń wolne przedziały ({removable.length})</Text></TouchableOpacity> : multiple && removable.length === 1 ? <TouchableOpacity accessibilityRole="button" style={s.removeAll} disabled={locked} onPress={() => void remove(removable)}><Text style={styles.dangerButtonText}>Usuń wolny przedział (1)</Text></TouchableOpacity> : null}
        {multiple ? <View style={s.multiInfo}><MaterialCommunityIcons name="calendar-multiselect" size={30} color="#D35400" /><Text style={styles.body}>Zmiany obejmą zaznaczone daty. Zachowamy przedziały z rezerwacjami oraz te, które obejmują niezaznaczone dni.</Text><Text style={styles.muted}>Przełącz na „Jeden dzień”, aby edytować pojedynczy przedział.</Text></View> : <>
          {!daySlots.length ? <View style={s.empty}><MaterialCommunityIcons name="calendar-plus" size={32} color="#C2A28E" /><Text style={styles.body}>Masz wolne tego dnia.</Text><Text style={styles.muted}>Dodaj godziny przyciskiem powyżej.</Text></View> : null}
          <View style={s.slotList}>{daySlots.map(slot => {
            const free = freeRanges(slot, (slot.bookings ?? []).filter(blocking), now).filter(range => intersectsDay(range, day));
            const protectedByBooking = protectedSlot(slot, now);
            return <View key={slot.id} style={s.availability}>
              <View style={styles.spaceBetween}><View style={styles.headerCopy}><Text style={s.time}>{rangeLabel(slot, day)}</Text><Text style={styles.muted}>{protectedByBooking ? "Aktywna rezerwacja" : "Dostępny przedział"}</Text></View>
                {singleDay(slot) && Date.parse(slot.startsAt) > now.getTime() ? <TouchableOpacity style={s.iconButton} disabled={locked} accessibilityRole="button" accessibilityLabel={`Edytuj godziny ${rangeLabel(slot, day)}`} onPress={() => openEditor(slot)}><MaterialCommunityIcons name="pencil-outline" size={20} color="#7A3B12" /></TouchableOpacity> : null}
                {!protectedByBooking ? <TouchableOpacity style={s.iconButton} disabled={locked} accessibilityRole="button" accessibilityLabel={`Usuń godziny ${rangeLabel(slot, day)}`} onPress={() => singleDay(slot) ? void remove([slot]) : setPendingRemoval([slot])}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#B42318" /></TouchableOpacity> : <MaterialCommunityIcons name="lock-outline" size={18} color="#A17645" />}
              </View>
              {free.length ? <Text style={s.legendFree}>Wolne: {free.map(range => rangeLabel(range, day)).join(", ")}</Text> : <Text style={styles.muted}>{Date.parse(slot.endsAt) <= now.getTime() ? "Termin minął" : "Brak wolnych godzin"}</Text>}
            </View>;
          })}</View>
          {dayBookings.map(booking => <TouchableOpacity key={booking.id} style={s.booking} disabled={locked} accessibilityRole="button" accessibilityLabel={`Rezerwacja ${booking.pet.name}, ${rangeLabel(booking, day)}`} onPress={() => router.push("/marketplace/bookings")}><View style={styles.spaceBetween}><Text style={s.bookingTime}>{rangeLabel(booking, day)}</Text><Text style={styles.muted}>{booking.status === "REQUESTED" ? "Oczekuje" : "Potwierdzona"}</Text></View><Text style={s.windowTitle}>{booking.pet.name} · {serviceLabels[booking.sitterService.type]}</Text></TouchableOpacity>)}
        </>}
      </View>
    </View>
    {editor ? <AvailabilityEditor day={editor.day} selectedDays={editor.days} editing={editor.editing} slots={slots} onClose={() => setEditor(null)} onSaved={(changed, days) => { onChange(mergeSlots(slots, changed)); setDay(days[0]); setMonth(days[0].slice(0, 7)); setEditor(null); setMultiple(false); setSelectedDays([]); setUndo(null); setSuccess(editor.editing ? "Zmieniono godziny dostępności." : `Zapisano grafik: ${days.length} ${days.length === 1 ? "dzień" : "dni"}.`); }} /> : null}
    {pendingRemoval ? <Modal visible transparent animationType="fade" onRequestClose={() => setPendingRemoval(null)}><View style={s.overlay}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Zostaw przedział" onPress={() => setPendingRemoval(null)} /><View style={s.confirm} accessibilityViewIsModal><Text style={styles.cardTitle}>Ten przedział obejmuje kilka dni</Text><Text style={styles.body}>Usunięty zostanie cały przedział, również w pozostałe dni. Możesz później cofnąć usunięcie.</Text><TouchableOpacity accessibilityRole="button" style={[styles.secondaryButton, styles.dangerButton]} onPress={() => void remove(pendingRemoval)}><Text style={styles.dangerButtonText}>Usuń cały przedział</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => setPendingRemoval(null)}><Text style={styles.secondaryButtonText}>Zostaw</Text></TouchableOpacity></View></View></Modal> : null}
  </View>;
}
const s = StyleSheet.create({
  shell: { width: "100%", maxWidth: 1120, alignSelf: "center" }, layout: { gap: 24, marginTop: 14 }, wide: { flexDirection: "row", alignItems: "flex-start" }, calendarPane: { minWidth: 0 }, calendarWide: { flex: 1, maxWidth: 480 }, dayWide: { flex: 1 }, dayPane: { minWidth: 0, backgroundColor: "#FFFCF8", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F2E4D8" },
  mode: { flexDirection: "row", backgroundColor: "#FFF3E9", padding: 4, borderRadius: 13, marginBottom: 16 }, modeButton: { flex: 1, minHeight: 40, justifyContent: "center", alignItems: "center", borderRadius: 10 }, modeActive: { backgroundColor: "#FFFFFF" }, modeText: { color: "#8A6D5B", fontWeight: "700", fontSize: 13 }, modeActiveText: { color: "#D35400" },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, legend: { flexDirection: "row", gap: 12, justifyContent: "center", marginTop: 10 }, legendFree: { color: "#16815D", fontSize: 12, lineHeight: 19 }, legendBooked: { color: "#9A5B12", fontSize: 12, lineHeight: 19 },
  dayHeader: { gap: 4, marginBottom: 12 }, dayTitle: { color: "#3D2415", fontSize: 18, fontWeight: "800", textTransform: "capitalize" }, addButton: { flexDirection: "row", gap: 8, marginTop: 0, marginBottom: 12 }, removeAll: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 44, marginBottom: 12 },
  availability: { borderWidth: 1, borderColor: "#CCE7DA", backgroundColor: "#F5FBF8", borderRadius: 12, padding: 12, gap: 4 }, slotList: { gap: 10 }, time: { fontSize: 17, fontWeight: "800", color: "#3D2415" }, windowTitle: { color: "#3D2415", fontSize: 13, fontWeight: "700", lineHeight: 20 },
  empty: { alignItems: "center", paddingVertical: 28, gap: 8 }, multiInfo: { alignItems: "center", padding: 16, gap: 12 }, booking: { marginTop: 12, backgroundColor: "#FFF3DF", borderLeftWidth: 3, borderLeftColor: "#B3630C", padding: 12, borderRadius: 12, gap: 4 }, bookingTime: { color: "#7A3B12", fontSize: 13, fontWeight: "800" },
  selection: { backgroundColor: "#FFF8F0", borderRadius: 12, padding: 12, marginTop: 12, gap: 8 }, clear: { minHeight: 40, justifyContent: "center" }, notice: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: "#EAF7EF" }, undo: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }, error: { backgroundColor: "#FFF0EE", borderRadius: 12, padding: 12, marginTop: 16 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(61,36,21,0.42)", padding: 20 }, confirm: { width: "100%", maxWidth: 420, padding: 24, gap: 12, borderRadius: 20, backgroundColor: "#FFFFFF" }
});
