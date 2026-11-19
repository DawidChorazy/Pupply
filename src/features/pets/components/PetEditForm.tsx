
import { PetForm, genderOptions } from "@/features/pets/hooks/usePetForm";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import {
  ActivityIndicator,
  Image,
  TextInput,
  TouchableOpacity,
  View, Platform, StyleSheet } from "react-native";

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

const styles = StyleSheet.create({
  photoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  photoPreview: {
    height: 190,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: "#FFF0D2"
  },
  photoActions: {
    flexDirection: "row",
    gap: 10
  },
  photoButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  photoButtonText: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "800"
  },
  photoRemoveButton: {
    width: 44,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F6C8C3",
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center"
  },
  photoPlaceholder: {
    height: 170,
    borderRadius: 18,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",

  },
  photoTitle: {
    color: "#3D2415",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8
  },
  photoSubtitle: {
    color: "#8A6D5B",
    fontSize: 12,
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
  editActionsRow: {
    flexDirection: "row",
    gap: 10
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelButtonText: {
    color: "#6F5648",
    fontSize: 15,
    fontWeight: "800"
  },
  saveButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    ...buttonShadow
  },
  saveButtonInline: {
    flex: 1.4
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
