import { bookWalkStyles as styles } from "@/features/walks/styles";
import { getWalkerMapPosition } from "@/features/walks/walkStage";
import { UpcomingWalk } from "@/types/walks";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { View } from "react-native";

type WalkMapPreviewProps = {
  walk: UpcomingWalk;
  now: number;
};

export function WalkMapPreview({ walk, now }: WalkMapPreviewProps) {
  const position = getWalkerMapPosition(walk, now);

  return (
    <View style={styles.mapCard}>
      <View style={styles.mapSurface}>
        <View style={styles.mapGridLineHorizontal} />
        <View style={[styles.mapGridLineHorizontal, { top: "45%" }]} />
        <View style={[styles.mapGridLineHorizontal, { top: "75%" }]} />
        <View style={styles.mapGridLineVertical} />
        <View style={[styles.mapGridLineVertical, { left: "38%" }]} />
        <View style={[styles.mapGridLineVertical, { left: "68%" }]} />

        <View style={styles.mapParkPatch} />
        <View style={[styles.mapRouteLine, { left: "18%", top: "62%", width: "52%", transform: [{ rotate: "-18deg" }] }]} />

        <View style={[styles.mapMarkerHome, { left: "16%", top: "58%" }]}>
          <MaterialCommunityIcons name="home" size={14} color="#FFFFFF" />
        </View>

        <View style={[styles.mapMarkerWalker, { left: position.left, top: position.top }]}>
          <MaterialCommunityIcons name="account" size={16} color="#FFFFFF" />
        </View>

        <View style={styles.mapLiveBadge}>
          <View style={styles.mapLiveDot} />
          <Text style={styles.mapLiveText}>Na żywo</Text>
        </View>
      </View>

      <Text style={styles.mapCaption}>Lokalizacja opiekuna w trakcie spaceru</Text>
    </View>
  );
}
