import { addDogStyles as styles } from "@/features/home/styles";
import { genderOptions, useEditPetForm } from "@/features/pets/usePetForm";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function PetDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { form, error, success, isSubmitting, isLoading, updateField, handleSave } = useEditPetForm(
    id ? String(id) : undefined
  );

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
                    <View style={[styles.genderIconCircle, isActive && styles.genderIconCircleActive]}>
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
            <Text style={styles.saveButtonText}>Zapisz zmiany</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
