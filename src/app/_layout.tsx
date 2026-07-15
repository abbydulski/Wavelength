import {
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Lora_600SemiBold,
    useFonts,
} from '@expo-google-fonts/lora';
import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth, useOnboarding } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const { hasOnboarded, checkOnboarding } = useOnboarding();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Lora_600SemiBold,
  });

  // Check onboarding status when user logs in
  useEffect(() => {
    if (session?.user) {
      checkOnboarding(session.user.id);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (fontsLoaded && !loading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, loading]);

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const inAuthGroup = segments[0] === '(auth)';

  // Not logged in → go to login
  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  // Logged in but hasn't onboarded → go to onboarding
  if (session && hasOnboarded === false) {
    const onOnboarding = segments[1] === 'onboarding';
    if (!onOnboarding) {
      return <Redirect href="/(auth)/onboarding" />;
    }
  }

  // Logged in + onboarded but still in auth group → go to tabs
  if (session && hasOnboarded === true && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="user/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
