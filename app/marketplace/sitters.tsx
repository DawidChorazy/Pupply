import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, TouchableOpacity, View } from "react-native";

import { ApiError } from "@/services/api-client";
import { searchSitters } from "@/services/sitters-service";
import { SitterSearchItem, SitterService, SitterServiceType } from "@/types/marketplace";
import { marketplaceStyles as styles } from "@/styles/marketplace";
import { CareLocationPicker } from "@/components/forms/care-location-picker";
import { CareLocation } from "@/services/location-service";

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
      params: { sitterName: sitter.displayName, sitterServiceId: service.id, availabilitySlotId: slot.id, startsAt: slot.startsAt }
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
      {!isLoading && !error && hasSearched && items.length === 0 ? (
        <View style={styles.card}><View style={styles.empty}><Text style={styles.cardTitle}>Brak wyników</Text><Text style={styles.muted}>Zwiększ promień albo wybierz inną usługę.</Text></View></View>
      ) : null}

      {items.map((sitter) => {
        const service = sitter.services.find(item => item.id === selectedServiceIds[sitter.id]) ?? sitter.services[0];
        const validSlots = sitter.availability.filter((slot) => {
          const duration = (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000;
          return duration >= (service?.durationMinutes ?? Number.POSITIVE_INFINITY);
        });
        return (
          <View style={styles.card} key={sitter.id}>
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
              <Text style={styles.primaryButtonText}>Zarezerwuj</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}
