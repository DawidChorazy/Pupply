import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const accessTokenKey = process.env.EXPO_PUBLIC_AUTH_TOKEN_KEY ?? "auth_token";
const refreshTokenKey = process.env.EXPO_PUBLIC_REFRESH_TOKEN_KEY ?? "refresh_token";

function hasWebStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function saveAuthTokens(accessToken: string, refreshToken: string) {
  if (Platform.OS === "web") {
    if (hasWebStorage()) {
      window.localStorage.setItem(accessTokenKey, accessToken);
      window.localStorage.setItem(refreshTokenKey, refreshToken);
    }
    return;
  }

  await SecureStore.setItemAsync(accessTokenKey, accessToken);
  await SecureStore.setItemAsync(refreshTokenKey, refreshToken);
}

export async function getAccessToken() {
  if (Platform.OS === "web") {
    return hasWebStorage() ? window.localStorage.getItem(accessTokenKey) : null;
  }

  return SecureStore.getItemAsync(accessTokenKey);
}

export async function getRefreshToken() {
  if (Platform.OS === "web") {
    return hasWebStorage() ? window.localStorage.getItem(refreshTokenKey) : null;
  }

  return SecureStore.getItemAsync(refreshTokenKey);
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    if (hasWebStorage()) {
      window.localStorage.removeItem(accessTokenKey);
      window.localStorage.removeItem(refreshTokenKey);
    }
    return;
  }

  await SecureStore.deleteItemAsync(accessTokenKey);
  await SecureStore.deleteItemAsync(refreshTokenKey);
}
