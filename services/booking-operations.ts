import * as Crypto from "expo-crypto";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getAccountId } from "./auth-storage";
import { ApiError } from "./api-client";

type PendingOperation = { fingerprint: string; key: string };
const storageKey = (accountId: string) => `pupply.booking-operations.${accountId}`;
let storageQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(run: () => Promise<T>): Promise<T> {
  const pending = storageQueue.then(run, run);
  storageQueue = pending.catch(() => undefined);
  return pending;
}
async function read(accountId: string): Promise<PendingOperation[]> {
  const key = storageKey(accountId);
  const value = Platform.OS === "web" ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some(item => typeof item.key !== "string" || typeof item.fingerprint !== "string")) throw new Error("Nie udało się odczytać oczekujących rezerwacji.");
  return parsed;
}
async function write(accountId: string, operations: PendingOperation[]) {
  const key = storageKey(accountId), value = JSON.stringify(operations);
  if (Platform.OS === "web") window.localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
export async function bookingOperation(path: string, body: string) {
  const accountId = await getAccountId();
  if (!accountId) throw new ApiError("Zaloguj się ponownie", 401);
  // Portable SHA-256 and getRandomValues also work on HTTP LAN origins, where
  // WebCrypto subtle.digest/randomUUID are unavailable. No request body is stored.
  const fingerprint = bytesToHex(sha256(utf8ToBytes(`${path}\n${body}`)));
  return serialized(async () => {
    const operations = await read(accountId);
    const existing = operations.find(item => item.fingerprint === fingerprint);
    if (existing) return { ...existing, accountId };
    if (operations.length >= 10) throw new Error("Sprawdź oczekujące rezerwacje przed utworzeniem kolejnych.");
    const operation = { fingerprint, key: bytesToHex(Crypto.getRandomValues(new Uint8Array(16))) };
    await write(accountId, [...operations, operation]);
    return { ...operation, accountId };
  });
}
export async function pendingBookingOperations() {
  const accountId = await getAccountId();
  if (!accountId) return [];
  return serialized(async () => (await read(accountId)).map(operation => ({ ...operation, accountId })));
}
export function forgetBookingOperation(operation: PendingOperation & { accountId: string }) {
  return serialized(async () => write(operation.accountId, (await read(operation.accountId)).filter(item => item.key !== operation.key)));
}
