import { UpcomingWalk } from "@/types/walks";
import { getWalkStage, getWalkStageLabel } from "@/features/walks/walkStage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { TouchableOpacity, View } from "react-native";

import { styles } from "../styles";

type WalksCardProps = {
  walks?: UpcomingWalk[];
  onBookWalk?: () => void;
  onOpenWalk?: (walkId: string) => void;
};

function getStatusBadgeLabel(walk: UpcomingWalk) {
  const stage = getWalkStage({ ...walk, bookedAt: walk.bookedAt ?? new Date().toISOString() });

  if (stage === "completed") {
    return "Zakończony";
  }

  return getWalkStageLabel(stage);
}

function getStatusBadgeStyle(walk: UpcomingWalk) {
  const stage = getWalkStage({ ...walk, bookedAt: walk.bookedAt ?? new Date().toISOString() });

  if (stage === "completed") {
    return styles.walkStatusBadgeCompleted;
  }

  if (stage === "in_progress" || stage === "returning") {
    return styles.walkStatusBadgeActive;
  }

  return styles.walkStatusBadge;
}

export function WalksCard({ walks = [], onBookWalk, onOpenWalk }: WalksCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#D35400" />
          <Text style={styles.sectionTitle}>Najbliższe spacery</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        {walks.length ? (
          <View style={styles.walksList}>
            {walks.map((walk, index) => (
              <TouchableOpacity
                key={walk.id}
                style={[styles.walkRow, index === walks.length - 1 && styles.walkRowLast]}
                activeOpacity={0.85}
                onPress={() => onOpenWalk?.(walk.id)}
              >
                <View style={styles.walksIconCircleSmall}>
                  <MaterialCommunityIcons name="walk" size={22} color="#D35400" />
                </View>

                <View style={styles.walkInfo}>
                  <Text style={styles.walkTitle}>
                    {walk.petName} z {walk.caregiverName}
                  </Text>
                  <Text style={styles.walkMeta}>
                    {walk.time} · {walk.durationLabel} · {walk.price} zł
                  </Text>
                </View>

                <View style={getStatusBadgeStyle(walk)}>
                  <Text style={styles.walkStatusText}>{getStatusBadgeLabel(walk)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.secondaryButton} onPress={onBookWalk}>
              <Text style={styles.secondaryButtonText}>Umów kolejny spacer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.walksEmptyContent}>
            <View style={styles.walksIconCircle}>
              <MaterialCommunityIcons name="clock-outline" size={30} color="#D35400" />
            </View>

            <Text style={styles.emptyTitle}>Brak spacerów w planie</Text>
            <Text style={styles.emptySubtitle}>Umów spacer, kiedy tylko będzie potrzebny.</Text>

            <TouchableOpacity style={styles.secondaryButton} onPress={onBookWalk}>
              <Text style={styles.secondaryButtonText}>Umów spacer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
