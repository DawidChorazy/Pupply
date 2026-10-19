import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "expo-router/react-navigation";
import { TouchableOpacity, View, Modal, Pressable, ScrollView } from "react-native";
import { styles } from "../styles";
import { router } from "expo-router";
import { useState } from "react";
import { listNotifications } from "@/services/notifications-service";
import type { AppNotification } from "@/types/notifications";


export function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        <MaterialCommunityIcons name="bell-outline" size={22} color="#7A3B12" />
      </TouchableOpacity>

      {notificationsOpen && (
        <View
          
          style={{
            position: "absolute",
            zIndex:102,
            top: 52,
            right: 0,
            width: 280,
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: "#EDE5DF",
            boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.15)",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700" }}>
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
              style={{paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#EDE5DF",
              }}>
                <Text style={{ fontWeight: "700" }}>{notification.title}</Text>
                <Text>{notification.message}</Text>
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
