import Constants from "expo-constants";
import { Platform } from "react-native";
import { authenticatedApiRequest } from "./api-client";
import { getSessionRevision } from "./session-events";

export async function enablePushNotifications() {
  if (Platform.OS === "web" || Constants.executionEnvironment === "storeClient") throw new Error("Powiadomienia push wymagają zainstalowanej aplikacji mobilnej.");
  const config = await authenticatedApiRequest<{ enabled: boolean }>("/notifications/push-config");
  if (!config.enabled) throw new Error("Powiadomienia push nie są jeszcze dostępne.");
  const revision = getSessionRevision();
  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Pupply", importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Zezwól na powiadomienia w ustawieniach telefonu.");
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Powiadomienia nie są skonfigurowane dla tej wersji aplikacji.");
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (revision !== getSessionRevision()) throw new Error("Sesja została zmieniona");
  await authenticatedApiRequest<void>("/notifications/devices", { method: "POST", body: JSON.stringify({ token }) });
}
export function disablePushNotifications() {
  return authenticatedApiRequest<void>("/notifications/devices/all", { method: "DELETE" });
}
