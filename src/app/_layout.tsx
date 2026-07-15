import {
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Lora_600SemiBold,
    useFonts,
} from '@expo-google-fonts/lora';
import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Lora_600SemiBold,
  });

  // Check onboarding status when user is logged in
  useEffect(() => {
    if (!session?.user) {
      setHasOnboarded(null);
      return;
    }
    supabase
      .from('users')
      .select('has_onboarded')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setHasOnboarded(data?.has_onboarded ?? false);
      });
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

  // Use <Redirect> instead of router.replace() to avoid GO_BACK errors on web
  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }
  if (session && inAuthGroup) {
    // If logged in but not onboarded, send to onboarding
    const onOnboarding = segments[1] === 'onboarding';
    if (hasOnboarded === false && !onOnboarding) {
      return <Redirect href="/(auth)/onboarding" />;
    }
    if (hasOnboarded !== false) {
      return <Redirect href="/(tabs)" />;
    }
  }
  // If logged in, not in auth group, but hasn't onboarded yet
  if (session && !inAuthGroup && hasOnboarded === false) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="place/[id]" options={{ presentation: 'card' }} />
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
