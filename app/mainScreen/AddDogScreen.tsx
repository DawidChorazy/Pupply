import { ApiError } from "@/services/api-client";
import { getAccessToken } from "@/services/auth-storage";
import { createPet } from "@/services/pets-service";
import { PetGender } from "@/types/pets";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { addDogStyles as styles } from "@/features/mainScreen/styles";

type DogForm = {
  photoUrl: string; // do zmiany będzie nie na zasadzie linku
  name: string;
  age: string;
  breed: string;
  weight: string;
  gender: PetGender | "";
  illnesses: string;
  allergies: string;
  vaccines: string;
  vet: string;
  notes: string;
};

const initialForm: DogForm = {
  photoUrl: "", // do zmiany nie na zasadzie linku
  name: "",
  age: "",
  breed: "",
  weight: "",
  gender: "",
  illnesses: "",
  allergies: "",
  vaccines: "",
  vet: "",
  notes: ""
};

const genderOptions: { value: PetGender; label: string; icon: string }[] = [
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

export default function AddDogScreen() {
  const [form, setForm] = useState<DogForm>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Zaloguj się ponownie, aby dodać zwierzaka");
      return;
    }

    setIsSubmitting(true);

    try {
      await createPet(
        {
          name: form.name.trim(),
          gender: form.gender,
          age,
          breed: optionalText(form.breed),
          weight,
          photoUrl: optionalText(form.photoUrl),
          illnesses: optionalText(form.illnesses),
          allergies: optionalText(form.allergies),
          vaccines: optionalText(form.vaccines),
          vet: optionalText(form.vet),
          notes: optionalText(form.notes)
        },
        accessToken
      );

      setSuccess("Zwierzak został dodany");
      setForm(initialForm);
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

        <View style={styles.photoCard}>
          {form.photoUrl.trim() ? (
            <Image source={{ uri: form.photoUrl.trim() }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons name="camera-plus-outline" size={36} color="#D35400" />
              <Text style={styles.photoTitle}>Dodaj zdjęcie</Text>
            </View>
          )}
        </View>

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

          <TextInput
            style={styles.input}
            placeholder="Rasa"
            placeholderTextColor="#A98D7B"
            value={form.breed}
            onChangeText={(value) => updateField("breed", value)}
          />

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
                      value={option.icon}
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

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Przebyte choroby"
            placeholderTextColor="#A98D7B"
            value={form.illnesses}
            onChangeText={(value) => updateField("illnesses", value)}
            multiline
            textAlignVertical="top"
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Alergie i specjalne potrzeby"
            placeholderTextColor="#A98D7B"
            value={form.allergies}
            onChangeText={(value) => updateField("allergies", value)}
            multiline
            textAlignVertical="top"
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
            <Text style={styles.saveButtonText}>Zapisz zwierzaka</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
