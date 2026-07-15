import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const SLIDES = [
  {
    emoji: '👋',
    title: 'Welcome to Wavelength',
    body: 'A place to share and discover recommendations from people you actually trust — your friends.',
  },
  {
    emoji: '📍',
    title: 'How it works',
    body: 'Rate a place you love, add photos and a caption. Your friends see it in their feed and can discover it on the map.',
  },
  {
    emoji: '🌿',
    title: 'No algorithms, just trust',
    body: 'No ads, no influencers, no strangers. Just honest recommendations from your circle, all within 100 miles.',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const handleFinish = async () => {
    if (user) {
      await supabase
        .from('users')
        .update({ has_onboarded: true })
        .eq('id', user.id);
    }
    router.replace('/(tabs)');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image
            source={require('../../../public/Wavelength_Logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.emoji}>{slide.emoji}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{slide.title}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{slide.body}</Text>

          {/* Dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? theme.accent : theme.border },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          {step > 0 && (
            <Pressable onPress={() => setStep(step - 1)} style={styles.backBtn}>
              <Text style={[styles.backText, { color: theme.textSecondary }]}>Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={isLast ? handleFinish : () => setStep(step + 1)}
            style={[styles.nextBtn, { backgroundColor: theme.accent, marginLeft: step > 0 ? 0 : 'auto' }]}>
            <Text style={styles.nextText}>{isLast ? 'Get started' : 'Next'}</Text>
          </Pressable>
        </View>

        {!isLast && (
          <Pressable onPress={handleFinish} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: theme.textTertiary }]}>Skip</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.lg,
  },
  logo: { width: 64, height: 64, marginBottom: Spacing.md },
  emoji: { fontSize: 48, marginBottom: Spacing.md },
  title: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize['2xl'], textAlign: 'center' },
  body: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.base,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  dots: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  backBtn: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl },
  backText: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base },
  nextBtn: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: BorderRadius.full,
    marginLeft: 'auto',
  },
  nextText: { color: '#fff', fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base },
  skipBtn: { alignItems: 'center', paddingBottom: Spacing.lg },
  skipText: { fontSize: FontSize.sm },
});
