import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { GamificationProvider } from '@/features/gamification/GamificationContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GamificationProvider>
        <Stack initialRouteName="index">
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="mainScreen/MainScreen" options={{ headerShown: false }} />
          <Stack.Screen name="mainScreen/AddDogScreen" options={{ headerShown: false }} />
          <Stack.Screen name="mainScreen/FindCareScreen" options={{ headerShown: false }} />
          <Stack.Screen name="mainScreen/ProfileScreen" options={{ headerShown: false }} />
          <Stack.Screen name="mainScreen/LeaderboardScreen" options={{ headerShown: false }} />
          <Stack.Screen name="mainScreen/QuestsScreen" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </GamificationProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
