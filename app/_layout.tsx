import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack initialRouteName="(app)" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(auth)" />
        </Stack>
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}
