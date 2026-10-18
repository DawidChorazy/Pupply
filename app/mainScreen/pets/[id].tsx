import { usePetsContext } from "@/features/pets/PetsContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import { ApiError } from "@/services/api-client";
import { getAccessToken } from "@/services/auth-storage";
import { deletePet, getPet, updatePet } from "@/services/pets-service";
import { uploadPetPhoto } from "@/services/uploads-service";
import { Pet, PetGender } from "@/types/pets";
import { addDogStyles as styles } from "@/features/home/styles";
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
import * as DocumentPicker from "expo-document-picker";
import type { PetDocument } from "@/types/pet-document";
import { isValidDocumentDate } from "@/utils/document-date";
import { getPetDocuments, savePetDocuments } from "@/services/pet-documents-store";
import { PetDocumentList } from "@/components/forms/pet-document-list"

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
  const { updatePetInList, removePetFromList } = usePetsContext();
  const mutation = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedPet, setSavedPet] = useState<Pet | null>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const savedDocuments = useRef<PetDocument[]>([]);
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [isPickingDocuments, setIsPickingDocuments] = useState(false);
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
      await Promise.resolve();
      if (!isMounted) return;
      setLoaded(false);
      setEditing(false);
      setSavedPet(null);
      setIsLoading(true);
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

        const [response, persistedDocuments] = await Promise.all([getPet(String(id), accessToken), getPetDocuments(String(id))]);
        if (isMounted) {
          setSavedPet(response.pet);
          savedDocuments.current = persistedDocuments;
          setDocuments(persistedDocuments);
          setLoaded(true);
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

  const pickDocuments = async () => {
    if (!editing || !loaded || mutation.current || isPickingDocuments) return;
    setIsPickingDocuments(true);
    setError("");
    setSuccess("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true
      });
      if (result.canceled) return;
      const selected = result.assets.map((asset, index) => ({
        ...asset,
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        expiresAt: "",
        reminderDaysBefore: 7
      }));
      setDocuments((current) => [...current, ...selected]);
    } catch {
      setError("Nie udało się wybrać dokumentu. Spróbuj ponownie.");
    } finally {
      setIsPickingDocuments(false);
    }
  };

  const handleSave = async () => {
    if (!editing || mutation.current || !loaded || isPickingDocuments) return;

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

    const invalidDocument = documents.find((document) => !isValidDocumentDate(document.expiresAt));
    if (invalidDocument) {
      setError(`Dokument „${invalidDocument.name}” ma nieprawidłową datę. Użyj DD.MM.YYYY.`);
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Zaloguj się ponownie, aby zapisać zmiany");
      return;
    }

    mutation.current = true;
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

      const persistedDocuments = await savePetDocuments(String(id), documents);
      savedDocuments.current = persistedDocuments;
      setDocuments(persistedDocuments);
      setSavedPet(response.pet);
      setEditing(false);
      updatePetInList(response.pet);
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
      mutation.current = false;
      setIsSubmitting(false);
    }
  };

  const performDelete = async () => {
    if (!editing || !id || !loaded || mutation.current) return;
    mutation.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new ApiError("Zaloguj się ponownie", 401);
      await deletePet(String(id), token);
      removePetFromList(String(id));
      router.back();
    } catch {
      setError("Nie udało się usunąć pupila. Spróbuj ponownie.");
    } finally {
      mutation.current = false;
      setIsSubmitting(false);
    }
  };

  const cancelEditing = () => {
    if (!savedPet || mutation.current || isPickingDocuments) return;
    setForm(mapPetToForm(savedPet));
    setIllnesses(parsePetIllnesses(savedPet.illnesses));
    setAllergies(parsePetAllergies(savedPet.allergies));
    setDocuments(savedDocuments.current.map(document => ({ ...document })));
    setPendingPhoto(null);
    setError("");
    setSuccess("");
    setEditing(false);
  };

  const handleDelete = () => {
    if (!editing || !loaded || mutation.current) return;
    if (Platform.OS === "web") {
      if (window.confirm("Czy na pewno chcesz usunąć tego pupila?")) void performDelete();
    } else {
      Alert.alert("Usuń pupila", "Czy na pewno chcesz usunąć ten profil?", [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: () => void performDelete() }
      ]);
    }
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
            <Text style={styles.subtitle}>{editing ? "Zmień dane i zapisz aktualizacje." : "Dane pupila, zdrowie i dokumenty."}</Text>
          </View>
        </View>

        {loaded && !editing ? (
          <>
          <TouchableOpacity style={styles.saveButton} accessibilityRole="button" onPress={() => { setEditing(true); setError(""); setSuccess(""); }}>
            <Text style={styles.saveButtonText}>Edytuj</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, { marginTop: 10 }]} accessibilityRole="button" onPress={() => router.push({ pathname: "/pet-sharing", params: { petId: id } })}>
            <Text style={styles.saveButtonText}>Udostępnij kartę pupila</Text>
          </TouchableOpacity>
          </>
        ) : null}

        {editing ? <>
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

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Dokumenty medyczne</Text>
          <TouchableOpacity
            style={[styles.saveButton, (!loaded || isSubmitting || isPickingDocuments) && styles.saveButtonDisabled]}
            accessibilityRole="button"
            disabled={!loaded || isSubmitting || isPickingDocuments}
            onPress={() => void pickDocuments()}
          >
            {isPickingDocuments ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Dodaj PDF</Text>}
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>Po dodaniu dokumentów wybierz „Zapisz zmiany”.</Text>
          <PetDocumentList
            documents={documents}
            onRemove={loaded && !isSubmitting ? (index) => {
              setSuccess("");
              setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index));
            } : undefined}
            onExpiryChange={loaded && !isSubmitting ? (documentId, value) => {
              setSuccess("");
              setDocuments((current) => current.map((document) => document.id === documentId ? { ...document, expiresAt: value } : document));
            } : undefined}
            onReminderChange={loaded && !isSubmitting ? (documentId, days) => {
              setSuccess("");
              setDocuments((current) => current.map((document) => document.id === documentId ? { ...document, reminderDaysBefore: days } : document));
            } : undefined}
          />
        </View>

        </> : isLoading ? (
          <View style={styles.formCard}><ActivityIndicator color="#D35400" /></View>
        ) : loaded ? <>
          {form.photoUrl ? <Image source={{ uri: form.photoUrl }} accessibilityLabel={`Zdjęcie pupila ${form.name}`} style={{ width: "100%", height: 220, borderRadius: 20, marginVertical: 16 }} resizeMode="cover" /> : null}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Podstawowe dane</Text>
            {([
              ["Imię", form.name], ["Wiek (w latach)", form.age],
              ["Waga", form.weight ? `${form.weight} kg` : ""], ["Rasa", form.breed],
              ["Płeć", form.gender === "MALE" ? "Samiec" : form.gender === "FEMALE" ? "Samica" : ""]
            ]).map(([label, value]) => <View key={label} style={detailStyles.field}><Text style={detailStyles.label}>{label}</Text><Text style={[detailStyles.value, !value && detailStyles.empty]}>{value || "Nie podano"}</Text></View>)}
          </View>
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Zdrowie i opieka</Text>
            <Text style={detailStyles.label}>Choroby</Text>
            {illnesses.length ? illnesses.map((illness) => <View key={illness.id} style={detailStyles.field}>
              <Text style={detailStyles.value}>{illness.name}</Text>
              {illness.date ? <Text style={detailStyles.value}>Data: {illness.date}</Text> : null}
              {illness.description ? <Text style={detailStyles.value}>{illness.description}</Text> : null}
              {illness.medications ? <Text style={detailStyles.value}>Leki: {illness.medications}</Text> : null}
            </View>) : <Text style={[detailStyles.value, detailStyles.empty, detailStyles.field]}>Nie podano</Text>}
            {([
              ["Alergie", allergies.join(", ")], ["Zaplanowane szczepienia", form.vaccines],
              ["Weterynarz / kontakt awaryjny", form.vet], ["Dodatkowe notatki", form.notes]
            ]).map(([label, value]) => <View key={label} style={detailStyles.field}><Text style={detailStyles.label}>{label}</Text><Text style={[detailStyles.value, !value && detailStyles.empty]}>{value || "Nie podano"}</Text></View>)}
          </View>
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Dokumenty medyczne</Text>
            <PetDocumentList documents={documents} />
          </View>
        </> : null}

        {error ? <Text style={styles.statusTextError}>{error}</Text> : null}
        {success ? <Text style={styles.statusTextSuccess}>{success}</Text> : null}

        {editing ? <>
        <TouchableOpacity
          style={[styles.saveButton, (isSubmitting || !loaded) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSubmitting || !loaded || isPickingDocuments}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Zapisz zmiany</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: "#8A6D5B", marginTop: 12 }]} accessibilityRole="button" onPress={cancelEditing} disabled={isSubmitting || isPickingDocuments}>
          <Text style={styles.saveButtonText}>Anuluj</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: "#B42318", marginTop: 12 }]} onPress={handleDelete} disabled={isSubmitting || !loaded || isPickingDocuments}>
          <Text style={styles.saveButtonText}>Usuń pupila</Text>
        </TouchableOpacity>
        </> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const detailStyles = StyleSheet.create({
  field: {
    marginBottom: 16,
    gap: 5
  },
  label: {
    color: "#6F5648",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  },
  value: {
    color: "#3D2415",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "500"
  },
  empty: {
    color: "#756457",
    fontWeight: "400"
  }
});
