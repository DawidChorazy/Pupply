import { addDogStyles as styles } from "@/features/home/styles";
import { PetForm, genderOptions } from "@/features/pets/usePetForm";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import {
  ActivityIndicator,
  Image,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

type PetEditFormProps = {
  form: PetForm;
  error: string;
  success: string;
  isSubmitting: boolean;
  isPickingPhoto: boolean;
  updateField: (field: keyof PetForm, value: string) => void;
  pickPhoto: () => void;
  clearPhoto: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function PetEditForm({
  form,
  error,
  success,
  isSubmitting,
  isPickingPhoto,
  updateField,
  pickPhoto,
  clearPhoto,
  onCancel,
  onSave
}: PetEditFormProps) {
  return (
    <>
      <TouchableOpacity
        style={styles.photoCard}
        activeOpacity={0.85}
        disabled={isPickingPhoto}
        onPress={pickPhoto}
      >
        {form.photoUrl.trim() ? (
          <>
            <Image source={{ uri: form.photoUrl.trim() }} style={styles.photoPreview} />
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.photoButton}
                activeOpacity={0.85}
                disabled={isPickingPhoto}
                onPress={pickPhoto}
              >
                {isPickingPhoto ? (
                  <ActivityIndicator color="#D35400" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="image-edit-outline" size={18} color="#D35400" />
                    <Text style={styles.photoButtonText}>Zmień zdjęcie</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.photoRemoveButton} activeOpacity={0.85} onPress={clearPhoto}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#B42318" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.photoPlaceholder}>
            {isPickingPhoto ? (
              <ActivityIndicator color="#D35400" />
            ) : (
              <>
                <MaterialCommunityIcons name="camera-plus-outline" size={36} color="#D35400" />
                <Text style={styles.photoTitle}>Dodaj zdjęcie</Text>
                <Text style={styles.photoSubtitle}>Wybierz z galerii</Text>
              </>
            )}
          </View>
        )}
      </TouchableOpacity>

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

      <View style={styles.editActionsRow}>
        <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={onCancel} disabled={isSubmitting}>
          <Text style={styles.cancelButtonText}>Anuluj</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, styles.saveButtonInline, isSubmitting && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Zapisz zmiany</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}
