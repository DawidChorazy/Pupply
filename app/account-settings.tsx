import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { changeEmail, changePassword, deactivateAccount, getPreferences, setEmailNotifications } from "@/services/account-service";
import { enablePushNotifications, disablePushNotifications } from "@/services/push-service";
import { clearAuthTokens } from "@/services/auth-storage";
import { marketplaceStyles as styles } from "@/styles/marketplace";

export default function AccountSettingsScreen() {
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [emailNotifications, setEmails] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; getPreferences().then(p => { if (active) setEmails(p.emailNotifications); }).catch(() => { if (active) setError("Nie udało się pobrać ustawień powiadomień. Otwórz ekran ponownie."); }); return () => { active = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać zmian"); }
    finally { setBusy(false); }
  };
  const leave = async () => { await clearAuthTokens(); router.replace("/"); };
  return <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <TouchableOpacity onPress={() => router.back()}><Text style={styles.secondaryButtonText}>Wróć</Text></TouchableOpacity>
    <Text style={styles.title}>Ustawienia konta</Text>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.statusError}>{error}</Text> : null}
    {message ? <Text style={styles.body}>{message}</Text> : null}
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Hasło i e-mail</Text>
      <TextInput style={styles.input} placeholder="Obecne hasło" accessibilityLabel="Obecne hasło" secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput style={styles.input} placeholder="Nowe hasło" accessibilityLabel="Nowe hasło" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
      <TouchableOpacity disabled={busy} style={styles.secondaryButton} onPress={() => void run(async () => { await changePassword(password, newPassword); await leave(); })}><Text style={styles.secondaryButtonText}>Zmień hasło i wyloguj</Text></TouchableOpacity>
      <TextInput style={styles.input} placeholder="Nowy adres e-mail" accessibilityLabel="Nowy adres e-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TouchableOpacity disabled={busy} style={styles.secondaryButton} onPress={() => void run(async () => {
        const response = await changeEmail(email, password);
        if (response.debugToken) router.push({ pathname: "/verify-email" as never, params: { kind: "email-change", token: response.debugToken } });
        else setMessage("Otwórz link wysłany na nowy adres, aby potwierdzić zmianę.");
      })}><Text style={styles.secondaryButtonText}>Potwierdź zmianę e-maila</Text></TouchableOpacity>
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Powiadomienia</Text>
      <TouchableOpacity disabled={busy || emailNotifications === null} style={styles.secondaryButton} onPress={() => void run(async () => { const next = !emailNotifications; await setEmailNotifications(next); setEmails(next); setMessage("Zapisano ustawienia e-maili."); })}><Text style={styles.secondaryButtonText}>{emailNotifications ? "Wyłącz powiadomienia e-mail" : "Włącz powiadomienia e-mail"}</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} style={styles.secondaryButton} onPress={() => void run(async () => { await enablePushNotifications(); setMessage("Włączono powiadomienia push."); })}><Text style={styles.secondaryButtonText}>Włącz push na tym telefonie</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} style={styles.secondaryButton} onPress={() => void run(async () => { await disablePushNotifications(); setMessage("Wyłączono powiadomienia push na wszystkich urządzeniach konta."); })}><Text style={styles.secondaryButtonText}>Wyłącz push na wszystkich urządzeniach</Text></TouchableOpacity>
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Dezaktywuj konto</Text>
      <Text style={styles.body}>Dezaktywacja wyloguje wszystkie urządzenia, ukryje profil opiekuna i anuluje aktywne rezerwacje. Wpisz DEACTIVATE, aby potwierdzić.</Text>
      <TextInput style={styles.input} accessibilityLabel="Potwierdzenie dezaktywacji" value={confirmation} onChangeText={setConfirmation} />
      <TouchableOpacity disabled={busy || confirmation !== "DEACTIVATE"} style={[styles.secondaryButton, styles.dangerButton]} onPress={() => void run(async () => { await deactivateAccount(); await leave(); })}><Text style={styles.dangerButtonText}>Dezaktywuj konto</Text></TouchableOpacity>
    </View>
  </ScrollView>;
}
