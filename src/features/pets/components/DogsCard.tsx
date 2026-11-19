import { Pet } from "@/features/pets/types/pets";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { Image } from "expo-image";
import { ActivityIndicator, TouchableOpacity, View, Platform, StyleSheet } from "react-native";

type DogsCardProps = {
  pets: Pet[];
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  onAddDog?: () => void;
  onOpenPet?: (petId: string) => void;
};

export function DogsCard({ pets, isLoading = false, error = "", onRetry, onAddDog, onOpenPet }: DogsCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="dog" size={20} color="#D35400" />
          <Text style={styles.sectionTitle}>Moje zwierzaki</Text>
        </View>

        <TouchableOpacity onPress={onAddDog}>
          <Text style={styles.sectionAction}>Dodaj</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.sectionCard}>
          <ActivityIndicator color="#D35400" />
        </View>
      ) : error ? (
        <View style={styles.sectionCard}>
          <Text style={styles.petsError}>{error}</Text>
          {onRetry ? <TouchableOpacity onPress={onRetry} accessibilityRole="button"><Text style={styles.sectionAction}>Spróbuj ponownie</Text></TouchableOpacity> : null}
        </View>
      ) : pets.length === 0 ? (
        <TouchableOpacity style={styles.emptyCard} onPress={onAddDog}>
          <View style={styles.emptyIllustration}>
            <MaterialCommunityIcons name="dog" size={40} color="#D35400" />
          </View>

          <Text style={styles.emptyTitle}>Dodaj pierwszego zwierzaka</Text>
          <Text style={styles.emptySubtitle}>Profil pomoże szybciej dobrać opiekę.</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.sectionCard}>
          {pets.map((pet, index) => {
            const meta = [pet.breed, pet.age !== null ? `${pet.age} ${pet.age === 1 ? "rok" : pet.age % 10 >= 2 && pet.age % 10 <= 4 && (pet.age % 100 < 12 || pet.age % 100 > 14) ? "lata" : "lat"}` : null]
              .filter(Boolean)
              .join(" • ");

            return (
              <TouchableOpacity
                key={pet.id}
                style={[styles.petRow, index === pets.length - 1 && styles.petRowLast]}
                onPress={() => onOpenPet?.(pet.id)}
              >
                <View style={styles.petAvatar}>
                  {pet.photoUrl ? (
                    <Image
                      source={{ uri: pet.photoUrl }}
                      style={styles.petAvatarImage}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <MaterialCommunityIcons name="paw" size={18} color="#D35400" />
                  )}
                </View>

                <View style={styles.petInfo}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  {meta ? <Text style={styles.petMeta}>{meta}</Text> : null}
                </View>

                <MaterialCommunityIcons
                  name={pet.gender === "FEMALE" ? "gender-female" : "gender-male"}
                  size={18}
                  color="#D35400"
                />
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.addAnotherPetButton} onPress={onAddDog}>
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#D35400" />
            <Text style={styles.addAnotherPetText}>Dodaj kolejnego zwierzaka</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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

const styles = StyleSheet.create({
  section: {
    marginBottom: 22
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  sectionTitle: {
    color: "#3D2415",
    fontSize: 18,
    fontWeight: "800"
  },
  sectionAction: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "800"
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  petsError: {
    color: "#B42318",
    fontSize: 13,
    textAlign: "center"
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    ...raisedShadow
  },
  emptyIllustration: {
    height: 108,
    borderRadius: 16,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  emptyTitle: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 5
  },
  emptySubtitle: {
    color: "#8A6D5B",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  },
  petRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2E4D8"
  },
  petRowLast: {
    borderBottomWidth: 0
  },
  petAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    overflow: "hidden"
  },
  petAvatarImage: {
    width: 34,
    height: 34
  },
  petInfo: {
    flex: 1
  },
  petName: {
    color: "#3D2415",
    fontSize: 15,
    fontWeight: "800"
  },
  petMeta: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 2
  },
  addAnotherPetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F2E4D8"
  },
  addAnotherPetText: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700"
  }
});
