import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { GamificationProvider } from "@/features/gamification/context/GamificationContext";
import { PetsProvider } from "@/features/pets/context/PetsContext";
import { WalksProvider } from "@/features/walks/context/WalksContext";
import { useColorScheme } from "@/shared/hooks/use-color-scheme";
import { PushNavigation } from "@/features/notifications/components/PushNavigation";

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PushNavigation />
      <GamificationProvider>
        <PetsProvider>
          <WalksProvider>
            <Stack initialRouteName="index" screenOptions={{ headerShown: false }} />
          </WalksProvider>
        </PetsProvider>
      </GamificationProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
