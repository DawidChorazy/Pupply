import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { timeLabel } from "@/features/scheduling/calendar-utils";
import { marketplaceStyles as styles } from "@/styles/marketplace";

export function TimePicker({ label, value, onChange, disabled, allowMidnight = false }: {
  label: string; value: number; onChange: (value: number) => void; disabled?: boolean; allowMidnight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <View style={{ flex: 1 }}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity style={[s.trigger, disabled && styles.buttonDisabled]} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ${timeLabel(value)}`} onPress={() => setOpen(true)}>
      <MaterialCommunityIcons name="clock-outline" size={18} color="#D35400" /><Text style={s.value}>{timeLabel(value)}</Text><MaterialCommunityIcons name="chevron-down" size={18} color="#8A6D5B" />
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Zamknij wybór godziny">
        <Pressable style={s.dialog} onPress={event => event.stopPropagation()} accessibilityViewIsModal>
          <View style={styles.spaceBetween}><Text style={styles.cardTitle}>{label}</Text><TouchableOpacity style={s.close} accessibilityRole="button" accessibilityLabel="Zamknij" onPress={() => setOpen(false)}><MaterialCommunityIcons name="close" size={22} color="#3D2415" /></TouchableOpacity></View>
          <Text style={[styles.muted, { marginBottom: 12 }]}>Wybierz godzinę</Text>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={s.times}>
            {Array.from({ length: allowMidnight ? 97 : 96 }, (_, index) => index * 15).map(minutes => <TouchableOpacity key={minutes} style={[s.time, value === minutes && styles.chipActive]} accessibilityRole="button" accessibilityLabel={timeLabel(minutes)} accessibilityState={{ selected: value === minutes }} onPress={() => { onChange(minutes); setOpen(false); }}><Text style={[styles.chipText, value === minutes && styles.chipTextActive]}>{timeLabel(minutes)}</Text></TouchableOpacity>)}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: "#F1DED0", backgroundColor: "#FFF8F0", paddingHorizontal: 12, minHeight: 48, borderRadius: 14 },
  value: { color: "#3D2415", fontSize: 15, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(61,36,21,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: { width: "100%", maxWidth: 420, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 20 },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  time: { width: "22%", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#FFF8F0", borderWidth: 1, borderColor: "#F1DED0" }
});
