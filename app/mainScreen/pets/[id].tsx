import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import { ApiError } from "@/services/api-client";
import { getAccessToken } from "@/services/auth-storage";
import { deletePet, getPet, updatePet } from "@/services/pets-service";
import { uploadPetPhoto } from "@/services/uploads-service";
import { Pet, PetGender } from "@/types/pets";
import { addDogStyles as styles } from "@/styles/main-screen";
import { DogBreedPicker } from "@/components/forms/dog-breed-picker";
import { PetHealthEditor } from "@/components/forms/pet-health-editor";
import { PetPhotoPicker } from "@/components/forms/pet-photo-picker";
import {
  PetIllnessRecord,
  parsePetAllergies,
  parsePetIllnesses,
  serializePetAllergies,
  serializePetIllnesses
} from "@/types/pet-health";

type DogForm = {
  photoUrl: string;
  name: string;
  age: string;
  breed: string;
  weight: string;
  gender: PetGender | "";
  vaccines: string;
  vet: string;
  notes: string;
};

const initialForm: DogForm = {
  photoUrl: "",
  name: "",
  age: "",
  breed: "",
  weight: "",
  gender: "",
  vaccines: "",
  vet: "",
  notes: ""
};

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const genderOptions: { value: PetGender; label: string; icon: IconName }[] = [
  { value: "MALE", label: "Samiec", icon: "gender-male" },
  { value: "FEMALE", label: "Samica", icon: "gender-female" }
];

const optionalText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalInt = (value: string) => {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined || parsed === null) return parsed;
  return Number.isInteger(parsed) ? parsed : null;
};

function mapPetToForm(pet: Pet): DogForm {
  return {
    photoUrl: pet.photoUrl ?? "",
    name: pet.name,
    age: pet.age !== null ? String(pet.age) : "",
    breed: pet.breed ?? "",
    weight: pet.weight !== null ? String(pet.weight) : "",
    gender: pet.gender,
    vaccines: pet.vaccines ?? "",
    vet: pet.vet ?? "",
    notes: pet.notes ?? ""
  };
}

