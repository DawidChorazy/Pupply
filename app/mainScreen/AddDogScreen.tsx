import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { addDogStyles as styles } from "./styles";

type DogForm = {
  photoUrl: string; // do zmiany będzie nie na zasadzie linku
  name: string;
  age: string;
  breed: string;
  weight: string;
  gender: string;
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

export default function AddDogScreen() {
  const [form, setForm] = useState<DogForm>(initialForm);

  const updateField = (field: keyof DogForm, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
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

          <TextInput
            style={styles.input}
            placeholder="Płeć"
            placeholderTextColor="#A98D7B"
            value={form.gender}
            onChangeText={(value) => updateField("gender", value)}
          />
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

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Zapisz zwierzaka</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
