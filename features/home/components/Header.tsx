import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { TouchableOpacity, View, Modal, Pressable, ScrollView } from "react-native";
import { styles } from "../styles";
import { marketplaceStyles as mStyles } from "@/styles/marketplace";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { listNotifications, getUnreadNotificationCount } from "@/services/notifications-service";
import type { AppNotification } from "@/types/notifications";


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
      {
        position: "relative",
        zIndex:100,
        overflow:"visible"
      }]}>
      <View>
        <Text style={styles.eyebrow}>Pupply</Text>
        <Text style={styles.title}>Cześć!</Text>
        <Text style={styles.subtitle}>Zaplanuj opiekę bez stresu.</Text>
      </View>
        <View style={{ position: "relative", zIndex: 101 }}>
      <TouchableOpacity style={styles.headerIconButton} onPress={() => void toggleNotifications()}>
        <MaterialCommunityIcons name={unreadCount > 0 ? "bell-badge-outline": "bell-outline"} size={22} color={"#7A3B12"}></MaterialCommunityIcons>
      </TouchableOpacity>

      {notificationsOpen && (
        <View
          
          style={{
            position: "absolute",
            zIndex:102,
            top: 52,
            right: 0,
            width: 340,
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: "#EDE5DF",
            boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.15)",
          }}
        >
          <Text style={{ color: "#00000", fontSize: 17, fontWeight: "700" }}>
            Powiadomienia
          </Text>

          <ScrollView style={{ maxHeight: 280, marginTop: 12 }}>
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
                {padding: 12,
                marginBottom: 8,
                borderWidth: 1,
                borderRadius: 12,
                borderColor: "transparent"},
                !notification.readAt && mStyles.unreadCard,
              ]}>
                <TouchableOpacity onPress={() => router.navigate('../marketplace/notifications')}>

                  <View style={mStyles.spaceBetween}>
                    <Text style={{color:"#000000", fontWeight: "700", flex:1 }}>{notification.title}</Text>
                  {!notification.readAt && (
                    <View style={mStyles.badge}>
                    <Text style={mStyles.badgeText}>Nowe</Text>
                    </View>
                  )}
                  </View>
                  <Text style={{color:"#000000"}}>{notification.message}</Text>
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
