import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { addDays, dateKey, dayLabel, localDate, WEEKDAYS } from "@/features/scheduling/calendar-utils";

type Props = {
  value: string;
  values?: string[];
  onChange: (day: string) => void;
  onMonthChange?: (month: string) => void;
  marks?: Record<string, { available?: boolean; booked?: boolean }>;
  getMark?: (day: string) => { available?: boolean; booked?: boolean };
  availableDays?: Set<string>;
  isDayAvailable?: (day: string) => boolean;
  minDate?: string;
  disabled?: boolean;
};

export function ScheduleCalendar({ value, values, onChange, onMonthChange, marks = {}, getMark, availableDays, isDayAvailable, minDate, disabled }: Props) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const first = localDate(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const count = Math.ceil((offset + daysInMonth) / 7) * 7;
  const today = dateKey(new Date());
  const previousMonthEnd = dateKey(new Date(first.getFullYear(), first.getMonth(), 0));
  const changeMonth = (direction: number) => {
    const next = dateKey(new Date(first.getFullYear(), first.getMonth() + direction, 1)).slice(0, 7);
    setMonth(next); onMonthChange?.(next);
  };
  return <View style={s.calendar}>
    <View style={s.header}>
      <TouchableOpacity style={s.arrow} disabled={disabled || Boolean(minDate && previousMonthEnd < minDate)} accessibilityRole="button" accessibilityLabel="Poprzedni miesiąc" onPress={() => changeMonth(-1)}>
        <MaterialCommunityIcons name="chevron-left" size={24} color={minDate && previousMonthEnd < minDate ? "#DCCABD" : "#7A3B12"} />
      </TouchableOpacity>
      <Text accessibilityRole="header" style={s.month}>{first.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}</Text>
      <TouchableOpacity style={s.arrow} disabled={disabled} accessibilityRole="button" accessibilityLabel="Następny miesiąc" onPress={() => changeMonth(1)}><MaterialCommunityIcons name="chevron-right" size={24} color="#7A3B12" /></TouchableOpacity>
    </View>
    <View style={s.grid}>{WEEKDAYS.map(day => <View key={day} style={s.cell}><Text style={s.weekday}>{day}</Text></View>)}</View>
    <View style={s.grid}>{Array.from({ length: count }, (_, index) => {
      const key = addDays(`${month}-01`, index - offset);
      if (key.slice(0, 7) !== month) return <View key={key} style={s.cell} />;
      const selected = values ? values.includes(key) : value === key, mark = getMark?.(key) ?? marks[key];
      const available = isDayAvailable?.(key) ?? availableDays?.has(key);
      const unavailable = disabled || (!selected && (Boolean(minDate && key < minDate) || available === false));
      return <View key={key} style={s.cell}><TouchableOpacity
        accessibilityRole="button" accessibilityLabel={`${dayLabel(key)} ${key.slice(0, 4)}${mark?.available ? ", dostępność" : ""}${mark?.booked ? ", rezerwacje" : ""}`}
        accessibilityState={{ selected, disabled: unavailable }} aria-pressed={selected} disabled={unavailable} onPress={() => onChange(key)}
        style={[s.day, key === today && s.today, selected && s.selected, unavailable && s.disabled]}>
        <Text style={[s.number, selected && s.selectedText]}>{Number(key.slice(8))}</Text>
        <View style={s.dots}>{mark?.available || available ? <View style={[s.dot, { backgroundColor: selected ? "#FFFFFF" : "#16815D" }]} /> : null}{mark?.booked ? <View style={[s.dot, { backgroundColor: selected ? "#FFE1BA" : "#B3630C" }]} /> : null}</View>
      </TouchableOpacity></View>;
    })}</View>
  </View>;
}

const s = StyleSheet.create({
  calendar: { width: "100%", maxWidth: 520, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#FFF8F0" },
  month: { color: "#3D2415", fontSize: 16, fontWeight: "800", textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.285714%", minHeight: 36, alignItems: "center", justifyContent: "center" },
  weekday: { color: "#8A6D5B", fontSize: 12, fontWeight: "700" },
  day: { width: "100%", maxWidth: 48, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent", marginVertical: 2 },
  today: { borderColor: "#E7CBB8" }, selected: { backgroundColor: "#D35400", borderColor: "#D35400" }, disabled: { opacity: 0.3 },
  number: { color: "#3D2415", fontSize: 14, fontWeight: "600" }, selectedText: { color: "#FFFFFF", fontWeight: "800" },
  dots: { flexDirection: "row", gap: 3, height: 6, marginTop: 3 }, dot: { height: 4, width: 4, borderRadius: 2 }
});
