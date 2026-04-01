import Constants from 'expo-constants';
import { ShareIntentProvider } from 'expo-share-intent';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const shareIntentDisabled = Platform.OS === 'web' || Constants.appOwnership === 'expo';

  return (
    <ShareIntentProvider
      options={{
        disabled: shareIntentDisabled,
        debug: __DEV__,
        scheme: 'drivereader',
        resetOnBackground: true,
      }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ShareIntentProvider>
  );
}
