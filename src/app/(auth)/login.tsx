import { Link } from 'expo-router';
import { useState } from 'react';
import {
    Image,
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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email.trim(), password);
    if (err) {
      // Supabase returns "Email not confirmed" for unverified accounts
      if (err.toLowerCase().includes('not confirmed') || err.toLowerCase().includes('email not confirmed')) {
        setError('Your email hasn\'t been verified yet. Check your inbox for a confirmation link.');
      } else if (err.toLowerCase().includes('invalid login credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(err);
      }
    }
    setLoading(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}>
          <View style={styles.header}>
            <Image
              source={require('../../../public/Wavelength_Logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: theme.text }]}>
              Wavelength
            </Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              Everyone can be an influencer.
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Email"
              placeholderTextColor={theme.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Password"
              placeholderTextColor={theme.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            {error ? (
              <ThemedText style={{ color: theme.destructive, fontSize: FontSize.sm }}>
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              style={[styles.button, { backgroundColor: theme.accent, opacity: loading ? 0.6 : 1 }]}
              onPress={handleLogin}
              disabled={loading}>
              <Text style={{ color: theme.accentText, fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base }}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Text>
            </Pressable>

            <Link href="/(auth)/reset-password" asChild>
              <Pressable>
                <ThemedText themeColor="textSecondary" style={styles.link}>
                  Forgot password?
                </ThemedText>
              </Pressable>
            </Link>
          </View>

          <View style={styles.footer}>
            <ThemedText themeColor="textSecondary" style={{ fontSize: FontSize.sm }}>
              Don't have an account?
            </ThemedText>
            <Link href="/(auth)/signup" asChild>
              <Pressable style={{ marginLeft: Spacing.xs }}>
                <Text style={{ color: theme.accent, fontFamily: 'Lora_600SemiBold', fontSize: FontSize.sm }}>
                  Sign up
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
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing['3xl'] },
  logo: { width: 80, height: 80, marginBottom: Spacing.lg },
  title: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize['3xl'], marginBottom: Spacing.md },
  tagline: { fontFamily: 'Lora_400Regular_Italic', fontStyle: 'italic', fontSize: FontSize.base },
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
  link: { fontSize: FontSize.sm, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', marginTop: Spacing['3xl'] },
});
