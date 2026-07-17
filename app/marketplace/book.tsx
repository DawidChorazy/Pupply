import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, TouchableOpacity, View } from "react-native";

import { ApiError } from "@/services/api-client";
import { createBooking } from "@/services/bookings-service";
import { getAccessToken } from "@/services/auth-storage";
import { listPets } from "@/services/pets-service";
import { Pet } from "@/types/pets";
import { marketplaceStyles as styles } from "@/styles/marketplace";

export default function BookScreen() {
  const params = useLocalSearchParams<{ sitterName?: string; sitterServiceId?: string; availabilitySlotId?: string }>();
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
      {error ? <Text style={styles.statusError}>{error}</Text> : null}
      <TouchableOpacity style={[styles.primaryButton, (isSubmitting || !pets.length) && styles.buttonDisabled]} disabled={isSubmitting || !pets.length} onPress={submit}>
        {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Wyślij prośbę o rezerwację</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
