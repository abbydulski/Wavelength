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

export default function SignupScreen() {
  const { signUp } = useAuth();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async () => {
    if (!displayName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err, needsConfirmation } = await signUp(email.trim(), password, displayName.trim());
    if (err) {
      setError(err);
    } else if (needsConfirmation) {
      // Email confirmation required — show "check your email" screen
      setSuccess(true);
    }
    // If auto-confirmed (session returned), the root layout will
    // detect the session and redirect to (tabs) automatically
    setLoading(false);
  };

  if (success) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.centered]}>
          <ThemedText type="subtitle">Check your email</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.successText}>
            We sent a confirmation link to {email}. Tap it to activate your account, then come back and sign in.
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
              Create account
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              placeholder="Display name"
              placeholderTextColor={theme.textTertiary}
              value={displayName}
              onChangeText={setDisplayName}
              autoComplete="name"
            />
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
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              placeholder="Password (6+ characters)"
              placeholderTextColor={theme.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            {error ? (
              <ThemedText style={{ color: theme.destructive, fontSize: FontSize.sm }}>
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              style={[styles.button, { backgroundColor: theme.accent, opacity: loading ? 0.6 : 1 }]}
              onPress={handleSignup}
              disabled={loading}>
              <Text style={{ color: theme.accentText, fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base }}>
                {loading ? 'Creating account...' : 'Create account'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <ThemedText themeColor="textSecondary" style={{ fontSize: FontSize.sm }}>
              Already have an account?{' '}
            </ThemedText>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={{ color: theme.accent, fontFamily: 'Lora_600SemiBold', fontSize: FontSize.sm }}>
                  Sign in
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
  header: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  title: { fontSize: FontSize['3xl'] },
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
  successText: { textAlign: 'center', fontSize: FontSize.base, lineHeight: 24, paddingHorizontal: Spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing['3xl'] },
});
