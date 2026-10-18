import { DOG_BREEDS } from "@/constants/dog-breeds";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type DogBreedPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function DogBreedPicker({ value, onChange }: DogBreedPickerProps) {
  const [isFocused, setIsFocused] = useState(false);
  const suggestions = useMemo(() => {
    const query = normalize(value.trim());
    return DOG_BREEDS.filter((breed) => !query || normalize(breed).includes(query)).slice(0, 8);
  }, [value]);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.input}
        placeholder="Wpisz lub wybierz rasę"
        placeholderTextColor="#A98D7B"
        value={value}
        onChangeText={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 120)}
        autoCapitalize="words"
        maxLength={80}
      />

      {isFocused && suggestions.length > 0 ? (
        <View style={styles.list}>
          {suggestions.map((breed, index) => (
            <TouchableOpacity
              key={breed}
              style={[styles.option, index === suggestions.length - 1 && styles.lastOption]}
              onPress={() => {
                onChange(breed);
                setIsFocused(false);
              }}
            >
              <Text style={styles.optionText}>{breed}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <Text style={styles.hint}>Nie ma rasy na liście? Możesz wpisać własną.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10, zIndex: 5 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#F1DED0",
    paddingHorizontal: 14,
    color: "#3D2415",
    fontSize: 14
  },
  list: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1DED0",
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  option: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F7EDE6" },
  lastOption: { borderBottomWidth: 0 },
  optionText: { color: "#3D2415", fontSize: 14 },
  hint: { color: "#8A6D5B", fontSize: 11, marginTop: 5, marginLeft: 4 }
});
