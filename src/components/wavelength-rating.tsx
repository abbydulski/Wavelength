import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getRatingColor } from './rating-picker';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type WavelengthRatingProps = {
  rating: number; // 1–5
  size?: 'sm' | 'md';
};

/**
 * Custom rating visualization: filled rounded bars (not stars).
 * Tied to the "Wavelength" name — a personal signal, not a Yelp pattern.
 */
export function WavelengthRating({ rating, size = 'md' }: WavelengthRatingProps) {
  const theme = useTheme();
  const scheme = useColorScheme() ?? 'light';
  const barWidth = size === 'sm' ? 14 : 20;
  const barHeight = size === 'sm' ? 4 : 5;
  const gap = size === 'sm' ? 3 : 4;
  const fontSize = size === 'sm' ? 13 : 15;
  const ratingColor = getRatingColor(Math.round(rating), scheme);

  return (
    <View style={styles.container}>
      <View style={[styles.bars, { gap }]}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                width: barWidth,
                height: barHeight,
                backgroundColor: i <= Math.round(rating) ? ratingColor : theme.ratingEmpty,
              },
            ]}
          />
        ))}
      </View>
      <Text
        style={[
          styles.label,
          {
            color: ratingColor,
            fontSize,
          },
        ]}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    borderRadius: BorderRadius.full,
  },
  label: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
  },
});
