import { BottomMenu } from "@/features/navigation/BottomMenu";
import { DogsCard } from "@/features/home/components/DogsCard";
import { usePetsList } from "@/features/pets/usePetsList";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/services/api-client";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken
} from "@/services/auth-storage";
import { getMyProfile, logout, updateMyProfile } from "@/services/auth-service";
import {
  getSessionRevision,
  subscribeSessionChanged
} from "@/services/session-events";
import { ProfileResponse } from "@/types/auth";
import { validateProfileForm } from "@/features/profile/validation";

type Profile = ProfileResponse["profile"];
const toForm = (profile: Profile) => ({
  fullName: profile.fullName,
  phone: profile.phone,
  birthDate: profile.birthDate?.slice(0, 10) ?? ""
});

export default function ProfileScreen() {
  const {
    pets,
    isLoading: petsLoading,
    error: petsError,
    refreshPets,
    authRequired
  } = usePetsList();
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", birthDate: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const mounted = useRef(true);
  const busy = useRef(false);
  const revision = useRef(getSessionRevision());
  const active = useCallback(
    () => mounted.current && revision.current === getSessionRevision(),
    []
  );
  const leave = useCallback(async () => {
    await clearAuthTokens();
    router.replace("/");
  }, []);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeSessionChanged(() => {
      request.current += 1;
      setAuthenticated(false);
      setProfile(null);
      setForm({ fullName: "", phone: "", birthDate: "" });
      setEditing(false);
      router.replace("/");
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authRequired) void leave();
  }, [authRequired, leave]);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!active()) return;
      if (!token) {
        await leave();
        return;
      }
      setAuthenticated(true);
      const response = await getMyProfile(token);
      if (!active() || id !== request.current) return;
      setProfile(response.profile);
    } catch (err) {
      if (!active() || id !== request.current) return;
      if (err instanceof ApiError && err.status === 401) {
        await leave();
        return;
      }
      setError(
        err instanceof ApiError && err.status === 403
          ? "Ten profil jest dostępny dla konta użytkownika."
          : "Nie udało się pobrać danych konta. Spróbuj ponownie."
      );
    } finally {
      if (active() && id === request.current) setLoading(false);
    }
  }, [active, leave]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current += 1;
      };
    }, [load])
  );

  const save = async () => {
    if (busy.current || !profile) return;
    const validation = validateProfileForm(form);
    setSaveError(validation);
    if (validation) return;
    busy.current = true;
    setSaving(true);
    setSuccess("");
    request.current += 1;
    setLoading(false);
    try {
      const response = await updateMyProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        birthDate: form.birthDate.trim() || null
      });
      if (!active()) return;
      setProfile(response.profile);
      setEditing(false);
      setSuccess("Zapisano dane konta.");
    } catch (err) {
      if (!active()) return;
      if (err instanceof ApiError && err.status === 401) {
        await leave();
        return;
      }
      setSaveError(
        "Nie udało się zapisać danych. Sprawdź połączenie i spróbuj ponownie."
      );
    } finally {
      busy.current = false;
      if (active()) setSaving(false);
    }
  };

  const signOut = async () => {
    if (busy.current) return;
    busy.current = true;
    setLeaving(true);
    try {
      const token = await getRefreshToken();
      // Local logout must not wait for an unavailable server.
      if (token) void logout(token).catch(() => undefined);
      await leave();
    } catch {
      setSaveError("Nie udało się wyczyścić sesji. Spróbuj ponownie.");
    } finally {
      busy.current = false;
      if (mounted.current) setLeaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), refreshPets()]);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.shell} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              enabled={!saving && !leaving}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons
                name="account-heart-outline"
                size={36}
                color="#D35400"
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Profil</Text>
              <Text style={styles.title}>
                {profile?.fullName || "Twój profil"}
              </Text>
              <Text style={styles.subtitle}>
                Twoje konto i pupile w jednym miejscu.
              </Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Konto</Text>
            {loading ? (
              <ActivityIndicator
                color="#D35400"
                accessibilityLabel="Ładowanie konta"
              />
            ) : null}
            {error ? (
              <View>
                <Text style={styles.error}>{error}</Text>
                <TouchableOpacity
                  onPress={() => void load()}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>Spróbuj ponownie</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {profile ? (
              <>
                <Text style={styles.rowText}>{profile.email}</Text>
                <Text style={styles.subtitle}>
                  {profile.emailVerifiedAt
                    ? "E-mail zweryfikowany"
                    : "E-mail niezweryfikowany"}
                </Text>
                <TouchableOpacity onPress={() => router.push("/account-settings" as never)}><Text style={styles.link}>Ustawienia konta i powiadomień</Text></TouchableOpacity>
                {!profile.emailVerifiedAt ? <TouchableOpacity onPress={() => router.push("/verify-email" as never)}><Text style={styles.link}>Potwierdź e-mail</Text></TouchableOpacity> : null}
                {editing ? (
                  <>
                    {(
                      [
                        ["fullName", "Imię i nazwisko"],
                        ["phone", "Telefon"],
                        ["birthDate", "Data urodzenia (RRRR-MM-DD)"]
                      ] as const
                    ).map(([key, label]) => (
                      <View key={key}>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                          accessibilityLabel={label}
                          style={styles.input}
                          value={form[key]}
                          editable={!saving}
                          onChangeText={(value) =>
                            setForm((current) => ({ ...current, [key]: value }))
                          }
                          keyboardType={
                            key === "phone" ? "phone-pad" : "default"
                          }
                          autoCapitalize={key === "fullName" ? "words" : "none"}
                          placeholder={
                            key === "birthDate"
                              ? "RRRR-MM-DD (opcjonalnie)"
                              : label
                          }
                        />
                      </View>
                    ))}
                    <View style={styles.statsRow}>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => void save()}
                        disabled={saving}
                        accessibilityRole="button"
                      >
                        {saving ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text style={styles.buttonText}>Zapisz</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        disabled={saving}
                        onPress={() => {
                          setEditing(false);
                          setForm(toForm(profile));
                          setSaveError("");
                        }}
                        accessibilityRole="button"
                      >
                        <Text style={styles.link}>Anuluj</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Imię i nazwisko</Text>
                    <Text style={styles.rowText}>{profile.fullName}</Text>
                    <Text style={styles.label}>Telefon</Text>
                    <Text style={styles.rowText}>
                      {profile.phone || "Nie podano"}
                    </Text>
                    <Text style={styles.label}>Data urodzenia</Text>
                    <Text style={styles.rowText}>
                      {profile.birthDate
                        ? profile.birthDate
                            .slice(0, 10)
                            .split("-")
                            .reverse()
                            .join(".")
                        : "Nie podano"}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => {
                        setForm(toForm(profile));
                        setEditing(true);
                        setSuccess("");
                        setSaveError("");
                      }}
                    >
                      <Text style={styles.link}>Edytuj dane</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : null}
            {saveError ? (
              <Text style={styles.error} accessibilityRole="alert">
                {saveError}
              </Text>
            ) : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}
          </View>
          {authenticated ? (
            <>
              {!petsLoading && !petsError ? (
                <Text style={styles.cardTitle}>
                  Liczba pupili: {pets.length}
                </Text>
              ) : null}
              <DogsCard
                pets={pets}
                isLoading={petsLoading}
                error={
                  petsError
                    ? "Nie udało się pobrać pupili. Spróbuj ponownie."
                    : ""
                }
                onRetry={() => void refreshPets()}
                onAddDog={() => router.push("/mainScreen/AddDogScreen")}
                onOpenPet={(id) =>
                  router.push({
                    pathname: "/mainScreen/pets/[id]",
                    params: { id }
                  })
                }
              />
            </>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void signOut()}
            disabled={saving || leaving}
            accessibilityRole="button"
          >
            {leaving ? (
              <ActivityIndicator color="#D35400" />
            ) : (
              <Text style={styles.link}>Wyloguj się</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomMenu activeTab="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: { color: "#8A6D5B", fontSize: 13, marginTop: 14, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#F2E4D8",
    borderRadius: 12,
    padding: 12,
    color: "#3D2415",
    marginBottom: 8
  },
  button: {
    backgroundColor: "#D35400",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    flex: 1,
    marginTop: 12
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  secondaryButton: { padding: 12, alignItems: "center", marginTop: 12 },
  link: { color: "#D35400", fontWeight: "700", paddingVertical: 10 },
  error: { color: "#B42318", marginVertical: 10 },
  success: { color: "#187445", marginTop: 10 },
  shell: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0"
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 28
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
    paddingBottom: 22
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#FFF0D2",
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: {
    flex: 1
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  cardTitle: {
    color: "#3D2415",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12
  },
  row: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowText: {
    color: "#6F5648",
    fontSize: 14,
    fontWeight: "700"
  },
  statsRow: {
    flexDirection: "row",
    gap: 10
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    alignItems: "center"
  },
  statValue: {
    color: "#D35400",
    fontSize: 24,
    fontWeight: "900"
  },
  statLabel: {
    color: "#8A6D5B",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  }
});
