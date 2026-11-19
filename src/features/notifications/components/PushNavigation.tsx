import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { getAccountId, getAccessToken } from "@/shared/session/auth-storage";
import { getSessionRevision } from "@/shared/session/session-events";

export function PushNavigation() {
  useEffect(() => {
    if (Platform.OS === "web" || Constants.executionEnvironment === "storeClient") return;
    let active = true;
    let subscription: { remove(): void } | undefined;
    const seen = new Set<string>();
    void import("expo-notifications").then(async Notifications => {
      if (!active) return;
      Notifications.setNotificationHandler({ handleNotification: async () => ({
        shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false
      }) });
      const navigate = async (response: import("expo-notifications").NotificationResponse) => {
        const notification = response.notification;
        if (seen.has(notification.request.identifier)) return;
        const revision = getSessionRevision();
        const [token, accountId] = await Promise.all([getAccessToken(), getAccountId()]);
        const data = notification.request.content.data ?? {};
        if (!active || !token || revision !== getSessionRevision() || data.accountId !== accountId) return;
        if (seen.has(notification.request.identifier)) return;
        seen.add(notification.request.identifier);
        if (seen.size > 50) seen.delete(seen.values().next().value!);
        if (typeof data.conversationId === "string" && data.conversationId.length > 0 && data.conversationId.length <= 100)
          router.push({ pathname: "/marketplace/chat", params: { conversationId: data.conversationId } });
        else router.push("/notifications");
        await Notifications.clearLastNotificationResponseAsync();
      };
      subscription = Notifications.addNotificationResponseReceivedListener(response => { void navigate(response).catch(() => {}); });
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && active) await navigate(last);
    }).catch(() => { /* Native push configuration is optional; in-app notifications remain available. */ });
    return () => { active = false; subscription?.remove(); };
  }, []);
  return null;
}
