
import { PetForm, genderOptions } from "@/features/pets/hooks/usePetForm";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { Image, TouchableOpacity, View, Platform, StyleSheet } from "react-native";

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
  previewField: {
    marginBottom: 14
  },
  previewLabel: {
    color: "#8A6D5B",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  previewValue: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21
  },
  previewValueMultiline: {
    lineHeight: 22
  },
  previewPhotoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  previewPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    backgroundColor: "#FFF0D2"
  },
  previewPhotoPlaceholder: {
    height: 220,
    borderRadius: 18,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  previewPhotoPlaceholderText: {
    color: "#8A6D5B",
    fontSize: 13,
    fontWeight: "600"
  },
  previewHero: {
    marginBottom: 14,
    gap: 10
  },
  previewName: {
    color: "#3D2415",
    fontSize: 30,
    fontWeight: "800"
  },
  previewGenderBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF0D2",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  previewGenderText: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700"
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
  previewRow: {
    flexDirection: "row",
    gap: 12
  },
  previewHalfField: {
    flex: 1
  },
  editButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...buttonShadow
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  }
});
