import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

function SkeletonBlock({ width = '100%', height = 16, borderRadius = BorderRadius.sm, style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: theme.backgroundElement, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <SkeletonBlock width={32} height={32} borderRadius={16} />
        <SkeletonBlock width={160} height={14} />
      </View>
      <SkeletonBlock width={60} height={10} />
      <SkeletonBlock width="80%" height={22} />
      <SkeletonBlock width="100%" height={12} />
      <SkeletonBlock width="100%" height={120} borderRadius={BorderRadius.md} />
      <SkeletonBlock width="70%" height={16} />
    </View>
  );
}

export function SkeletonPlaceCard() {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <SkeletonBlock width={60} height={10} />
        <SkeletonBlock width={40} height={10} />
      </View>
      <SkeletonBlock width="75%" height={22} />
      <SkeletonBlock width="90%" height={14} />
      <SkeletonBlock width={120} height={12} />
    </View>
  );
}

export function SkeletonList({ count = 3, type = 'card' }: { count?: number; type?: 'card' | 'place' }) {
  const Component = type === 'place' ? SkeletonPlaceCard : SkeletonCard;
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
});
