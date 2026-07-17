import { Pet } from "@/types/pets";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { Image } from "expo-image";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

import { styles } from "../styles";

type DogsCardProps = {
  pets: Pet[];
  isLoading?: boolean;
  error?: string;
  onAddDog?: () => void;
  onOpenPet?: (petId: string) => void;
};

export function DogsCard({ pets, isLoading = false, error = "", onAddDog, onOpenPet }: DogsCardProps) {
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
            const meta = [pet.breed, pet.age !== null ? `${pet.age} lat` : null]
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
