import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, TextInput, View, StyleSheet, Switch, Pressable } from "react-native";
import { changeEmail, changePassword, deactivateAccount, getPreferences, setEmailNotifications } from "@/features/account/services/account-service";
import { enablePushNotifications, disablePushNotifications } from "@/features/notifications/services/push-service";
import { clearAuthTokens } from "@/shared/session/auth-storage";

export default function AccountSettingsScreen() {
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [emailNotifications, setEmails] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => { let active = true; getPreferences().then(p => { if (active) setEmails(p.emailNotifications); }).catch(() => { if (active) setError("Nie udało się pobrać ustawień powiadomień. Otwórz ekran ponownie."); }); return () => { active = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać zmian"); }
    finally { setBusy(false); }
  };
  const leave = async () => { await clearAuthTokens(); router.replace("/"); };
  return <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={styles.secondaryButtonText}>Wróć</Text></Pressable>
    <Text style={styles.title}>Ustawienia konta</Text>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.statusError}>{error}</Text> : null}
    {message ? <Text style={styles.body}>{message}</Text> : null}
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Hasło i e-mail</Text>
        <View style={styles.marginContainer}>
          <TextInput style={styles.input} placeholder="Obecne hasło" accessibilityLabel="Obecne hasło" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="Nowe hasło" accessibilityLabel="Nowe hasło" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
          <Pressable android_ripple={{color: 'rgba(180, 35, 24, 0.2)', borderless: false}} disabled={busy} style={styles.secondaryButton} onPress={() => void run(async () => { await changePassword(password, newPassword); await leave(); })}><Text style={styles.secondaryButtonText}>Zmień hasło i wyloguj</Text></Pressable>
        </View>
        <View style={styles.marginContainer}>
          <TextInput style={styles.input} placeholder="Nowy adres e-mail" accessibilityLabel="Nowy adres e-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Pressable android_ripple={{color: 'rgba(180, 35, 24, 0.2)', borderless: false}} disabled={busy} style={styles.secondaryButton} onPress={() => void run(async () => {
          const response = await changeEmail(email, password);
          if (response.debugToken) router.push({ pathname: "/verify-email" as never, params: { kind: "email-change", token: response.debugToken } });
          else setMessage("Otwórz link wysłany na nowy adres, aby potwierdzić zmianę.");
          })}><Text style={styles.secondaryButtonText}>Potwierdź zmianę e-maila</Text></Pressable>
        </View>
      
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Powiadomienia</Text>
      <Text style={styles.secondaryButtonText}>{emailNotifications ? "Wyłącz powiadomienia e-mail" : "Włącz powiadomienia e-mail"}</Text>
      <Switch disabled={busy || emailNotifications === null} value={emailNotifications ?? false} onValueChange={() => void run(async () => { const next = !emailNotifications; await setEmailNotifications(next); setEmails(next); setMessage("Zapisano ustawienia e-maili."); })}></Switch>
      <Text style={styles.secondaryButtonText}>Włącz push na tym telefonie</Text>
      <Switch disabled={busy} value={isEnabled} onValueChange={(next) => void run(async () => {  next ? await enablePushNotifications() : await disablePushNotifications(); setIsEnabled(next); next ? setMessage("Powiadomienia push są włączone.") : setMessage("Powiadomienia push są wyłączone."); })}></Switch>
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Dezaktywuj konto</Text>
      <Text style={styles.body}>Dezaktywacja wyloguje wszystkie urządzenia, ukryje profil opiekuna i anuluje aktywne rezerwacje. Wpisz DEACTIVATE, aby potwierdzić.</Text>
      <TextInput style={styles.input} accessibilityLabel="Potwierdzenie dezaktywacji" value={confirmation} onChangeText={setConfirmation} />
      <Pressable android_ripple={{color: 'rgba(180, 35, 24, 0.2)', borderless: false}} disabled={busy || confirmation !== "DEACTIVATE"} style={[styles.secondaryButton, styles.dangerButton]} onPress={() => void run(async () => { await deactivateAccount(); await leave(); })}><Text style={styles.dangerButtonText}>Dezaktywuj konto</Text></Pressable>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF8F0" },
  content: { padding: 20, paddingBottom: 48 },
  secondaryButtonText: { color: "#D35400", fontSize: 13, fontWeight: "800" },
  title: { color: "#3D2415", fontSize: 27, fontWeight: "800" },
  statusError: { color: "#B42318", fontSize: 13, textAlign: "center", marginBottom: 10 },
  body: { color: "#6F5648", fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2E4D8",
    marginBottom: 14
  },
  cardTitle: { color: "#3D2415", fontSize: 17, fontWeight: "800", marginBottom: 5 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#F1DED0",
    paddingHorizontal: 14,
    color: "#3D2415",
    fontSize: 14,
    // marginBottom: 10,
    marginTop: 10,
  },
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

  marginContainer: {
    marginVertical: 12,
  },

  dangerButton: { borderColor: "#B42318" },
  dangerButtonText: { color: "#B42318" }
});
