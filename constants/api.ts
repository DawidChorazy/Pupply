import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

function resolveHostFromRuntime() {
  const configHost =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra
      ?.expoGo?.debuggerHost;

  const scriptUrl =
    (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL ??
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;

  const hostCandidate = configHost ?? scriptUrl;
  return hostCandidate?.split(":")[0];
}

function resolveFallbackApiUrl() {
  const host = resolveHostFromRuntime();

  if (host) {
    if (Platform.OS === "android" && host === "localhost") {
      return "http://10.0.2.2:4000/api";
    }

    if (Platform.OS !== "web" && host === "localhost") {
      return "http://192.168.0.133:4000/api";
    }

    return `http://${host}:4000/api`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000/api";
  }

  return "http://localhost:4000/api";
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || resolveFallbackApiUrl();

export const API_ENDPOINTS = {
  auth: {
    google: "/auth/google",
    login: "/auth/login",
    refresh: "/auth/refresh",
    registerUser: "/auth/register/user",
    registerClinic: "/auth/register/clinic"
  },
  pets: {
    list: "/pets",
    create: "/pets",
    detail: (petId: string) => `/pets/${petId}`
  },
  users: {
    me: "/users/me"
  }
} as const;
