import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();

  const s = (extra?: object) => [styles.body, { color: theme.text }, extra];
  const h = (extra?: object) => [styles.heading, { color: theme.text }, extra];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: theme.accent }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Privacy Policy</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s()}>Last updated: August 1, 2026</Text>

          <Text style={h({ marginTop: Spacing.xl })}>What We Collect</Text>
          <Text style={s()}>
            When you create an account, we collect your email address, display name, and optional profile photo. When you post a recommendation, we store the place name, your review, photos you upload, and the location coordinates of the place.
          </Text>

          <Text style={h()}>How We Use Your Data</Text>
          <Text style={s()}>
            Your data is used solely to operate Wavelength — showing your recommendations to people who follow you, displaying places on the map, and enabling the social features of the app. We do not sell, rent, or share your personal data with third parties for advertising purposes.
          </Text>

          <Text style={h()}>Location Data</Text>
          <Text style={s()}>
            We use your device location to show nearby recommendations on the map and to calculate distances. Location data is only accessed when you are using the app and is not tracked in the background.
          </Text>

          <Text style={h()}>Data Storage</Text>
          <Text style={s()}>
            Your data is stored securely using Supabase, which provides encrypted database storage and authentication services. Photos are stored in secure cloud storage buckets.
          </Text>

          <Text style={h()}>Your Rights</Text>
          <Text style={s()}>
            You can delete your account and all associated data at any time from the app settings. You can also edit or delete individual posts. If you have questions or requests regarding your data, contact us at the email below.
          </Text>

          <Text style={h()}>Third-Party Services</Text>
          <Text style={s()}>
            We use the following third-party services:{'\n'}• Supabase (authentication and database){'\n'}• Expo / EAS (app builds and updates){'\n'}• Vercel (web hosting){'\n'}• Google Maps (map tiles and place search)
          </Text>

          <Text style={h()}>Children's Privacy</Text>
          <Text style={s()}>
            Wavelength is not intended for children under 13. We do not knowingly collect personal information from children under 13.
          </Text>

          <Text style={h()}>Changes to This Policy</Text>
          <Text style={s()}>
            We may update this privacy policy from time to time. We will notify you of any changes by updating the "Last updated" date above.
          </Text>

          <Text style={h()}>Contact</Text>
          <Text style={s({ marginBottom: Spacing['3xl'] })}>
            If you have any questions about this privacy policy, please contact us at abbydulski@icloud.com.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: WebNavHeight + Spacing.md,
    paddingBottom: Spacing.lg,
  },
  back: { fontSize: 20 },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.xl,
  },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  heading: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  body: {
    fontFamily: 'Lora_400Regular',
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
});
