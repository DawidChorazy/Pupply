import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, TouchableOpacity, View } from "react-native";

import { ApiError } from "@/services/api-client";
import { searchSitters } from "@/services/sitters-service";
import { SitterSearchItem, SitterServiceType } from "@/types/marketplace";
import { marketplaceStyles as styles } from "@/styles/marketplace";

const serviceLabels: Record<SitterServiceType, string> = {
  DOG_WALK: "Spacer",
  DROP_IN: "Wizyta domowa",
  DAY_CARE: "Opieka dzienna"
};

export default function SittersScreen() {
  const [latitude, setLatitude] = useState("52.2297");
  const [longitude, setLongitude] = useState("21.0122");
  const [radius, setRadius] = useState("25");
  const [serviceType, setServiceType] = useState<SitterServiceType>("DOG_WALK");
  const [items, setItems] = useState<SitterSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const lat = Number(latitude.replace(",", "."));
    const lng = Number(longitude.replace(",", "."));
    const radiusKm = Number(radius.replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm)) {
      setError("Podaj prawidłowe współrzędne i promień");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await searchSitters({ latitude: lat, longitude: lng, radiusKm, serviceType });
      setItems(response.items);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać opiekunów");
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude, radius, serviceType]);

  const openBooking = (sitter: SitterSearchItem) => {
    const service = sitter.services[0];
    const slot = sitter.availability.find((candidate) => {
      const duration = (new Date(candidate.endsAt).getTime() - new Date(candidate.startsAt).getTime()) / 60000;
      return duration >= (service?.durationMinutes ?? Number.POSITIVE_INFINITY);
    });
    if (!service || !slot) return;
    router.push({
      pathname: "/marketplace/book" as never,
      params: { sitterName: sitter.displayName, sitterServiceId: service.id, availabilitySlotId: slot.id }
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#3D2415" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Marketplace</Text>
          <Text style={styles.title}>Znajdź opiekę</Text>
          <Text style={styles.subtitle}>Wyszukaj aktywnych opiekunów i wolne terminy.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Rodzaj usługi</Text>
        <View style={styles.wrap}>
          {(Object.keys(serviceLabels) as SitterServiceType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, serviceType === type && styles.chipActive]}
              onPress={() => setServiceType(type)}
            >
              <Text style={[styles.chipText, serviceType === type && styles.chipTextActive]}>{serviceLabels[type]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.divider} />
        <Text style={styles.label}>Twoja lokalizacja</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={latitude} onChangeText={setLatitude} placeholder="Szerokość" keyboardType="decimal-pad" />
          <TextInput style={[styles.input, styles.half]} value={longitude} onChangeText={setLongitude} placeholder="Długość" keyboardType="decimal-pad" />
        </View>
        <TextInput style={styles.input} value={radius} onChangeText={setRadius} placeholder="Promień w km" keyboardType="decimal-pad" />
        <TouchableOpacity style={[styles.primaryButton, isLoading && styles.buttonDisabled]} onPress={load} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Szukaj opiekunów</Text>}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.statusError}>{error}</Text> : null}
      {!isLoading && !error && items.length === 0 ? (
        <View style={styles.card}><View style={styles.empty}><Text style={styles.cardTitle}>Brak wyników</Text><Text style={styles.muted}>Zwiększ promień albo wybierz inną usługę.</Text></View></View>
      ) : null}

      {items.map((sitter) => {
        const service = sitter.services[0];
        const validSlots = sitter.availability.filter((slot) => {
          const duration = (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000;
          return duration >= (service?.durationMinutes ?? Number.POSITIVE_INFINITY);
        });
        return (
          <View style={styles.card} key={sitter.id}>
            <View style={styles.spaceBetween}>
              <View style={styles.headerCopy}>
                <Text style={styles.cardTitle}>{sitter.displayName}</Text>
                <Text style={styles.muted}>{sitter.city} • {sitter.distanceKm.toFixed(1)} km</Text>
              </View>
              {service ? <Text style={styles.price}>{(service.priceCents / 100).toFixed(2)} zł</Text> : null}
            </View>
            <Text style={[styles.body, { marginTop: 10 }]}>{sitter.bio}</Text>
            <View style={styles.divider} />
            {service ? <Text style={styles.muted}>{serviceLabels[service.type]} • {service.durationMinutes} min</Text> : null}
            <Text style={[styles.label, { marginTop: 10 }]}>Najbliższy wolny termin</Text>
            <Text style={styles.body}>{validSlots[0] ? new Date(validSlots[0].startsAt).toLocaleString("pl-PL") : "Brak wolnych terminów"}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, (!service || !validSlots.length) && styles.buttonDisabled]}
              disabled={!service || !validSlots.length}
              onPress={() => openBooking(sitter)}
            >
              <Text style={styles.primaryButtonText}>Zarezerwuj</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}
