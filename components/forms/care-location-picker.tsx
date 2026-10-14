import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CareLocation, reverseLocation, searchLocations } from "@/services/location-service";
import { ApiError } from "@/services/api-client";

export function CareLocationPicker({ value, onChange, label = "Gdzie szukasz opieki?" }: { value: CareLocation | null; onChange: (value: CareLocation | null) => void; label?: string }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CareLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (value || query.trim().length < 2) return;
    const controller = new AbortController();
    const current = revision.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const result = await searchLocations(query.trim(), controller.signal);
        if (!controller.signal.aborted && current === revision.current) {
          setSuggestions(result.items);
          setSearched(true);
        }
      } catch (requestError) {
        if (!controller.signal.aborted && current === revision.current) {
          setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać podpowiedzi. Sprawdź połączenie i wpisz nazwę ponownie.");
        }
      } finally {
        if (!controller.signal.aborted && current === revision.current) setBusy(false);
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, value]);

  const edit = (text: string) => {
    revision.current += 1;
    setQuery(text);
    onChange(null);
    setSuggestions([]);
    setError("");
    setSearched(false);
    setBusy(false);
  };
  const select = (place: CareLocation) => {
    revision.current += 1;
    setQuery(place.city);
    setSuggestions([]);
    setBusy(false);
    setError("");
    onChange(place);
    Keyboard.dismiss();
  };

  const locate = async () => {
    if (locating) return;
    revision.current += 1;
    setSuggestions([]);
    setError("");
    setBusy(false);
    setLocating(true);
    try {
      if (Platform.OS === "web" && typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error("Przeglądarka wymaga HTTPS lub localhost do ustalenia lokalizacji. Możesz wpisać miejscowość ręcznie.");
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Brak zgody na lokalizację. Wpisz miejscowość ręcznie lub zezwól na lokalizację w ustawieniach aplikacji/przeglądarki.");
      const position = await new Promise<Location.LocationObject>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Nie udało się ustalić lokalizacji. Spróbuj ponownie lub wpisz miejscowość.")), 15_000);
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(resolve, reject).finally(() => clearTimeout(timeout));
      });
      const { latitude, longitude } = position.coords;
      let place: CareLocation = { id: "device", city: "Moja lokalizacja", region: "", county: "", latitude, longitude };
      try {
        const result = await reverseLocation(latitude, longitude);
        if (result.items[0]) place = { ...result.items[0], latitude, longitude };
      } catch { /* Pozycja GPS pozostaje użyteczna bez nazwy miejscowości. */ }
      if (mounted.current) select(place);
    } catch (requestError) {
      if (mounted.current) setError(requestError instanceof Error ? requestError.message : "Nie udało się ustalić lokalizacji.");
    } finally { if (mounted.current) setLocating(false); }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <MaterialCommunityIcons name="map-marker-outline" size={22} color="#D35400" />
        {value ? <View style={styles.copy}><Text style={styles.city}>{value.city}</Text>{value.region ? <Text style={styles.region}>woj. {value.region}</Text> : null}</View>
          : <TextInput style={styles.input} value={query} onChangeText={edit} editable={!locating} placeholder="Wpisz miejscowość, np. Kraków" placeholderTextColor="#9A7D6A" accessibilityLabel="Miejscowość" autoCorrect={false} maxLength={120} />}
        {busy ? <ActivityIndicator color="#D35400" /> : null}
        {(query || value) && !locating ? <TouchableOpacity onPress={() => edit("")} accessibilityLabel="Wyczyść lokalizację" style={styles.clear}><MaterialCommunityIcons name="close" size={20} color="#8A6D5B" /></TouchableOpacity> : null}
      </View>
      {suggestions.length ? <View style={styles.suggestions}>{suggestions.map(place => (
        <TouchableOpacity key={place.id} style={styles.option} onPress={() => select(place)} accessibilityRole="button" accessibilityLabel={`${place.city}, województwo ${place.region}, ${place.county}`}>
          <MaterialCommunityIcons name="map-marker-outline" size={20} color="#9A7D6A" />
          <View style={styles.copy}><Text style={styles.city}>{place.city}</Text><Text style={styles.region}>{[place.region ? `woj. ${place.region}` : "", place.county].filter(Boolean).join(" • ")}</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#9A7D6A" />
        </TouchableOpacity>
      ))}</View> : null}
      {!value && !busy && !locating && searched && !suggestions.length && !error ? <Text style={styles.hint}>Brak pasujących miejscowości. Spróbuj innej nazwy.</Text> : null}
      {!value && query.trim().length < 2 ? <Text style={styles.hint}>Wpisz co najmniej 2 znaki i wybierz miejscowość z listy.</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <TouchableOpacity style={styles.locate} onPress={locate} disabled={locating} accessibilityRole="button">
        {locating ? <ActivityIndicator color="#D35400" /> : <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#D35400" />}
        <Text style={styles.locateText}>{locating ? "Ustalam lokalizację…" : "Wyszukaj moją lokalizację"}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Lokalizację pobieramy jednorazowo po Twojej zgodzie, aby znaleźć opiekunów w pobliżu. Nazwę ustala Photon / OpenStreetMap.</Text>
      <Text style={styles.attribution}>Dane miejscowości: © OpenStreetMap contributors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: "#3D2415", fontWeight: "700", fontSize: 14, marginBottom: 10 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderWidth: 1, borderColor: "#F1DED0", borderRadius: 14, paddingHorizontal: 12, backgroundColor: "#FFF8F0" },
  copy: { flex: 1 }, input: { flex: 1, minHeight: 54, color: "#3D2415", fontSize: 14 },
  city: { color: "#3D2415", fontSize: 15, fontWeight: "700" }, region: { color: "#8A6D5B", fontSize: 12, fontWeight: "400", marginTop: 3 },
  clear: { padding: 10 }, suggestions: { borderWidth: 1, borderColor: "#F1DED0", borderRadius: 14, marginTop: 6, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderBottomWidth: 1, borderBottomColor: "#FFF0E5" },
  locate: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, borderRadius: 12, backgroundColor: "#FFF0E5", marginTop: 12 },
  locateText: { color: "#D35400", fontSize: 14, fontWeight: "600" }, hint: { color: "#8A6D5B", fontSize: 12, lineHeight: 17, marginTop: 8 },
  error: { color: "#B42318", fontSize: 12, lineHeight: 18, marginTop: 8 }, attribution: { color: "#9A7D6A", fontSize: 10, marginTop: 6, marginBottom: 14 }
});
