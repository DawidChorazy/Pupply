import { addDogStyles as styles } from "@/features/home/styles";
import { PetForm, genderOptions } from "@/features/pets/usePetForm";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { Image, TouchableOpacity, View } from "react-native";

type PetPreviewProps = {
  form: PetForm;
  onEdit: () => void;
};

type PreviewFieldProps = {
  label: string;
  value: string;
  multiline?: boolean;
};

function displayValue(value: string) {
  return value.trim() || "—";
}

function PreviewField({ label, value, multiline = false }: PreviewFieldProps) {
  const content = displayValue(value);

  return (
    <View style={styles.previewField}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={[styles.previewValue, multiline && styles.previewValueMultiline]}>{content}</Text>
    </View>
  );
}

export function PetPreview({ form, onEdit }: PetPreviewProps) {
  const gender = genderOptions.find((option) => option.value === form.gender);
  const weight = form.weight.trim() ? `${form.weight.trim()} kg` : "";

  return (
    <>
      <View style={styles.previewPhotoCard}>
        {form.photoUrl.trim() ? (
          <Image source={{ uri: form.photoUrl.trim() }} style={styles.previewPhoto} />
        ) : (
          <View style={styles.previewPhotoPlaceholder}>
            <MaterialCommunityIcons name="dog" size={48} color="#D35400" />
            <Text style={styles.previewPhotoPlaceholderText}>Brak zdjęcia</Text>
          </View>
        )}
      </View>

      <View style={styles.previewHero}>
        <Text style={styles.previewName}>{displayValue(form.name)}</Text>
        {gender ? (
          <View style={styles.previewGenderBadge}>
            <MaterialCommunityIcons name={gender.icon} size={16} color="#D35400" />
            <Text style={styles.previewGenderText}>{gender.label}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Podstawowe dane</Text>

        <View style={styles.previewRow}>
          <View style={styles.previewHalfField}>
            <PreviewField label="Wiek" value={form.age.trim() ? `${form.age.trim()} lat` : ""} />
          </View>
          <View style={styles.previewHalfField}>
            <PreviewField label="Waga" value={weight} />
          </View>
        </View>

        <PreviewField label="Rasa" value={form.breed} />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Zdrowie i opieka</Text>

        <PreviewField label="Przebyte choroby" value={form.illnesses} multiline />
        <PreviewField label="Alergie i specjalne potrzeby" value={form.allergies} multiline />
        <PreviewField label="Zaplanowane szczepienia" value={form.vaccines} multiline />
        <PreviewField label="Weterynarz / kontakt awaryjny" value={form.vet} />
        <PreviewField label="Dodatkowe notatki" value={form.notes} multiline />
      </View>

      <TouchableOpacity style={styles.editButton} activeOpacity={0.85} onPress={onEdit}>
        <MaterialCommunityIcons name="pencil-outline" size={18} color="#FFFFFF" />
        <Text style={styles.editButtonText}>Edytuj</Text>
      </TouchableOpacity>
    </>
  );
}
