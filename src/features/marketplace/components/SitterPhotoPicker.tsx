import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import { getSessionRevision } from "@/shared/session/session-events";
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function SitterPhotoPicker({ uri, disabled, onSelected, onRemove, onError,
  label = "Wybierz zdjęcie opiekuna", hint = "Pokaż się właścicielom zwierząt. Zdjęcie jest opcjonalne i będzie publiczne w Twojej ofercie." }: {
  uri: string | null; disabled: boolean; onSelected: (uri: string) => void | Promise<void>;
  onRemove: () => void | Promise<void>; onError: (message: string) => void; label?: string; hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const choosing = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = async () => {
    if (disabled || choosing.current) return;
    choosing.current = true;
    const revision = getSessionRevision();
    const active = () => mounted.current && revision === getSessionRevision();
    setBusy(true); onError("");
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!active()) return;
        if (!permission.granted) { onError("Zezwól na dostęp do zdjęć lub kontynuuj bez zdjęcia."); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (result.canceled || !active()) return;
      const image = result.assets[0];
      const size = Math.min(image.width, image.height);
      const processed = await manipulateAsync(image.uri, [
        { crop: { originX: Math.floor((image.width - size) / 2), originY: Math.floor((image.height - size) / 2), width: size, height: size } },
        { resize: { width: 768, height: 768 } }
      ], { compress: 0.85, format: SaveFormat.JPEG });
      if (active()) await onSelected(processed.uri);
    } catch { if (active()) onError("Nie udało się przygotować zdjęcia. Spróbuj wybrać inny plik."); }
    finally { choosing.current = false; if (mounted.current) setBusy(false); }
  };
  return <View style={styles.row}>
    <TouchableOpacity style={styles.avatar} onPress={choose} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={label}>
      {busy ? <ActivityIndicator color="#D35400" /> : uri ? <Image source={{ uri }} style={styles.image} accessibilityLabel={label === "Wybierz zdjęcie opiekuna" ? "Zdjęcie opiekuna" : "Zdjęcie profilowe"} /> : <MaterialCommunityIcons name="camera-plus-outline" size={32} color="#D35400" />}
    </TouchableOpacity>
    <View style={styles.copy}>
      <Text style={styles.title}>Twoje zdjęcie</Text><Text style={styles.hint}>{hint}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={choose} disabled={disabled || busy} accessibilityRole="button"><Text style={styles.link}>{uri ? "Zmień zdjęcie" : "Dodaj zdjęcie"}</Text></TouchableOpacity>
        {uri ? <TouchableOpacity onPress={onRemove} disabled={disabled || busy} accessibilityRole="button"><Text style={styles.remove}>Usuń</Text></TouchableOpacity> : null}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 16 }, avatar: { width: 88, height: 88, borderRadius: 28, backgroundColor: "#FFF0E5", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: 88, height: 88 }, copy: { flex: 1 }, title: { color: "#3D2415", fontSize: 15, fontWeight: "700" }, hint: { color: "#8A6D5B", fontSize: 12, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 }, link: { color: "#D35400", fontWeight: "700", fontSize: 13 }, remove: { color: "#B42318", fontSize: 13 }
});
