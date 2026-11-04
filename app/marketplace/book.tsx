import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { createBooking } from "@/features/marketplace/services/bookings-service";
import { getAccessToken } from "@/shared/session/auth-storage";
import { listPets } from "@/features/pets/services/pets-service";
import { Pet } from "@/features/pets/types/pets";

export default function BookScreen() {
  const params = useLocalSearchParams<{ sitterName?: string; sitterServiceId?: string; availabilitySlotId?: string; startsAt?: string }>();
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new ApiError("Zaloguj się ponownie", 401);
        const response = await listPets(token);
        setPets(response.pets);
        setPetId(response.pets[0]?.id ?? "");
      } catch (requestError) {
        setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać pupili");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const submit = async () => {
    if (!petId || !params.sitterServiceId || !params.availabilitySlotId) {
      setError(pets.length ? "Brakuje danych terminu" : "Najpierw dodaj pupila");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await createBooking({
        petId,
        sitterServiceId: String(params.sitterServiceId),
        availabilitySlotId: String(params.availabilitySlotId),
        startsAt: params.startsAt ? String(params.startsAt) : undefined,
        note: note.trim() || undefined
      });
      router.replace("/marketplace/bookings" as never);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Nie udało się utworzyć rezerwacji");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" /></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>Rezerwacja</Text><Text style={styles.title}>Umów opiekę</Text><Text style={styles.subtitle}>{params.sitterName ?? "Wybrany opiekun"}</Text></View>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Wybierz pupila</Text>
        {isLoading ? <ActivityIndicator color="#D35400" /> : (
          <View style={styles.wrap}>
            {pets.map((pet) => (
              <TouchableOpacity key={pet.id} style={[styles.chip, petId === pet.id && styles.chipActive]} onPress={() => setPetId(pet.id)}>
                <Text style={[styles.chipText, petId === pet.id && styles.chipTextActive]}>{pet.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!isLoading && pets.length === 0 ? <Text style={styles.muted}>Nie masz jeszcze dodanego pupila.</Text> : null}
        <Text style={[styles.label, { marginTop: 18 }]}>Wiadomość do opiekuna</Text>
        <TextInput style={[styles.input, styles.textArea]} value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="Ważne informacje, potrzeby pupila..." placeholderTextColor="#A98D7B" />
      </View>
      {error ? <View><Text style={styles.statusError}>{error}</Text><TouchableOpacity onPress={() => router.push("/verify-email" as never)}><Text style={styles.secondaryButtonText}>Potwierdź e-mail</Text></TouchableOpacity></View> : null}
      <TouchableOpacity style={[styles.primaryButton, (isSubmitting || !pets.length) && styles.buttonDisabled]} disabled={isSubmitting || !pets.length} onPress={submit}>
        {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Wyślij prośbę o rezerwację</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F0" },
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
  label: { color: "#6F5648", fontSize: 12, fontWeight: "700", marginBottom: 8 },
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
  statusError: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  secondaryButtonText: { color: "#D35400", fontSize: 13, fontWeight: "800" },
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
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }
});
