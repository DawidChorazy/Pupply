import * as AuthSession from "expo-auth-session";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

const missingClientId = "missing-google-client-id";
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

export const googleAuthConfig = {
  clientId: missingClientId,
  webClientId: webClientId || missingClientId,
  androidClientId: androidClientId || missingClientId,
  iosClientId: iosClientId || missingClientId,
  redirectUri:
    Platform.OS === "web"
      ? AuthSession.makeRedirectUri({ path: "" })
      : process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim() || undefined,
  selectAccount: true,
};

export function getGoogleLoginConfigurationError(): string | null {
  if (Platform.OS !== "web" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return "Logowanie Google jest niedostępne w Expo Go. Uruchom własny build deweloperski aplikacji. W Expo Go użyj logowania e-mailem i hasłem.";
  }

  const [clientId, variableName] = Platform.OS === "android"
    ? [androidClientId, "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"]
    : Platform.OS === "ios"
      ? [iosClientId, "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"]
      : [webClientId, "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"];

  if (!clientId || clientId.startsWith("your_") || clientId === missingClientId) {
    return `Brak konfiguracji Google: ustaw ${variableName} i zrestartuj Expo.`;
  }

  return null;
}
