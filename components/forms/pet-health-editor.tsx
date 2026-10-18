import { PET_ALLERGIES } from "@/constants/pet-allergies";
import { PetIllnessRecord } from "@/types/pet-health";
import { formatPolishDateInput, polishDateToIso } from "@/utils/input-masks";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

type PetHealthEditorProps = {
  illnesses: PetIllnessRecord[];
  onIllnessesChange: (items: PetIllnessRecord[]) => void;
  allergies: string[];
  onAllergiesChange: (items: string[]) => void;
};

const emptyIllness = { name: "", date: "", description: "", medications: "" };

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalized(value: string) {
  return value.toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function PetHealthEditor({ illnesses, onIllnessesChange, allergies, onAllergiesChange }: PetHealthEditorProps) {
  const [illnessModalVisible, setIllnessModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [illnessForm, setIllnessForm] = useState(emptyIllness);
  const [illnessError, setIllnessError] = useState("");
  const [allergyModalVisible, setAllergyModalVisible] = useState(false);
  const [draftAllergies, setDraftAllergies] = useState<string[]>([]);
  const [allergySearch, setAllergySearch] = useState("");
  const [customAllergyName, setCustomAllergyName] = useState("");

  const filteredAllergies = useMemo(() => {
    const query = normalized(allergySearch.trim());
    return PET_ALLERGIES.filter((item) => !query || normalized(item).includes(query));
  }, [allergySearch]);

  const openNewIllness = () => {
    setEditingId(null);
    setIllnessForm(emptyIllness);
    setIllnessError("");
    setIllnessModalVisible(true);
  };

  const openIllness = (item: PetIllnessRecord) => {
    setEditingId(item.id);
    setIllnessForm({ name: item.name, date: item.date, description: item.description, medications: item.medications ?? "" });
    setIllnessError("");
    setIllnessModalVisible(true);
  };

  const saveIllness = () => {
    if (!illnessForm.name.trim()) { setIllnessError("Podaj nazwę choroby"); return; }
    if (!polishDateToIso(illnessForm.date)) { setIllnessError("Podaj prawidłową datę w formacie DD.MM.RRRR"); return; }
    if (!illnessForm.description.trim()) { setIllnessError("Dodaj krótki opis choroby"); return; }

    const item: PetIllnessRecord = {
      id: editingId ?? createId(),
      name: illnessForm.name.trim(),
      date: illnessForm.date,
      description: illnessForm.description.trim(),
      medications: illnessForm.medications.trim() || undefined
    };
    onIllnessesChange(editingId ? illnesses.map((current) => current.id === editingId ? item : current) : [...illnesses, item]);
    setIllnessModalVisible(false);
  };

  const openAllergies = () => {
    setDraftAllergies(allergies);
    setAllergySearch("");
    setCustomAllergyName("");
    setAllergyModalVisible(true);
  };

  const toggleAllergy = (item: string) => {
    setDraftAllergies((current) => current.some((selected) => normalized(selected) === normalized(item))
      ? current.filter((selected) => normalized(selected) !== normalized(item))
      : [...current, item]);
  };

  const customAllergy = customAllergyName.trim();
  const customAlreadyExists = [...PET_ALLERGIES, ...draftAllergies].some((item) => normalized(item) === normalized(customAllergy));

  const addCustomAllergy = () => {
    if (!customAllergy || customAlreadyExists) return;
    setDraftAllergies((current) => [...current, customAllergy]);
    setCustomAllergyName("");
  };

  return (
    <>
      <View style={styles.sectionHeader}>
        <View><Text style={styles.title}>Przebyte choroby</Text><Text style={styles.subtitle}>Nazwa, data, opis i zastosowane leki</Text></View>
        <TouchableOpacity style={styles.addButton} onPress={openNewIllness}><MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" /><Text style={styles.addButtonText}>Dodaj</Text></TouchableOpacity>
      </View>

      {illnesses.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>Brak zapisanych chorób</Text></View> : illnesses.map((item) => (
        <TouchableOpacity key={item.id} style={styles.illnessCard} onPress={() => openIllness(item)}>
          <View style={styles.illnessTop}><View style={styles.illnessIcon}><MaterialCommunityIcons name="medical-bag" size={18} color="#D35400" /></View><View style={styles.flex}><Text style={styles.illnessName}>{item.name}</Text>{item.date ? <Text style={styles.illnessDate}>{item.date}</Text> : null}</View><TouchableOpacity onPress={() => onIllnessesChange(illnesses.filter((current) => current.id !== item.id))}><MaterialCommunityIcons name="trash-can-outline" size={19} color="#B42318" /></TouchableOpacity></View>
          <Text style={styles.description}>{item.description}</Text>
          {item.medications ? <View style={styles.medication}><MaterialCommunityIcons name="pill" size={15} color="#57606F" /><Text style={styles.medicationText}>{item.medications}</Text></View> : null}
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />
      <View style={styles.sectionHeader}>
        <View><Text style={styles.title}>Alergie</Text><Text style={styles.subtitle}>Wybierz z listy lub dodaj własną</Text></View>
        <TouchableOpacity style={styles.outlineButton} onPress={openAllergies}><MaterialCommunityIcons name="plus" size={18} color="#D35400" /><Text style={styles.outlineButtonText}>Dodaj</Text></TouchableOpacity>
      </View>
      {allergies.length ? <View style={styles.chips}>{allergies.map((item) => <View style={styles.selectedChip} key={item}><Text style={styles.selectedChipText}>{item}</Text><TouchableOpacity onPress={() => onAllergiesChange(allergies.filter((allergy) => allergy !== item))}><MaterialCommunityIcons name="close" size={16} color="#FFFFFF" /></TouchableOpacity></View>)}</View> : <View style={styles.empty}><Text style={styles.emptyText}>Brak wybranych alergii</Text></View>}

      <Modal visible={illnessModalVisible} animationType="slide" onRequestClose={() => setIllnessModalVisible(false)}>
        <SafeAreaView style={styles.modalPage}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.modalHeader}><TouchableOpacity style={styles.closeButton} onPress={() => setIllnessModalVisible(false)}><MaterialCommunityIcons name="close" size={28} color="#23272F" /></TouchableOpacity><TouchableOpacity onPress={saveIllness}><Text style={styles.done}>Zapisz</Text></TouchableOpacity></View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingId ? "Edytuj chorobę" : "Dodaj chorobę"}</Text>
              <Text style={styles.modalSubtitle}>Uzupełnij informacje ważne dla opiekuna i weterynarza.</Text>
              <Text style={styles.label}>Nazwa choroby</Text><TextInput style={styles.input} value={illnessForm.name} onChangeText={(name) => setIllnessForm((form) => ({ ...form, name }))} placeholder="np. zapalenie ucha" placeholderTextColor="#9A8B82" maxLength={120} />
              <Text style={styles.label}>Data</Text><TextInput style={styles.input} value={illnessForm.date} onChangeText={(date) => setIllnessForm((form) => ({ ...form, date: formatPolishDateInput(date) }))} placeholder="DD.MM.RRRR" placeholderTextColor="#9A8B82" keyboardType="number-pad" maxLength={10} />
              <Text style={styles.label}>Opis</Text><TextInput style={[styles.input, styles.textArea]} value={illnessForm.description} onChangeText={(description) => setIllnessForm((form) => ({ ...form, description }))} placeholder="Objawy, przebieg i zalecenia" placeholderTextColor="#9A8B82" multiline maxLength={2000} />
              <Text style={styles.label}>Leki (opcjonalnie)</Text><TextInput style={[styles.input, styles.textAreaSmall]} value={illnessForm.medications} onChangeText={(medications) => setIllnessForm((form) => ({ ...form, medications }))} placeholder="Nazwy leków i dawkowanie" placeholderTextColor="#9A8B82" multiline maxLength={1000} />
              {illnessError ? <Text style={styles.error}>{illnessError}</Text> : null}
              <TouchableOpacity style={styles.saveButton} onPress={saveIllness}><Text style={styles.saveButtonText}>Zapisz chorobę</Text></TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={allergyModalVisible} animationType="slide" onRequestClose={() => setAllergyModalVisible(false)}>
        <SafeAreaView style={styles.modalPage}>
          <View style={styles.modalHeader}><TouchableOpacity style={styles.closeButton} onPress={() => setAllergyModalVisible(false)}><MaterialCommunityIcons name="close" size={28} color="#23272F" /></TouchableOpacity><TouchableOpacity onPress={() => { onAllergiesChange(draftAllergies); setAllergyModalVisible(false); }}><Text style={styles.done}>Gotowe</Text></TouchableOpacity></View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.countRow}><Text style={styles.modalTitle}>Alergie</Text><Text style={styles.count}>{draftAllergies.length} wybranych</Text></View>
            {draftAllergies.length ? <View style={styles.chips}>{draftAllergies.map((item) => <TouchableOpacity style={styles.selectedChip} key={item} onPress={() => toggleAllergy(item)}><Text style={styles.selectedChipText}>{item}</Text><MaterialCommunityIcons name="close" size={17} color="#FFFFFF" /></TouchableOpacity>)}</View> : null}
            <View style={styles.search}><MaterialCommunityIcons name="magnify" size={24} color="#7B8491" /><TextInput style={styles.searchInput} value={allergySearch} onChangeText={setAllergySearch} placeholder="Szukaj alergii" placeholderTextColor="#8B939E" /></View>
            <View style={styles.options}>{filteredAllergies.map((item) => { const selected = draftAllergies.some((current) => normalized(current) === normalized(item)); return <TouchableOpacity key={item} style={[styles.optionChip, selected && styles.optionChipSelected]} onPress={() => toggleAllergy(item)}><Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{item}</Text></TouchableOpacity>; })}</View>
            <View style={styles.customSection}>
              <Text style={styles.customTitle}>Nie ma alergii na liście?</Text>
              <Text style={styles.customSubtitle}>Dodaj własną, niestandardową alergię.</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customAllergyName}
                  onChangeText={setCustomAllergyName}
                  placeholder="Wpisz nazwę alergii"
                  placeholderTextColor="#8B939E"
                  maxLength={100}
                  onSubmitEditing={addCustomAllergy}
                />
                <TouchableOpacity
                  style={[styles.customAddButton, (!customAllergy || customAlreadyExists) && styles.customAddButtonDisabled]}
                  disabled={!customAllergy || customAlreadyExists}
                  onPress={addCustomAllergy}
                >
                  <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {customAllergy && customAlreadyExists ? <Text style={styles.duplicateText}>Ta alergia jest już na liście lub została wybrana.</Text> : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 },
  title: { color: "#3D2415", fontSize: 15, fontWeight: "800" },
  subtitle: { color: "#8A6D5B", fontSize: 11, marginTop: 3 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#D35400", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  addButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  outlineButton: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderColor: "#D35400", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  outlineButtonText: { color: "#D35400", fontSize: 12, fontWeight: "800" },
  empty: { backgroundColor: "#FFF8F0", borderRadius: 14, padding: 14, marginBottom: 8 },
  emptyText: { color: "#9A7D6A", fontSize: 12, textAlign: "center" },
  illnessCard: { borderRadius: 15, borderWidth: 1, borderColor: "#F1DED0", backgroundColor: "#FFFDFC", padding: 12, marginBottom: 9 },
  illnessTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  illnessIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF0D2", alignItems: "center", justifyContent: "center" },
  illnessName: { color: "#3D2415", fontSize: 14, fontWeight: "800" },
  illnessDate: { color: "#8A6D5B", fontSize: 11, marginTop: 2 },
  description: { color: "#6F5648", fontSize: 12, lineHeight: 17, marginTop: 9 },
  medication: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "#F1F3F5", borderRadius: 10, padding: 8, marginTop: 8 },
  medicationText: { color: "#57606F", fontSize: 11, flex: 1 },
  divider: { height: 1, backgroundColor: "#F2E4D8", marginVertical: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  selectedChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#596270", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  selectedChipText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  modalPage: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: { minHeight: 64, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#F0F1F3" },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  done: { color: "#D35400", fontSize: 17, fontWeight: "800" },
  modalContent: { padding: 22, paddingBottom: 50 },
  modalTitle: { color: "#1E232B", fontSize: 32, fontWeight: "900" },
  modalSubtitle: { color: "#77808C", fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 24 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  count: { color: "#343A43", fontSize: 14, fontWeight: "700" },
  label: { color: "#55463E", fontSize: 12, fontWeight: "800", marginBottom: 7 },
  input: { minHeight: 50, backgroundColor: "#FFF8F0", borderWidth: 1, borderColor: "#F1DED0", borderRadius: 14, paddingHorizontal: 14, color: "#3D2415", fontSize: 14, marginBottom: 16 },
  textArea: { minHeight: 120, paddingTop: 13, textAlignVertical: "top" },
  textAreaSmall: { minHeight: 82, paddingTop: 13, textAlignVertical: "top" },
  error: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  saveButton: { minHeight: 52, backgroundColor: "#D35400", borderRadius: 15, alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  search: { minHeight: 58, backgroundColor: "#F0F1F4", borderRadius: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 9, marginBottom: 18 },
  searchInput: { flex: 1, color: "#252A32", fontSize: 16 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  optionChip: { borderRadius: 999, borderWidth: 1, borderColor: "#BBC0C7", paddingHorizontal: 13, paddingVertical: 10 },
  optionChipSelected: { borderColor: "#D35400", backgroundColor: "#FFF4EC" },
  optionChipText: { color: "#5A626D", fontSize: 13, fontWeight: "700" },
  optionChipTextSelected: { color: "#B54708" },
  customSection: { marginTop: 28, borderTopWidth: 1, borderTopColor: "#E7E9EC", paddingTop: 20 },
  customTitle: { color: "#252A32", fontSize: 16, fontWeight: "800" },
  customSubtitle: { color: "#77808C", fontSize: 12, marginTop: 3, marginBottom: 12 },
  customRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  customInput: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#C9CDD3", paddingHorizontal: 14, color: "#252A32", fontSize: 14 },
  customAddButton: { width: 50, height: 50, borderRadius: 14, backgroundColor: "#D35400", alignItems: "center", justifyContent: "center" },
  customAddButtonDisabled: { opacity: 0.4 },
  duplicateText: { color: "#B54708", fontSize: 11, marginTop: 7 }
});
