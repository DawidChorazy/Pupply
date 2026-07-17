import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { GamificationProvider } from '@/features/gamification/GamificationContext';
import { PetsProvider } from '@/features/pets/PetsContext';
import { WalksProvider } from '@/features/walks/WalksContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GamificationProvider>
        <PetsProvider>
          <WalksProvider>
            <Stack initialRouteName="index">
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/MainScreen" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/AddDogScreen" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/pets/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/FindCareScreen" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/BookWalkScreen" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/walks/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/ProfileScreen" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/LeaderboardScreen" options={{ headerShown: false }} />
              <Stack.Screen name="mainScreen/QuestsScreen" options={{ headerShown: false }} />
              <Stack.Screen name="marketplace/sitters" options={{ headerShown: false }} />
              <Stack.Screen name="marketplace/book" options={{ headerShown: false }} />
              <Stack.Screen name="marketplace/bookings" options={{ headerShown: false }} />
              <Stack.Screen name="marketplace/sitter-profile" options={{ headerShown: false }} />
              <Stack.Screen name="marketplace/notifications" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </WalksProvider>
        </PetsProvider>
      </GamificationProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
