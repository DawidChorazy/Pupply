
import { getWalkStageIndex, WALK_STAGE_STEPS } from "@/features/walks/walkStage";
import { WalkStage } from "@/features/walks/types/walks";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { View, Platform, StyleSheet } from "react-native";

type WalkProgressBarProps = {
  currentStage: WalkStage;
};

export function WalkProgressBar({ currentStage }: WalkProgressBarProps) {
  const currentIndex = getWalkStageIndex(currentStage);

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressTrack}>
        {WALK_STAGE_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          const isLast = index === WALK_STAGE_STEPS.length - 1;

          return (
            <View key={step.key} style={styles.progressStep}>
              <View style={styles.progressStepTop}>
                <View
                  style={[
                    styles.progressDot,
                    (isCompleted || isActive) && styles.progressDotActive,
                    isActive && styles.progressDotCurrent
                  ]}
                >
                  <MaterialCommunityIcons
                    name={step.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={14}
                    color={isCompleted || isActive ? "#FFFFFF" : "#A98D7B"}
                  />
                </View>

                {!isLast ? (
                  <View style={[styles.progressLine, index < currentIndex && styles.progressLineActive]} />
                ) : null}
              </View>

              <Text style={[styles.progressLabel, isActive && styles.progressLabelActive]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
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
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14,
    ...raisedShadow
  },
  progressTrack: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressStep: {
    flex: 1,
    alignItems: "center"
  },
  progressStepTop: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  progressDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F2E4D8",
    alignItems: "center",
    justifyContent: "center"
  },
  progressDotActive: {
    backgroundColor: "#D35400"
  },
  progressDotCurrent: {
    borderWidth: 3,
    borderColor: "#FFE2C8"
  },
  progressLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#F2E4D8",
    marginHorizontal: 4,
    borderRadius: 999
  },
  progressLineActive: {
    backgroundColor: "#D35400"
  },
  progressLabel: {
    color: "#8A6D5B",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center"
  },
  progressLabelActive: {
    color: "#3D2415"
  }
});