export default function PetDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<DogForm>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; contentType: "image/jpeg" | "image/png" | "image/webp" } | null>(null);
  const [illnesses, setIllnesses] = useState<PetIllnessRecord[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);

  const updateField = (field: keyof DogForm, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  };

  useEffect(() => {
    let isMounted = true;

    const loadPet = async () => {
      if (!id) {
        setError("Nie znaleziono zwierzaka");
        setIsLoading(false);
        return;
      }

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setError("Zaloguj się ponownie, aby zobaczyć profil");
          setIsLoading(false);
          return;
        }

        const response = await getPet(String(id), accessToken);
        if (isMounted) {
          setForm(mapPetToForm(response.pet));
          setIllnesses(parsePetIllnesses(response.pet.illnesses));
          setAllergies(parsePetAllergies(response.pet.allergies));
        }
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message || "Nie udało się pobrać profilu");
        } else {
          setError("Nie udało się pobrać profilu");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPet();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSave = async () => {
    if (isSubmitting) return;

    setError("");
    setSuccess("");

    if (!id) {
      setError("Nie znaleziono zwierzaka");
      return;
    }

    if (!form.name.trim()) {
      setError("Imię jest wymagane");
      return;
    }

    if (!form.gender) {
      setError("Wybierz płeć zwierzaka");
      return;
    }

    const age = parseOptionalInt(form.age);
    if (age === null) {
      setError("Wiek musi być liczbą całkowitą");
      return;
    }

    const weight = parseOptionalNumber(form.weight);
    if (weight === null) {
      setError("Waga musi być liczbą");
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Zaloguj się ponownie, aby zapisać zmiany");
      return;
    }

    setIsSubmitting(true);

    try {
      const photoKey = pendingPhoto
        ? await uploadPetPhoto(pendingPhoto.uri, pendingPhoto.contentType)
        : undefined;
      const response = await updatePet(
        String(id),
        {
          name: form.name.trim(),
          gender: form.gender,
          age,
          breed: optionalText(form.breed),
          weight,
          photoKey,
          illnesses: serializePetIllnesses(illnesses),
          allergies: serializePetAllergies(allergies),
          vaccines: optionalText(form.vaccines),
          vet: optionalText(form.vet),
          notes: optionalText(form.notes)
        },
        accessToken
      );

      setForm(mapPetToForm(response.pet));
      setIllnesses(parsePetIllnesses(response.pet.illnesses));
      setAllergies(parsePetAllergies(response.pet.allergies));
      setPendingPhoto(null);
      setSuccess("Zapisano zmiany");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || "Nie udało się zapisać zmian");
      } else {
        setError("Nie udało się zapisać zmian");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Usuń pupila", "Czy na pewno chcesz usunąć ten profil?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń", style: "destructive", onPress: () => void (async () => {
        if (!id) return;
        try {
          const token = await getAccessToken();
          if (!token) throw new ApiError("Zaloguj się ponownie", 401);
          await deletePet(String(id), token);
          router.back();
        } catch (requestError) {
          setError(requestError instanceof ApiError ? requestError.message : "Nie udało się usunąć pupila");
        }
      })() }
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" />
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Profil</Text>
            <Text style={styles.title}>Szczegóły zwierzaka</Text>
            <Text style={styles.subtitle}>Zmieniaj dane i zapisz aktualizacje.</Text>
          </View>
        </View>

        {!isLoading ? (
          <PetPhotoPicker
            value={form.photoUrl}
            onError={setError}
            onSelected={(photo) => {
              setPendingPhoto(photo);
              updateField("photoUrl", photo.uri);
            }}
          />
        ) : null}

        {isLoading ? (
          <View style={styles.formCard}>
            <ActivityIndicator color="#D35400" />
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Podstawowe dane</Text>

            <TextInput
              style={styles.input}
              placeholder="Imię"
              placeholderTextColor="#A98D7B"
              value={form.name}
              onChangeText={(value) => updateField("name", value)}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Wiek"
                placeholderTextColor="#A98D7B"
                value={form.age}
                onChangeText={(value) => updateField("age", value)}
                keyboardType="numeric"
              />

              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Waga"
                placeholderTextColor="#A98D7B"
                value={form.weight}
                onChangeText={(value) => updateField("weight", value)}
              />
            </View>

            <DogBreedPicker value={form.breed} onChange={(value) => updateField("breed", value)} />

            <Text style={styles.fieldLabel}>Płeć</Text>
            <View style={styles.genderRow}>
              {genderOptions.map((option) => {
                const isActive = form.gender === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.genderOption, isActive && styles.genderOptionActive]}
                    onPress={() => updateField("gender", option.value)}
                  >
                    <View
                      style={[
                        styles.genderIconCircle,
                        isActive && styles.genderIconCircleActive
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={option.icon}
                        size={20}
                        color={isActive ? "#FFFFFF" : "#D35400"}
                      />
                    </View>
                    <Text style={[styles.genderLabel, isActive && styles.genderLabelActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Zdrowie i opieka</Text>

          <PetHealthEditor
            illnesses={illnesses}
            onIllnessesChange={setIllnesses}
            allergies={allergies}
            onAllergiesChange={setAllergies}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Zaplanowane szczepienia"
            placeholderTextColor="#A98D7B"
            value={form.vaccines}
            onChangeText={(value) => updateField("vaccines", value)}
            multiline
            textAlignVertical="top"
          />

          <TextInput
            style={styles.input}
            placeholder="Weterynarz / kontakt awaryjny"
            placeholderTextColor="#A98D7B"
            value={form.vet}
            onChangeText={(value) => updateField("vet", value)}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Dodatkowe notatki"
            placeholderTextColor="#A98D7B"
            value={form.notes}
            onChangeText={(value) => updateField("notes", value)}
            multiline
            textAlignVertical="top"
          />
        </View>

        {error ? <Text style={styles.statusTextError}>{error}</Text> : null}
        {success ? <Text style={styles.statusTextSuccess}>{success}</Text> : null}

        <TouchableOpacity
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Zapisz zmiany</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: "#B42318", marginTop: 12 }]} onPress={handleDelete} disabled={isSubmitting}>
          <Text style={styles.saveButtonText}>Usuń pupila</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
