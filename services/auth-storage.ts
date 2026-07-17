import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const accessTokenKey = process.env.EXPO_PUBLIC_AUTH_TOKEN_KEY ?? "auth_token";
const refreshTokenKey = process.env.EXPO_PUBLIC_REFRESH_TOKEN_KEY ?? "refresh_token";
const accountIdKey = process.env.EXPO_PUBLIC_ACCOUNT_ID_KEY ?? "account_id";

function hasWebStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function saveAuthTokens(accessToken: string, refreshToken: string, accountId?: string) {
  if (Platform.OS === "web") {
    if (hasWebStorage()) {
      window.localStorage.setItem(accessTokenKey, accessToken);
      window.localStorage.setItem(refreshTokenKey, refreshToken);
      if (accountId) window.localStorage.setItem(accountIdKey, accountId);
    }
    return;
  }

  await SecureStore.setItemAsync(accessTokenKey, accessToken);
  await SecureStore.setItemAsync(refreshTokenKey, refreshToken);
  if (accountId) await SecureStore.setItemAsync(accountIdKey, accountId);
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

export async function getAccountId() {
  if (Platform.OS === "web") {
    return hasWebStorage() ? window.localStorage.getItem(accountIdKey) : null;
  }

  return SecureStore.getItemAsync(accountIdKey);
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    if (hasWebStorage()) {
      window.localStorage.removeItem(accessTokenKey);
      window.localStorage.removeItem(refreshTokenKey);
      window.localStorage.removeItem(accountIdKey);
    }
    return;
  }

  await SecureStore.deleteItemAsync(accessTokenKey);
  await SecureStore.deleteItemAsync(refreshTokenKey);
  await SecureStore.deleteItemAsync(accountIdKey);
}
