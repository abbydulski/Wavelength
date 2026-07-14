/**
 * Wavelength design tokens.
 * Warm & grounded: moss green, warm cream, rust/ochre accent.
 * Serif (Lora) for the human voice, system sans for utility.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2C2C2A',
    textSecondary: '#6E6B63',
    textTertiary: '#9C9890',
    background: '#F9F6F0',
    backgroundElement: '#F0EDE5',
    backgroundSelected: '#E4E0D7',
    border: '#E4E0D7',
    card: '#FFFFFF',
    accent: '#4A5E3B',
    accentLight: '#E8EDE4',
    accentText: '#FFFFFF',
    rust: '#B5654A',
    rustLight: '#FAEFEA',
    destructive: '#B5654A',
    rating: '#B5654A',
    ratingEmpty: '#E4E0D7',
  },
  dark: {
    text: '#EDEBE5',
    textSecondary: '#A9A49C',
    textTertiary: '#6E6B63',
    background: '#1A1917',
    backgroundElement: '#27261F',
    backgroundSelected: '#35332B',
    border: '#35332B',
    card: '#27261F',
    accent: '#7A9B66',
    accentLight: '#2A3326',
    accentText: '#FFFFFF',
    rust: '#D4856B',
    rustLight: '#3A2A22',
    destructive: '#D4856B',
    rating: '#D4856B',
    ratingEmpty: '#35332B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 600;
export const WebNavHeight = Platform.OS === 'web' ? 64 : 0;

/** Apply to scrollable content containers — constrains width on web, full-width on mobile */
export const ContentContainerWeb = Platform.OS === 'web'
  ? { maxWidth: MaxContentWidth, width: '100%' as const, alignSelf: 'center' as const }
  : {};

/** Pastel red → green gradient for rating values 1–5 */
export const RatingColors = {
  light: ['#E4E0D7', '#D4837A', '#D4A07A', '#C9B86C', '#8DB87A', '#6AAF6A'] as const,
  dark:  ['#35332B', '#C47468', '#C48E68', '#B8A65E', '#7DAA6C', '#5EA05E'] as const,
};
