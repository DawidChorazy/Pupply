import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, StyleSheet } from "react-native";
import { confirmEmailChange } from "@/features/account/services/account-service";
import { clearAuthTokens } from "@/shared/session/auth-storage";
import { confirmEmailVerification, requestEmailVerification } from "@/features/auth/services/auth-service";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string; kind?: string }>();
  const [token, setToken] = useState(params.token ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (token) {
        if (params.kind === "email-change") { await confirmEmailChange(token); await clearAuthTokens(); router.replace("/"); return; }
        await confirmEmailVerification(token); setDone(true); setMessage("Adres e-mail został potwierdzony.");
      }
      else {
        const response = await requestEmailVerification();
        if (response.debugToken) { setToken(response.debugToken); setMessage("Tryb lokalny: kliknij Potwierdź e-mail, aby zakończyć."); }
        else setMessage("Sprawdź skrzynkę i otwórz link potwierdzający. Jeśli adres był już potwierdzony, możesz wrócić do aplikacji.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się potwierdzić adresu"); }
    finally { setBusy(false); }
  };
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Potwierdź e-mail</Text>
    <Text style={styles.body}>Potwierdzenie adresu jest wymagane, aby rezerwować i oferować opiekę.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.statusError}>{error}</Text> : null}
    {message ? <Text style={styles.body}>{message}</Text> : null}
    {!done ? <TouchableOpacity disabled={busy} style={styles.primaryButton} onPress={() => void submit()}>{busy ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>{token ? "Potwierdź e-mail" : "Wyślij link potwierdzający"}</Text>}</TouchableOpacity> : null}
    <TouchableOpacity style={styles.secondaryButton} onPress={() => router.canGoBack() ? router.back() : router.replace("/")}><Text style={styles.secondaryButtonText}>Wróć</Text></TouchableOpacity>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { padding: 20, paddingBottom: 48 },
  title: { color: "#3D2415", fontSize: 27, fontWeight: "800" },
  body: { color: "#6F5648", fontSize: 13, lineHeight: 19 },
  statusError: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 6
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D35400",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 8
  },
  secondaryButtonText: { color: "#D35400", fontSize: 13, fontWeight: "800" }
});
