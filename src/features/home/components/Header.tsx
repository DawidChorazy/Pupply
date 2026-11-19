import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { TouchableOpacity, View, ScrollView, Platform, StyleSheet } from "react-native";

import { router } from "expo-router";
import { useState, useEffect } from "react";
import { listNotifications, getUnreadNotificationCount, markNotificationRead } from "@/features/notifications/services/notifications-service";
import type { AppNotification } from "@/features/notifications/types/notifications";
import { getUnreadMessageCount } from "@/features/chat/services/chat-service";
import { useFocusedPolling } from "@/shared/hooks/use-focused-polling";
import { getSessionRevision, subscribeSessionChanged } from "@/shared/session/session-events";

export function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => subscribeSessionChanged(() => {
    setNotifications([]); setUnreadCount(0); setUnreadMessages(0); setNotificationsOpen(false);
  }), []);
  useFocusedPolling(async isCurrent => {
    const [notifications, messages] = await Promise.allSettled([getUnreadNotificationCount(), getUnreadMessageCount()]);
    if (!isCurrent()) return;
    if (notifications.status === "fulfilled") setUnreadCount(notifications.value.count);
    if (messages.status === "fulfilled") setUnreadMessages(messages.value.count);
  }, 5000);

  const openNotification = async (item: AppNotification) => {
    const revision = getSessionRevision();
    try {
      if (!item.readAt) await markNotificationRead(item.id);
      if (revision !== getSessionRevision()) return;
      setNotificationsOpen(false);
      if (item.conversationId) router.push({ pathname: "/marketplace/chat", params: { conversationId: item.conversationId } });
      else router.push("/notifications");
    } catch { if (revision === getSessionRevision()) setError("Nie udało się otworzyć powiadomienia."); }
  };

  const toggleNotifications = async () => {
    if(notificationsOpen){
      setNotificationsOpen(false);
      return;
    }
    setNotificationsOpen(true);
    setLoading(true);
    setError("");
    const revision = getSessionRevision();
    
    try {
      const response = await listNotifications({pageSize: 20});
      if (revision !== getSessionRevision()) return;
      setNotifications(response.items);
    } catch{
      setError("Nie udało się pobrać powiadomień");
      setLoading(false);
    } finally{
      setLoading(false);
    }
  }

  return (
    <View style={[
      styles.header,
      styles.headerPosition]}>
      <View>
        <Text style={styles.eyebrow}>Pupply</Text>
        <Text style={styles.title}>Cześć!</Text>
        <Text style={styles.subtitle}>Zaplanuj opiekę bez stresu.</Text>
      </View>
        <View style={styles.headerActions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Moje rozmowy, ${unreadMessages} nieprzeczytanych wiadomości`} style={styles.headerIconButton} onPress={() => router.push("/marketplace/conversations")}>
          <MaterialCommunityIcons name="message-outline" size={22} color="#7A3B12" />
          {unreadMessages > 0 ? <Text style={styles.messageBadge}>{unreadMessages > 99 ? "99+" : unreadMessages}</Text> : null}
        </TouchableOpacity>
        <View style={styles.notificationsAnchor}>
      <TouchableOpacity style={styles.headerIconButton} onPress={() => void toggleNotifications()}>
        <MaterialCommunityIcons name={unreadCount > 0 ? "bell-badge-outline": "bell-outline"} size={22} color={"#7A3B12"}></MaterialCommunityIcons>
      </TouchableOpacity>

      {notificationsOpen && (
        <View
          
          style={styles.notificationPanel}
        >
          <Text style={styles.notificationPanelTitle}>
            Powiadomienia
          </Text>

          <ScrollView style={styles.notificationList}>
           {loading? (
            <Text>Ładowanie...</Text>
           ): error? (
            <Text>{error}</Text>
           ): notifications.length === 0 ? (
            <Text>Nie masz jeszcze powiadomień.</Text>
           ): (
            notifications.map(notification => (
              <View key={notification.id}
              style={[
                styles.notificationItem,
                !notification.readAt && styles.unreadCard,
              ]}>
                <TouchableOpacity accessibilityRole="button" onPress={() => void openNotification(notification)}>

                  <View style={styles.spaceBetween}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                  {!notification.readAt && (
                    <View style={styles.badge}>
                    <Text style={styles.badgeText}>Nowe</Text>
                    </View>
                  )}
                  </View>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                </TouchableOpacity>
              </View>
            ))
           )}
          </ScrollView>
        </View>
      )}
      </View>
      </View>
    </View>
  );
}

const smallShadow = Platform.select({
  web: {
    boxShadow: "0 6px 12px rgba(107, 58, 24, 0.08)"
  },
  default: {
    shadowColor: "#6B3A18",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  }
});

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  messageBadge: { position: "absolute", right: -5, top: -5, backgroundColor: "#D35400", color: "#FFFFFF", fontSize: 11, borderRadius: 12, minWidth: 20, textAlign: "center", padding: 3 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24
  },
  eyebrow: {
    color: "#D35400",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4
  },
  title: {
    color: "#3D2415",
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    color: "#8A6D5B",
    fontSize: 14,
    marginTop: 4
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...smallShadow
  },
  unreadCard: { borderColor: "#D35400", backgroundColor: "#FFFCF7" },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  badge: { borderRadius: 999, backgroundColor: "#FFF0D2", paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: "#9A4A10", fontSize: 11, fontWeight: "800" },
  headerPosition: { position: "relative", zIndex:100, overflow:"visible" },
  notificationsAnchor: { position: "relative", zIndex: 101 },
  notificationPanel: { position: "absolute", zIndex:102, top: 52, right: 0, width: 340, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#EDE5DF", boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.15)" },
  notificationPanelTitle: { color: "#000000", fontSize: 17, fontWeight: "700" },
  notificationList: { maxHeight: 280, marginTop: 12 },
  notificationItem: { padding: 12, marginBottom: 8, borderWidth: 1, borderRadius: 12, borderColor: "transparent" },
  notificationTitle: { color:"#000000", fontWeight: "700", flex:1 },
  notificationMessage: { color:"#000000" }
});
