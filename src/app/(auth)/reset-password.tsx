import { Link } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function ResetPasswordScreen() {
  const { resetPassword } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await resetPassword(email.trim());
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.centered]}>
          <ThemedText type="subtitle">Check your email</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sentText}>
            If an account exists for {email}, we sent a password reset link.
          </ThemedText>
          <Link href="/(auth)/login" asChild>
            <Pressable style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])}>
              <Text style={{ color: theme.accentText, fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base }}>
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Reset password
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Enter your email and we'll send you a reset link.
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              placeholder="Email"
              placeholderTextColor={theme.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            {error ? (
              <ThemedText style={{ color: theme.destructive, fontSize: FontSize.sm }}>
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              style={[styles.button, { backgroundColor: theme.accent, opacity: loading ? 0.6 : 1 }]}
              onPress={handleReset}
              disabled={loading}>
              <Text style={{ color: theme.accentText, fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base }}>
                {loading ? 'Sending...' : 'Send reset link'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={{ color: theme.accent, fontFamily: 'Lora_600SemiBold', fontSize: FontSize.sm }}>
                  Back to sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing['3xl'], gap: Spacing.md },
  title: { fontSize: FontSize['3xl'] },
  subtitle: { fontSize: FontSize.base, textAlign: 'center' },
  form: { gap: Spacing.lg },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    borderWidth: 1,
  },
  button: {
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  sentText: { textAlign: 'center', fontSize: FontSize.base, lineHeight: 24, paddingHorizontal: Spacing.lg },
  footer: { alignItems: 'center', marginTop: Spacing['3xl'] },
});
