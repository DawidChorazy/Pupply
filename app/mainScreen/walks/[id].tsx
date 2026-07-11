import { bookWalkStyles as styles } from "@/features/walks/styles";
import { WalkMapPreview } from "@/features/walks/components/WalkMapPreview";
import { WalkProgressBar } from "@/features/walks/components/WalkProgressBar";
import { getCaregiverById } from "@/features/walks/mockData";
import { useWalksList } from "@/features/walks/useWalksList";
import {
  formatElapsedTime,
  getWalkElapsedSeconds,
  getWalkStage,
  getWalkStageLabel
} from "@/features/walks/walkStage";
import { WalkStage } from "@/types/walks";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView, TouchableOpacity, View } from "react-native";

function getStatusBannerStyle(stage: WalkStage) {
  switch (stage) {
    case "waiting":
      return styles.detailStatusBannerWaiting;
    case "in_progress":
      return styles.detailStatusBannerActive;
    case "returning":
      return styles.detailStatusBannerReturning;
    case "completed":
      return styles.detailStatusBannerCompleted;
  }
}

function getStatusMessage(stage: WalkStage, caregiverName: string, petName: string) {
  switch (stage) {
    case "waiting":
      return {
        title: "Oczekiwanie na opiekuna",
        text: `${caregiverName} wkrótce odbierze ${petName} i rozpocznie spacer.`
      };
    case "in_progress":
      return {
        title: "Spacer w trakcie",
        text: `${petName} jest na spacerze z ${caregiverName}. Możesz śledzić trasę na mapie.`
      };
    case "returning":
      return {
        title: "Powrót do domu",
        text: `${caregiverName} wraca z ${petName}. Spacer dobiega końca.`
      };
    case "completed":
      return {
        title: "Spacer zakończony",
        text: `${petName} wrócił bezpiecznie. Dziękujemy za skorzystanie z usługi.`
      };
  }
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailFieldLabel}>{label}</Text>
      <Text style={styles.detailFieldValue}>{value}</Text>
    </View>
  );
}

export default function WalkDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { walks } = useWalksList();
  const [now, setNow] = useState(Date.now());

  const walk = walks.find((item) => item.id === (id ? String(id) : ""));
  const caregiver = getCaregiverById(walk?.caregiverId);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!walk) {
    return (
      <View style={[styles.container, styles.contentContainer]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Nie znaleziono spaceru</Text>
          </View>
        </View>
      </View>
    );
  }

  const bookedAt = walk.bookedAt ?? new Date().toISOString();
  const normalizedWalk = { ...walk, bookedAt };
  const stage = getWalkStage(normalizedWalk, now);
  const statusMessage = getStatusMessage(stage, walk.caregiverName, walk.petName);
  const elapsedSeconds = getWalkElapsedSeconds(normalizedWalk, now);
  const showLiveMap = stage === "in_progress" || stage === "returning";

  const handleCall = () => {
    const phone = walk.caregiverPhone?.replace(/\s/g, "") ?? "";
    if (phone) {
      void Linking.openURL(`tel:${phone}`);
    }
  };

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
          <Text style={styles.eyebrow}>Szczegóły spaceru</Text>
          <Text style={styles.title}>
            {walk.petName} z {walk.caregiverName}
          </Text>
          <Text style={styles.subtitle}>{walk.time}</Text>
        </View>
      </View>

      <WalkProgressBar currentStage={stage} />

      <View style={[styles.detailStatusBanner, getStatusBannerStyle(stage)]}>
        <MaterialCommunityIcons
          name={
            stage === "completed"
              ? "check-circle-outline"
              : stage === "in_progress"
                ? "walk"
                : stage === "returning"
                  ? "home-export-outline"
                  : "clock-outline"
          }
          size={22}
          color="#D35400"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.detailStatusTitle}>{statusMessage.title}</Text>
          <Text style={styles.detailStatusText}>{statusMessage.text}</Text>
        </View>
      </View>

      {showLiveMap ? (
        <>
          <WalkMapPreview walk={normalizedWalk} now={now} />

          <View style={styles.liveInfoRow}>
            <View style={styles.liveInfoCard}>
              <Text style={styles.liveInfoLabel}>Czas spaceru</Text>
              <Text style={styles.liveInfoValue}>{formatElapsedTime(elapsedSeconds)}</Text>
              <Text style={styles.detailStatusText}>z {walk.durationLabel}</Text>
            </View>

            <View style={styles.liveInfoCard}>
              <Text style={styles.liveInfoLabel}>Status</Text>
              <Text style={styles.liveInfoValue}>{getWalkStageLabel(stage)}</Text>
              <Text style={styles.detailStatusText}>
                {stage === "returning" ? "Opiekun wraca" : "Trasa aktywna"}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Kontakt z opiekunem</Text>
            <DetailField label="Imię i nazwisko" value={walk.caregiverName} />
            <DetailField label="Telefon" value={walk.caregiverPhone ?? "—"} />

            <TouchableOpacity style={styles.phoneButton} activeOpacity={0.85} onPress={handleCall}>
              <MaterialCommunityIcons name="phone-outline" size={18} color="#D35400" />
              <Text style={styles.phoneButtonText}>Zadzwoń do opiekuna</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informacje o spacerze</Text>
        <DetailField label="Pupil" value={walk.petName} />
        <DetailField label="Opiekun" value={walk.caregiverName} />
        <DetailField label="Termin" value={walk.time} />
        <DetailField label="Długość" value={walk.durationLabel} />
        <DetailField label="Cena" value={`${walk.price} zł`} />
        <DetailField label="Etap" value={getWalkStageLabel(stage)} />
        {caregiver ? <DetailField label="Specjalizacja" value={caregiver.role} /> : null}
      </View>
    </ScrollView>
  );
}
