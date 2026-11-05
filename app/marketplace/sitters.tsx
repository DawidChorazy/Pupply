import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, TouchableOpacity, View, StyleSheet } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { searchSitters } from "@/features/marketplace/services/sitters-service";
import { SitterSearchItem, SitterService, SitterServiceType } from "@/features/marketplace/types/marketplace";

import { CareLocationPicker } from "@/features/marketplace/components/CareLocationPicker";
import { CareLocation } from "@/features/marketplace/services/location-service";

const serviceLabels: Record<SitterServiceType, string> = {
  DOG_WALK: "Spacer",
  DROP_IN: "Wizyta domowa",
  DAY_CARE: "Opieka dzienna"
};

export default function SittersScreen() {
  const [location, setLocation] = useState<CareLocation | null>(null);
  const [radius, setRadius] = useState("25");
  const [serviceType, setServiceType] = useState<SitterServiceType>("DOG_WALK");
  const [items, setItems] = useState<SitterSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Record<string, string>>({});
  const searchRevision = useRef(0);

  const resetResults = () => {
    searchRevision.current += 1;
    setIsLoading(false);
    setItems([]);
    setSelectedServiceIds({});
    setHasSearched(false);
    setError("");
  };

  const changeLocation = (value: CareLocation | null) => {
    setLocation(value);
    resetResults();
  };

  const load = useCallback(async () => {
    if (!location) {
      setError("Wybierz miejscowość z podpowiedzi lub użyj swojej lokalizacji.");
      return;
    }
    const { latitude: lat, longitude: lng } = location;
    const radiusKm = Number(radius.replace(",", "."));
    if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 100) {
      setError("Podaj odległość od 1 do 100 km");
      return;
    }

    const current = ++searchRevision.current;
    setIsLoading(true);
    setItems([]);
    setError("");
    try {
      const response = await searchSitters({ latitude: lat, longitude: lng, radiusKm, serviceType });
      if (current !== searchRevision.current) return;
      setItems(response.items);
      setHasSearched(true);
    } catch (requestError) {
      if (current === searchRevision.current) setError(requestError instanceof ApiError ? requestError.message : "Nie udało się pobrać opiekunów");
    } finally {
      if (current === searchRevision.current) setIsLoading(false);
    }
  }, [location, radius, serviceType]);

  const openBooking = (sitter: SitterSearchItem, service: SitterService) => {
    const slot = sitter.availability.find((candidate) => {
      const duration = (new Date(candidate.endsAt).getTime() - new Date(candidate.startsAt).getTime()) / 60000;
      return duration >= (service?.durationMinutes ?? Number.POSITIVE_INFINITY);
    });
    if (!service || !slot) return;
    router.push({
      pathname: "/marketplace/book" as never,
      params: { sitterId: sitter.id, sitterName: sitter.displayName, sitterServiceId: service.id }
    });
  };

  return (
    <FlatList<SitterSearchItem>
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      data={items}
      keyExtractor={(sitter) => sitter.id}
      extraData={selectedServiceIds}
      ListHeaderComponent={
        <>
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
                  onPress={() => { setServiceType(type); resetResults(); }}
                >
                  <Text style={[styles.chipText, serviceType === type && styles.chipTextActive]}>{serviceLabels[type]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.divider} />
            <CareLocationPicker value={location} onChange={changeLocation} />
            <Text style={styles.label}>Odległość od lokalizacji</Text>
            <View style={[styles.wrap, { marginBottom: 10 }]}>
              {[5, 10, 25, 50].map(km => <TouchableOpacity key={km} style={[styles.chip, Number(radius) === km && styles.chipActive]} onPress={() => { setRadius(String(km)); resetResults(); }} accessibilityRole="button" accessibilityState={{ selected: Number(radius) === km }}><Text style={[styles.chipText, Number(radius) === km && styles.chipTextActive]}>Do {km} km</Text></TouchableOpacity>)}
            </View>
            <TouchableOpacity style={[styles.primaryButton, isLoading && styles.buttonDisabled]} onPress={load} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Szukaj opiekunów</Text>}
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.statusError}>{error}</Text> : null}
        </>
      }
      ListEmptyComponent={!isLoading && !error && hasSearched ? (
        <View style={styles.card}><View style={styles.empty}><Text style={styles.cardTitle}>Brak wyników</Text><Text style={styles.muted}>Zwiększ promień albo wybierz inną usługę.</Text></View></View>
      ) : null}

      renderItem={({ item: sitter }) => {
        const service = sitter.services.find(item => item.id === selectedServiceIds[sitter.id]) ?? sitter.services[0];
        const validSlots = sitter.availability.filter((slot) => {
          const duration = (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000;
          return duration >= (service?.durationMinutes ?? Number.POSITIVE_INFINITY);
        });
        return (
          <View style={styles.card}>
            <View style={styles.spaceBetween}>
              {sitter.photoUrl ? <Image source={{ uri: sitter.photoUrl }} style={{ width: 56, height: 56, borderRadius: 18, marginRight: 12 }} /> : null}
              <View style={styles.headerCopy}>
                <Text style={styles.cardTitle}>{sitter.displayName}</Text>
                <Text style={styles.muted}>{[sitter.city, sitter.region && `woj. ${sitter.region}`].filter(Boolean).join(" · ")} • {sitter.distanceKm.toFixed(1)} km</Text>
              </View>
              {service ? <Text style={styles.price}>{(service.priceCents / 100).toFixed(2)} zł</Text> : null}
            </View>
            <Text style={[styles.body, { marginTop: 10 }]}>{sitter.bio}</Text>
            <View style={styles.divider} />
            {sitter.services.length > 1 ? <View style={[styles.wrap, { marginBottom: 12 }]}>{sitter.services.map(variant => <TouchableOpacity key={variant.id} style={[styles.chip, service?.id === variant.id && styles.chipActive]} onPress={() => setSelectedServiceIds(current => ({ ...current, [sitter.id]: variant.id }))} accessibilityRole="button" accessibilityState={{ selected: service?.id === variant.id }}><Text style={[styles.chipText, service?.id === variant.id && styles.chipTextActive]}>{variant.durationMinutes} min · {(variant.priceCents / 100).toFixed(2)} zł</Text></TouchableOpacity>)}</View> : null}
            {service ? <Text style={styles.muted}>{serviceLabels[service.type]} • {service.durationMinutes} min</Text> : null}
            <Text style={[styles.label, { marginTop: 10 }]}>Najbliższy wolny termin</Text>
            <Text style={styles.body}>{validSlots[0] ? new Date(validSlots[0].startsAt).toLocaleString("pl-PL") : "Brak wolnych terminów"}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, (!service || !validSlots.length) && styles.buttonDisabled]}
              disabled={!service || !validSlots.length}
              onPress={() => { if (service) openBooking(sitter, service); }}
            >
              <Text style={styles.primaryButtonText}>Wybierz dzień i godzinę</Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#D35400", fontSize: 13, fontWeight: "700", marginBottom: 3 },
  title: { color: "#3D2415", fontSize: 27, fontWeight: "800" },
  subtitle: { color: "#8A6D5B", fontSize: 13, lineHeight: 18, marginTop: 4 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  label: { color: "#6F5648", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7CBB8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF"
  },
  chipActive: { backgroundColor: "#D35400", borderColor: "#D35400" },
  chipText: { color: "#7A3B12", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF" },
  divider: { height: 1, backgroundColor: "#F2E4D8", marginVertical: 12 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 6
  },
  buttonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  statusError: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  empty: { alignItems: "center", paddingVertical: 24 },
  cardTitle: { color: "#3D2415", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  muted: { color: "#9A7D6A", fontSize: 12, lineHeight: 17 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  price: { color: "#D35400", fontSize: 15, fontWeight: "800" },
  body: { color: "#6F5648", fontSize: 13, lineHeight: 19 }
});
