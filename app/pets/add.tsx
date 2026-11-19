import { usePetsContext } from "@/features/pets/context/PetsContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View, StyleSheet } from "react-native";
import { ApiError } from "@/shared/api/api-client";
import { getAccessToken } from "@/shared/session/auth-storage";
import { createPet, updatePet } from "@/features/pets/services/pets-service";
import { uploadPetPhoto } from "@/shared/api/uploads-service";
import { PetGender } from "@/features/pets/types/pets";

import { DogBreedPicker } from "@/features/pets/components/DogBreedPicker";
import { PetHealthEditor } from "@/features/pets/components/PetHealthEditor";
import { PetPhotoPicker } from "@/features/pets/components/PetPhotoPicker";
import { PetIllnessRecord, serializePetAllergies, serializePetIllnesses } from "@/features/pets/types/pet-health";
import * as DocumentPicker from "expo-document-picker";
import { PetDocumentList } from "@/features/pets/components/PetDocumentList"
import { savePetDocuments } from "@/features/pets/services/pet-documents-store"
import type { PetDocument } from "@/features/pets/types/pet-document";
import { isValidDocumentDate } from "@/features/pets/utils/document-date";

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

export default function AddPetScreen() {
  const { addPet, updatePetInList } = usePetsContext();
  const createdPetId = useRef<string | null>(null);
  const [form, setForm] = useState<DogForm>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; contentType: "image/jpeg" | "image/png" | "image/webp" } | null>(null);
  const [illnesses, setIllnesses] = useState<PetIllnessRecord[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [documents, setDocuments] = useState<PetDocument[]>([])

  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true,
      });

      if(result.canceled) return;

      const newDocuments: PetDocument[] = result.assets.map((asset, index) => ({
        ...asset,
        id: `${Date.now()}-${index}`,
        expiresAt: "",
        reminderDaysBefore: 7,
      }));

      setDocuments((current) => [...current, ...newDocuments])
    } catch{
      setError("Nie udało się wybrać dokumentu.")
    }
    
  }

  const removeDocuments = (indexToRemove: number) => {
    setDocuments((current) => current.filter((document, index) => index !== indexToRemove));
  }

  const updateDocumentExpiry = (documentId: string, value: string) => {
    setDocuments((current) => 
    current.map((document) =>
    document.id === documentId ? {...document, expiresAt: value} : document
    )
  )
  } 

  const documentExpirationReminder = (documentId: string, days: number) => {
    setDocuments((current) => 
    current.map((document) =>
    document.id === documentId ? {...document, reminderDaysBefore: days}: document))
  }

  const updateField = (field: keyof DogForm, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (isSubmitting) return;

    setError("");
    setSuccess("");

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

    const invalidDocument = documents.find(
      (document) => !isValidDocumentDate(document.expiresAt)
    )

    if(invalidDocument){
      setError(
        `Dokument "${invalidDocument.name} ma nieprawidłową datę. Użyj DD.MM.YYYY"`
      );
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Zaloguj się ponownie, aby dodać zwierzaka");
      return;
    }

    setIsSubmitting(true);

    try {
      const photoKey = pendingPhoto
        ? await uploadPetPhoto(pendingPhoto.uri, pendingPhoto.contentType)
        : undefined;
      const payload = {
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
        };
      const response = createdPetId.current
        ? await updatePet(createdPetId.current, payload, accessToken)
        : await createPet(payload, accessToken);
      createdPetId.current = response.pet.id;
      addPet(response.pet);
      updatePetInList(response.pet);
      await savePetDocuments(response.pet.id, documents);
      createdPetId.current = null;
      setDocuments([]);
      setSuccess("Zwierzak został dodany");
      setForm(initialForm);
      setPendingPhoto(null);
      setIllnesses([]);
      setAllergies([]);
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || "Nie udało się dodać zwierzaka");
      } else {
        setError("Nie udało się dodać zwierzaka");
      }
    } finally {
      setIsSubmitting(false);
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
            <Text style={styles.eyebrow}>Nowy profil</Text>
            <Text style={styles.title}>Dodaj zwierzaka</Text>
            <Text style={styles.subtitle}>Uzupełnij informacje, które pomogą dobrać opiekę.</Text>
          </View>
        </View>

        <PetPhotoPicker
          value={form.photoUrl}
          onError={setError}
          onSelected={(photo) => {
            setPendingPhoto(photo);
            updateField("photoUrl", photo.uri);
          }}
        />

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

          <Text style={[styles.subtitle]}>Dokumenty medyczne</Text>

          <TouchableOpacity onPress={pickDocuments}>
            <Text>Dodaj PDF</Text>
          </TouchableOpacity>

          <PetDocumentList documents={documents} onRemove={removeDocuments} onExpiryChange={updateDocumentExpiry} onReminderChange={documentExpirationReminder}/>

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
            <Text style={styles.saveButtonText}>Zapisz zwierzaka</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const raisedShadow = Platform.select({
  web: {
    boxShadow: "0 8px 14px rgba(107, 58, 24, 0.06)"
  },
  default: {
    shadowColor: "#6B3A18",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  }
});

const buttonShadow = Platform.select({
  web: {
    boxShadow: "0 8px 14px rgba(211, 84, 0, 0.2)"
  },
  default: {
    shadowColor: "#D35400",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  }
});

const smallShadow = Platform.select({
  web: {
    boxShadow: "0 6px 12px rgba(107, 58, 24, 0.08)"
  },
  default: {
    shadowColor: "#6B3A18",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  }
});

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
    paddingBottom: 22
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...smallShadow
  },
  headerCopy: {
    flex: 1
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  sectionTitle: {
    color: "#3D2415",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12
  },
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
  row: {
    flexDirection: "row",
    gap: 10
  },
  halfInput: {
    flex: 1
  },
  fieldLabel: {
    color: "#6F5648",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  genderRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10
  },
  genderOption: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFF8F0",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  genderOptionActive: {
    backgroundColor: "#D35400",
    borderColor: "#D35400"
  },
  genderIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  genderIconCircleActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)"
  },
  genderLabel: {
    color: "#3D2415",
    fontSize: 13,
    fontWeight: "700"
  },
  genderLabelActive: {
    color: "#FFFFFF"
  },
  textArea: {
    minHeight: 92,
    paddingTop: 13
  },
  statusTextError: {
    color: "#B42318",
    marginBottom: 8,
    textAlign: "center",
    fontSize: 13
  },
  statusTextSuccess: {
    color: "#067647",
    marginBottom: 8,
    textAlign: "center",
    fontSize: 13
  },
  saveButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    ...buttonShadow
  },
  saveButtonDisabled: {
    opacity: 0.7
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  }
});
