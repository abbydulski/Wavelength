import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { BorderRadius, FontSize, RatingColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RatingPickerProps = {
  value: number; // 0 = unset, 1-5 = selected
  onChange: (rating: number) => void;
};

const LABELS = ['', 'Not great', 'Okay', 'Good', 'Great', 'Must try'];

export function getRatingColor(rating: number, scheme: 'light' | 'dark' = 'light'): string {
  if (rating < 1 || rating > 5) return RatingColors[scheme][0];
  return RatingColors[scheme][rating];
}

export function RatingPicker({ value, onChange }: RatingPickerProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const activeColor = value > 0 ? getRatingColor(value, scheme) : theme.ratingEmpty;

  return (
    <View style={styles.container}>
      <View style={styles.barsRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            onPress={() => { onChange(i); import('@/lib/haptics').then(h => h.hapticLight()); }}
            hitSlop={4}
            style={styles.barTouchable}>
            <View
              style={[
                styles.bar,
                {
                  height: 8 + i * 4,
                  backgroundColor: i <= value ? activeColor : theme.ratingEmpty,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
      {value > 0 && (
        <Text style={[styles.label, { color: activeColor }]}>
          {value} — {LABELS[value]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  barTouchable: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    borderRadius: BorderRadius.sm,
  },
  label: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
  },
});
