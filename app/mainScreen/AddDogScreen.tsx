import { addDogStyles as styles } from "@/features/home/styles";
import { genderOptions, useCreatePetForm } from "@/features/pets/usePetForm";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
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

const formatDocumentSize = (size?: number) => {
  if (!size) {
    return "PDF";
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AddDogScreen() {
  const {
    form,
    error,
    success,
    isSubmitting,
    isPickingPhoto,
    documents,
    isPickingDocument,
    updateField,
    pickPhoto,
    clearPhoto,
    pickDocuments,
    removeDocument,
    handleSave
  } = useCreatePetForm(() => router.back());

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

          <View style={styles.documentsHeader}>
            <Text style={styles.fieldLabel}>Dokumenty PDF</Text>
            <TouchableOpacity
              style={styles.documentAddButton}
              activeOpacity={0.85}
              disabled={isPickingDocument}
              onPress={pickDocuments}
            >
              {isPickingDocument ? (
                <ActivityIndicator color="#D35400" />
              ) : (
                <>
                  <MaterialCommunityIcons name="file-pdf-box" size={18} color="#D35400" />
                  <Text style={styles.documentAddButtonText}>Dodaj PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {documents.length ? (
            <View style={styles.documentsList}>
              {documents.map((document) => (
                <View key={document.id} style={styles.documentRow}>
                  <View style={styles.documentIcon}>
                    <MaterialCommunityIcons name="file-pdf-box" size={22} color="#D35400" />
                  </View>

                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {document.name}
                    </Text>
                    <Text style={styles.documentMeta}>{formatDocumentSize(document.size)}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.documentRemoveButton}
                    activeOpacity={0.85}
                    onPress={() => removeDocument(document.id)}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#B42318" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.documentsEmpty}>Możesz dodać np. książeczkę szczepień.</Text>
          )}

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
