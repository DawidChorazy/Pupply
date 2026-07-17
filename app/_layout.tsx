import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index">
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="mainScreen/MainScreen" options={{ headerShown: false }} />
        <Stack.Screen name="mainScreen/AddDogScreen" options={{ headerShown: false }} />
        <Stack.Screen name="marketplace/sitters" options={{ headerShown: false }} />
        <Stack.Screen name="marketplace/book" options={{ headerShown: false }} />
        <Stack.Screen name="marketplace/bookings" options={{ headerShown: false }} />
        <Stack.Screen name="marketplace/sitter-profile" options={{ headerShown: false }} />
        <Stack.Screen name="marketplace/notifications" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
