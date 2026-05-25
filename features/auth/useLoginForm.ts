import { API_BASE_URL } from "@/constants/api";
import { ApiError } from "@/services/api-client";
import { loginUser, loginWithGoogle } from "@/services/auth-service";
import { saveAuthTokens } from "@/services/auth-storage";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const missingGoogleClientId = "missing-google-client-id";
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googleRedirectUri =
  Platform.OS === "web"
    ? AuthSession.makeRedirectUri({ path: "" })
    : process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI?.trim();

WebBrowser.maybeCompleteAuthSession();

function getGoogleClientIdForPlatform() {
  if (Platform.OS === "android") {
    return googleAndroidClientId;
  }

  if (Platform.OS === "ios") {
    return googleIosClientId;
  }

  return googleWebClientId;
}

export function useLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const googleClientIdConfigured = Boolean(getGoogleClientIdForPlatform());
  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    clientId: missingGoogleClientId,
    webClientId: googleWebClientId || missingGoogleClientId,
    androidClientId: googleAndroidClientId || missingGoogleClientId,
    iosClientId: googleIosClientId || missingGoogleClientId,
    redirectUri: googleRedirectUri,
    selectAccount: true
  });

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    if (googleResponse.type === "success") {
      const idToken = googleResponse.params.id_token || googleResponse.authentication?.idToken;

      if (!idToken) {
        setError("Google nie zwrocil tokenu logowania*");
        setIsGoogleSubmitting(false);
        return;
      }

      loginWithGoogle({ idToken })
        .then(async (response) => {
          await saveAuthTokens(response.accessToken, response.refreshToken);
          router.replace("/mainScreen/MainScreen");
        })
        .catch((requestError) => {
          if (requestError instanceof ApiError) {
            setError(requestError.message || "Logowanie Google nie powiodlo sie*");
          } else {
            const errorDetails =
              requestError instanceof Error && requestError.message ? ` (${requestError.message})` : "";
            setError(`Brak polaczenia z API${errorDetails}. URL: ${API_BASE_URL}`);
          }
        })
        .finally(() => {
          setIsGoogleSubmitting(false);
        });

      return;
    }

    if (googleResponse.type === "error") {
      setError(googleResponse.error?.message || "Logowanie Google nie powiodlo sie*");
    }

    setIsGoogleSubmitting(false);
  }, [googleResponse, router]);

  const handleEmailLogin = async () => {
    if (email.trim() === "" && password.trim() === "") {
      setError("Adres email i haslo sa wymagane*");
      return;
    }

    if (email.trim() === "") {
      setError("Adres email jest wymagany*");
      return;
    }

    if (password.trim() === "") {
      setError("Haslo jest wymagane*");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await loginUser({
        email: email.trim().toLowerCase(),
        password
      });

      await saveAuthTokens(response.accessToken, response.refreshToken);
      router.replace("/mainScreen/MainScreen");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message || "Logowanie nie powiodlo sie*");
      } else {
        const errorDetails = requestError instanceof Error && requestError.message ? ` (${requestError.message})` : "";
        setError(`Brak polaczenia z API${errorDetails}. URL: ${API_BASE_URL}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!googleClientIdConfigured) {
      setError("Brak konfiguracji Google Client ID dla tej platformy*");
      return;
    }

    setError("");
    setIsGoogleSubmitting(true);

    try {
      const result = await promptGoogleSignIn();

      if (result.type !== "success") {
        setIsGoogleSubmitting(false);
      }
    } catch (requestError) {
      const errorDetails = requestError instanceof Error && requestError.message ? ` (${requestError.message})` : "";
      setError(`Logowanie Google nie powiodlo sie${errorDetails}`);
      setIsGoogleSubmitting(false);
    }
  };

  const goToRegister = () => {
    router.push("../register/RegisterScreen");
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    isSubmitting,
    isGoogleSubmitting,
    googleRequest,
    handleEmailLogin,
    handleGoogleLogin,
    goToRegister
  };
}
