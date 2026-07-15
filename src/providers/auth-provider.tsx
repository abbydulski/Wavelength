import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
};

type OnboardingContextType = {
  hasOnboarded: boolean | null;
  checkOnboarding: (userId: string) => Promise<void>;
  completeOnboarding: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    // If a session came back, user was auto-confirmed (dev/free-tier behavior)
    const needsConfirmation = !error && data?.user && !data.session;
    return { error: error?.message ?? null, needsConfirmation };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  };

  // Onboarding state
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  const checkOnboarding = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('has_onboarded')
      .eq('id', userId)
      .single();
    setHasOnboarded(data?.has_onboarded ?? false);
  };

  const completeOnboarding = async (userId: string) => {
    await supabase
      .from('users')
      .update({ has_onboarded: true })
      .eq('id', userId);
    setHasOnboarded(true);
  };

  // Reset onboarding state on logout
  useEffect(() => {
    if (!session) setHasOnboarded(null);
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}>
      <OnboardingContext.Provider
        value={{ hasOnboarded, checkOnboarding, completeOnboarding }}>
        {children}
      </OnboardingContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an AuthProvider');
  }
  return context;
}
