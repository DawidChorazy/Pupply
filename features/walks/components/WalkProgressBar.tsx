import { bookWalkStyles as styles } from "@/features/walks/styles";
import { getWalkStageIndex, WALK_STAGE_STEPS } from "@/features/walks/walkStage";
import { WalkStage } from "@/types/walks";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { View } from "react-native";

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
