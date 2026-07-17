import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { getUnreadNotificationCount } from "@/services/notifications-service";
import { styles } from "@/styles/main-screen";

export function Header() {
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUnreadNotificationCount()
        .then(({ count }) => { if (active) setUnreadCount(count); })
        .catch(() => undefined);
      return () => { active = false; };
    }, [])
  );

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>Pupply</Text>
        <Text style={styles.title}>Cześć!</Text>
        <Text style={styles.subtitle}>Zaplanuj opiekę bez stresu.</Text>
      </View>

      <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push("/marketplace/notifications" as never)}>
        <MaterialCommunityIcons name="bell-outline" size={22} color="#7A3B12" />
        {unreadCount > 0 ? (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}
