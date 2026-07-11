import { bookWalkStyles as styles } from "@/features/walks/styles";
import { getCaregiverById } from "@/features/walks/mockData";
import { useWalksList } from "@/features/walks/useWalksList";
import { usePetsList } from "@/features/pets/usePetsList";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  View
} from "react-native";

export default function BookWalkScreen() {
  const { caregiverId } = useLocalSearchParams<{ caregiverId?: string }>();
  const caregiver = getCaregiverById(caregiverId ? String(caregiverId) : undefined);
  const { pets, isLoading: isPetsLoading } = usePetsList();
  const { bookWalk } = useWalksList();

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string | null>(null);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId);
  const selectedTimeSlot = caregiver?.timeSlots.find((slot) => slot.id === selectedTimeSlotId);
  const selectedDuration = caregiver?.durations.find((duration) => duration.minutes === selectedDurationMinutes);

  const canConfirm = Boolean(selectedPet && selectedTimeSlot && selectedDuration && caregiver);

  const summaryPrice = selectedDuration?.price ?? 0;

  const timeSlotsByDay = useMemo(() => {
    if (!caregiver) return [];

    return caregiver.timeSlots.reduce<Array<{ dayLabel: string; slots: typeof caregiver.timeSlots }>>(
      (groups, slot) => {
        const existingGroup = groups.find((group) => group.dayLabel === slot.dayLabel);

        if (existingGroup) {
          existingGroup.slots.push(slot);
          return groups;
        }

        return [...groups, { dayLabel: slot.dayLabel, slots: [slot] }];
      },
      []
    );
  }, [caregiver]);

  const handleConfirm = async () => {
    if (!canConfirm || !caregiver || !selectedPet || !selectedTimeSlot || !selectedDuration) {
      setError("Wybierz pupila, godzinę i długość spaceru");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await bookWalk({
        caregiverId: caregiver.id,
        caregiverName: caregiver.name,
        petId: selectedPet.id,
        petName: selectedPet.name,
        timeSlotId: selectedTimeSlot.id,
        timeLabel: selectedTimeSlot.label,
        dayLabel: selectedTimeSlot.dayLabel,
        durationMinutes: selectedDuration.minutes,
        durationLabel: selectedDuration.label,
        price: selectedDuration.price
      });

      router.replace("/mainScreen/MainScreen");
    } catch {
      setError("Nie udało się umówić spaceru");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!caregiver) {
    return (
      <View style={[styles.container, styles.contentContainer]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Nie znaleziono opiekuna</Text>
          </View>
        </View>
      </View>
    );
  }

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
          <Text style={styles.eyebrow}>Rezerwacja</Text>
          <Text style={styles.title}>Umów spacer</Text>
          <Text style={styles.subtitle}>Wybierz pupila, godzinę i długość spaceru.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.caregiverHeader}>
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
            <Text style={styles.metaText}>{caregiver.priceLabel}</Text>
          </View>

          <View style={styles.metaItem}>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Którego pupila wyprowadzamy?</Text>

        {isPetsLoading ? (
          <ActivityIndicator color="#D35400" />
        ) : pets.length === 0 ? (
          <>
            <Text style={styles.emptyPets}>Najpierw dodaj profil zwierzaka, aby umówić spacer.</Text>
            <TouchableOpacity onPress={() => router.push("../mainScreen/AddDogScreen")}>
              <Text style={styles.addPetLink}>Dodaj zwierzaka</Text>
            </TouchableOpacity>
          </>
        ) : (
          pets.map((pet, index) => {
            const isSelected = selectedPetId === pet.id;
            const meta = [pet.breed, pet.age !== null ? `${pet.age} lat` : null].filter(Boolean).join(" • ");

            return (
              <TouchableOpacity
                key={pet.id}
                style={[styles.petRow, index === pets.length - 1 && styles.petRowLast]}
                onPress={() => setSelectedPetId(pet.id)}
              >
                <View style={styles.petAvatar}>
                  {pet.photoUrl ? (
                    <Image source={{ uri: pet.photoUrl }} style={styles.petAvatarImage} />
                  ) : (
                    <MaterialCommunityIcons name="paw" size={18} color="#D35400" />
                  )}
                </View>

                <View style={styles.petInfo}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  {meta ? <Text style={styles.petMeta}>{meta}</Text> : null}
                </View>

                <MaterialCommunityIcons
                  name={isSelected ? "radiobox-marked" : "radiobox-blank"}
                  size={22}
                  color={isSelected ? "#D35400" : "#C9B2A3"}
                />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Godzina spaceru</Text>

        {timeSlotsByDay.map((group) => (
          <View key={group.dayLabel} style={{ marginBottom: 12 }}>
            <Text style={styles.summaryLabel}>{group.dayLabel}</Text>
            <View style={[styles.optionGrid, { marginTop: 8 }]}>
              {group.slots.map((slot) => {
                const isSelected = selectedTimeSlotId === slot.id;

                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[styles.optionChip, isSelected && styles.optionChipActive]}
                    onPress={() => setSelectedTimeSlotId(slot.id)}
                  >
                    <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Długość spaceru</Text>

        <View style={styles.optionGrid}>
          {caregiver.durations.map((duration) => {
            const isSelected = selectedDurationMinutes === duration.minutes;

            return (
              <TouchableOpacity
                key={duration.minutes}
                style={[styles.optionChip, isSelected && styles.optionChipActive]}
                onPress={() => setSelectedDurationMinutes(duration.minutes)}
              >
                <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                  {duration.label}
                </Text>
                <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive, { fontSize: 11 }]}>
                  {duration.price} zł
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {canConfirm ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Podsumowanie</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pupil</Text>
            <Text style={styles.summaryValue}>{selectedPet?.name}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Opiekun</Text>
            <Text style={styles.summaryValue}>{caregiver.name}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Termin</Text>
            <Text style={styles.summaryValue}>
              {selectedTimeSlot?.dayLabel}, {selectedTimeSlot?.label}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Długość</Text>
            <Text style={styles.summaryValue}>{selectedDuration?.label}</Text>
          </View>

          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>Cena</Text>
            <Text style={styles.summaryPrice}>{summaryPrice} zł</Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.statusTextError}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.confirmButton, (!canConfirm || isSubmitting) && styles.confirmButtonDisabled]}
        disabled={!canConfirm || isSubmitting}
        onPress={handleConfirm}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.confirmButtonText}>Zatwierdź spacer</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
