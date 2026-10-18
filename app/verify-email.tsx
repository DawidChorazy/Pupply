import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity } from "react-native";
import { confirmEmailChange } from "@/services/account-service";
import { clearAuthTokens } from "@/services/auth-storage";
import { confirmEmailVerification, requestEmailVerification } from "@/services/auth-service";
import { marketplaceStyles as styles } from "@/styles/marketplace";

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
