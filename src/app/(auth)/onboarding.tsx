import { useRouter } from 'expo-router';
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth, useOnboarding } from '@/providers/auth-provider';

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { completeOnboarding } = useOnboarding();

  const handleFinish = async () => {
    if (user) {
      await completeOnboarding(user.id);
    }
    router.replace('/(tabs)');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable onPress={handleFinish} style={styles.inner}>
          <View style={styles.spacer} />

          <Image
            source={require('../../../public/Wavelength_Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={[styles.title, { color: theme.text }]}>Wavelength</Text>

          <View style={styles.divider} />

          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Recommendations from people{'\n'}you actually trust.
          </Text>

          <Text style={[styles.detail, { color: theme.textTertiary }]}>
            Rate the places you love. Your friends{'\n'}
            discover them. No algorithms, no strangers.{'\n'}
            Just your circle, nearby.
          </Text>

          <View style={styles.spacer} />

          <Text style={[styles.cta, { color: theme.accent }]}>
            tap anywhere to begin
          </Text>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  spacer: { flex: 1 },
  logo: { width: 56, height: 56, marginBottom: Spacing['2xl'] },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 32,
    letterSpacing: 0.5,
    marginBottom: Spacing.xl,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#C4B9A8',
    marginBottom: Spacing.xl,
  },
  body: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  detail: {
    fontFamily: 'Lora_400Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  cta: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: Spacing['2xl'],
  },
});
