import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "@react-navigation/elements";
import { useCallback, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { listBookings } from "@/services/bookings-service";
import { Booking } from "@/types/marketplace";
import { styles } from "@/styles/main-screen";

type WalksCardProps = {
  onBookWalk?: () => void;
  onOpenBookings?: () => void;
};

export function WalksCard({ onBookWalk, onOpenBookings }: WalksCardProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      listBookings({ perspective: "all", pageSize: 20 })
        .then((response) => {
          if (!active) return;
          setBookings(
            response.items
              .filter((booking) => ["REQUESTED", "ACCEPTED"].includes(booking.status) && new Date(booking.availabilitySlot.endsAt) > new Date())
              .sort((a, b) => a.availabilitySlot.startsAt.localeCompare(b.availabilitySlot.startsAt))
              .slice(0, 3)
          );
        })
        .catch(() => { if (active) setBookings([]); })
        .finally(() => { if (active) setIsLoading(false); });
      return () => { active = false; };
    }, [])
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#D35400" />
          <Text style={styles.sectionTitle}>Najbliższe spacery</Text>
        </View>
        <TouchableOpacity onPress={onOpenBookings}>
          <Text style={styles.sectionAction}>Wszystkie</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionCard}>
        {isLoading ? <ActivityIndicator color="#D35400" /> : bookings.length ? bookings.map((booking, index) => (
          <TouchableOpacity
            key={booking.id}
            style={[styles.bookingPreview, index === bookings.length - 1 && styles.petRowLast]}
            onPress={onOpenBookings}
          >
            <View style={styles.walksIconCircleSmall}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color="#D35400" />
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{booking.pet.name}</Text>
              <Text style={styles.petMeta}>{new Date(booking.availabilitySlot.startsAt).toLocaleString("pl-PL")}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#D35400" />
          </TouchableOpacity>
        )) : <View style={styles.walksEmptyContent}>
          <View style={styles.walksIconCircle}>
            <MaterialCommunityIcons name="clock-outline" size={30} color="#D35400" />
          </View>

          <Text style={styles.emptyTitle}>Brak spacerów w planie</Text>
          <Text style={styles.emptySubtitle}>Umów spacer, kiedy tylko będzie potrzebny.</Text>

          <TouchableOpacity style={styles.secondaryButton} onPress={onBookWalk}>
            <Text style={styles.secondaryButtonText}>Umów spacer</Text>
          </TouchableOpacity>
        </View>}
      </View>
    </View>
  );
}
