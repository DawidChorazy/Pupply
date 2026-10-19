import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { requestPasswordReset, resetPassword } from "@/services/auth-service";
import { marketplaceStyles as styles } from "@/styles/marketplace";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (token) {
        await resetPassword(token, password, confirmPassword);
        setDone(true); setMessage("Hasło zostało zmienione. Zaloguj się nowym hasłem.");
      } else {
        const response = await requestPasswordReset(email.trim());
        if (response.debugToken) { setToken(response.debugToken); setMessage("Tryb lokalny: możesz ustawić nowe hasło poniżej."); }
        else setMessage("Jeśli konto istnieje, otrzymasz e-mail z linkiem do zmiany hasła.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zresetować hasła"); }
    finally { setBusy(false); }
  };
  return <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Reset hasła</Text>
    {!done && (token ? <>
      <Text style={styles.body}>Minimum 8 znaków, mała i wielka litera oraz znak specjalny.</Text>
      <TextInput accessibilityLabel="Nowe hasło" placeholder="Nowe hasło" style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput accessibilityLabel="Powtórz hasło" placeholder="Powtórz hasło" style={styles.input} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
    </> : <TextInput accessibilityLabel="E-mail" placeholder="E-mail" style={styles.input} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />)}
    {error ? <Text accessibilityRole="alert" style={styles.statusError}>{error}</Text> : null}
    {message ? <Text style={styles.body}>{message}</Text> : null}
    {!done ? <TouchableOpacity disabled={busy} style={styles.primaryButton} onPress={() => void submit()}>{busy ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>{token ? "Ustaw hasło" : "Wyślij link"}</Text>}</TouchableOpacity> : null}
    <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/")}><Text style={styles.secondaryButtonText}>Przejdź do logowania</Text></TouchableOpacity>
  </ScrollView>;
}
