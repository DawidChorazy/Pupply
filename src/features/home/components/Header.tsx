import { MaterialCommunityIcons } from "@expo/vector-icons";
import Octicons from '@expo/vector-icons/Octicons';
import { Text } from "expo-router/react-navigation";
import { TouchableOpacity, View, Modal, Pressable, ScrollView, Animated, Platform, StyleSheet } from "react-native";

import { router, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { listNotifications, getUnreadNotificationCount } from "@/features/notifications/services/notifications-service";
import type { AppNotification } from "@/features/notifications/types/notifications";

export function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const checkNotifications = async () => {
        try{
          const {count} = await getUnreadNotificationCount();
          if(active){
            setUnreadCount(count);
          } 
        } catch {
            console.warn("Nie udało się odświeżyć licznika powiadomień.")
          }
      }

      void checkNotifications();
      return () => {
        active = false;
      }

    }, [])
  );

  const toggleNotifications = async () => {
    if(notificationsOpen){
      setNotificationsOpen(false);
      return;
    }
    setNotificationsOpen(true);
    setLoading(true);
    setError("");
    
    try {
      const response = await listNotifications({pageSize: 20});
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
        <View style={styles.notificationsAnchor}>
      <TouchableOpacity style={styles.headerIconButton} onPress={() => void toggleNotifications()}>
        {/* <Octicons style={{alignSelf: "flex-end", top: 16, right: 9, zIndex:102}} name="dot-fill" size={16} color="red" />  */}
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
                <TouchableOpacity onPress={() => router.navigate('/notifications')}>

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
  notificationPanelTitle: { color: "#00000", fontSize: 17, fontWeight: "700" },
  notificationList: { maxHeight: 280, marginTop: 12 },
  notificationItem: { padding: 12, marginBottom: 8, borderWidth: 1, borderRadius: 12, borderColor: "transparent" },
  notificationTitle: { color:"#000000", fontWeight: "700", flex:1 },
  notificationMessage: { color:"#000000" }
});
