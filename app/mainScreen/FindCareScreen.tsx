import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

type Caregiver = {
  id: string;
  name: string;
  role: string;
  rating: string;
  distance: string;
  price: string;
  availability: string;
  tags: string[];
};

const caregivers: Caregiver[] = [
  {
    id: "care-1",
    name: "Anna Kowalska",
    role: "Petsitterka i spacery",
    rating: "4.9",
    distance: "1.2 km",
    price: "35 zł / spacer",
    availability: "Dzisiaj 16:00-20:00",
    tags: ["małe psy", "leki", "weekendy"]
  },
  {
    id: "care-2",
    name: "Michał Nowak",
    role: "Aktywne spacery",
    rating: "4.8",
    distance: "2.4 km",
    price: "40 zł / spacer",
    availability: "Jutro od 9:00",
    tags: ["duże psy", "bieganie", "socjalizacja"]
  },
  {
    id: "care-3",
    name: "Kasia Zielińska",
    role: "Opieka dzienna",
    rating: "5.0",
    distance: "3.1 km",
    price: "55 zł / wizyta",
    availability: "W tygodniu po 15:00",
    tags: ["szczeniaki", "koty", "transport"]
  }
];

export default function FindCareScreen() {
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(null);
  const selectedCaregiver = caregivers.find((caregiver) => caregiver.id === selectedCaregiverId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Umów spacer</Text>
          <Text style={styles.title}>Dostępni opiekunowie</Text>
          <Text style={styles.subtitle}>Wybierz osobę, która oferuje spacer lub opiekę w Twojej okolicy.</Text>
        </View>
      </View>

      {selectedCaregiver ? (
        <View style={styles.selectionBanner}>
          <MaterialCommunityIcons name="check-circle-outline" size={20} color="#067647" />
          <Text style={styles.selectionText}>Wybrano: {selectedCaregiver.name}. Kolejny krok to formularz rezerwacji.</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {caregivers.map((caregiver) => {
          const isSelected = selectedCaregiverId === caregiver.id;

          return (
            <View key={caregiver.id} style={[styles.card, isSelected && styles.cardSelected]}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <MaterialCommunityIcons name="account-heart-outline" size={28} color="#D35400" />
                </View>

                <View style={styles.caregiverInfo}>
                  <Text style={styles.caregiverName}>{caregiver.name}</Text>
                  <Text style={styles.caregiverRole}>{caregiver.role}</Text>
                </View>

                <View style={styles.ratingBadge}>
                  <MaterialCommunityIcons name="star" size={14} color="#D9A848" />
                  <Text style={styles.ratingText}>{caregiver.rating}</Text>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="map-marker-outline" size={17} color="#8A6D5B" />
                  <Text style={styles.metaText}>{caregiver.distance}</Text>
                </View>

                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="cash" size={17} color="#8A6D5B" />
                  <Text style={styles.metaText}>{caregiver.price}</Text>
                </View>

                <View style={styles.metaItemWide}>
                  <MaterialCommunityIcons name="clock-outline" size={17} color="#8A6D5B" />
                  <Text style={styles.metaText}>{caregiver.availability}</Text>
                </View>
              </View>

              <View style={styles.tagsRow}>
                {caregiver.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.bookButton, isSelected && styles.bookButtonSelected]}
                activeOpacity={0.85}
                onPress={() => setSelectedCaregiverId(caregiver.id)}
              >
                <Text style={styles.bookButtonText}>{isSelected ? "Wybrano opiekuna" : "Umów spacer"}</Text>
                <MaterialCommunityIcons
                  name={isSelected ? "check" : "arrow-right"}
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
    paddingBottom: 22
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: {
    flex: 1
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4
  },
  selectionBanner: {
    borderRadius: 16,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#ABEFC6",
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  selectionText: {
    flex: 1,
    color: "#067647",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  list: {
    gap: 14
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8"
  },
  cardSelected: {
    borderColor: "#D35400"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  caregiverInfo: {
    flex: 1
  },
  caregiverName: {
    color: "#3D2415",
    fontSize: 16,
    fontWeight: "800"
  },
  caregiverRole: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 3
  },
  ratingBadge: {
    minWidth: 54,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4
  },
  ratingText: {
    color: "#3D2415",
    fontSize: 12,
    fontWeight: "800"
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  metaItem: {
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "#FFF8F0",
    paddingHorizontal: 10,
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  metaItemWide: {
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "#FFF8F0",
    paddingHorizontal: 10,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    flexGrow: 1
  },
  metaText: {
    color: "#6F5648",
    fontSize: 12,
    fontWeight: "700"
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14
  },
  tag: {
    borderRadius: 999,
    backgroundColor: "#FFF0D2",
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  tagText: {
    color: "#8A4A1F",
    fontSize: 11,
    fontWeight: "800"
  },
  bookButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  bookButtonSelected: {
    backgroundColor: "#067647"
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  }
});
