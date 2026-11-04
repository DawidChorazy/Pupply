
import { getWalkerMapPosition } from "@/features/walks/walkStage";
import { UpcomingWalk } from "@/features/walks/types/walks";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { DimensionValue, View, Platform, StyleSheet } from "react-native";

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

        <View
          style={[
            styles.mapMarkerWalker,
            { left: position.left as DimensionValue, top: position.top as DimensionValue }
          ]}
        >
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

const raisedShadow = Platform.select({
  web: {
    boxShadow: "0 8px 20px rgba(61, 36, 21, 0.08)"
  },
  default: {
    shadowColor: "#3D2415",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4
  }
});

const styles = StyleSheet.create({
  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  mapSurface: {
    height: 220,
    borderRadius: 16,
    backgroundColor: "#E8F4EA",
    overflow: "hidden",
    position: "relative"
  },
  mapGridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "22%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.65)"
  },
  mapGridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "24%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.65)"
  },
  mapParkPatch: {
    position: "absolute",
    right: "8%",
    top: "18%",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#C8E6C9"
  },
  mapRouteLine: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#D35400",
    opacity: 0.45
  },
  mapMarkerHome: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E9B5A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF"
  },
  mapMarkerWalker: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF"
  },
  mapLiveBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  mapLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#12B76A"
  },
  mapLiveText: {
    color: "#067647",
    fontSize: 11,
    fontWeight: "800"
  },
  mapCaption: {
    color: "#8A6D5B",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center"
  }
});
