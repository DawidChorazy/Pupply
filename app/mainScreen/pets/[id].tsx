import { addDogStyles as styles } from "@/features/home/styles";
import { PetEditForm } from "@/features/pets/components/PetEditForm";
import { PetPreview } from "@/features/pets/components/PetPreview";
import { useEditPetForm } from "@/features/pets/usePetForm";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";

export default function PetDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const {
    form,
    error,
    success,
    isSubmitting,
    isLoading,
    isPickingPhoto,
    updateField,
    pickPhoto,
    clearPhoto,
    handleSave,
    revertChanges
  } = useEditPetForm(id ? String(id) : undefined, () => setIsEditing(false));

  const handleCancelEdit = () => {
    revertChanges();
    setIsEditing(false);
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
            <Text style={styles.title}>{isEditing ? "Edytuj zwierzaka" : form.name.trim() || "Zwierzak"}</Text>
            <Text style={styles.subtitle}>
              {isEditing ? "Zmień dane i zapisz aktualizacje." : "Podgląd profilu zwierzaka."}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.formCard}>
            <ActivityIndicator color="#D35400" />
          </View>
        ) : isEditing ? (
          <PetEditForm
            form={form}
            error={error}
            success={success}
            isSubmitting={isSubmitting}
            isPickingPhoto={isPickingPhoto}
            updateField={updateField}
            pickPhoto={pickPhoto}
            clearPhoto={clearPhoto}
            onCancel={handleCancelEdit}
            onSave={handleSave}
          />
        ) : (
          <PetPreview form={form} onEdit={() => setIsEditing(true)} />
        )}

        {!isLoading && !isEditing && error ? <Text style={styles.statusTextError}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
