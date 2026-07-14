import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const CATEGORIES = [
  { key: 'food', label: 'Food' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'activities', label: 'Activities' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'gym', label: 'Gym' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'arts-culture', label: 'Arts & Culture' },
  { key: 'wellness', label: 'Wellness' },
  { key: 'travel', label: 'Travel' },
  { key: 'other', label: 'Other' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

type CategoryPickerProps = {
  value: CategoryKey | '';
  onChange: (category: CategoryKey) => void;
};

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      {CATEGORIES.map((cat) => {
        const isSelected = value === cat.key;
        return (
          <Pressable
            key={cat.key}
            onPress={() => onChange(cat.key)}
            style={[
              styles.pill,
              {
                backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                borderColor: isSelected ? theme.accent : theme.border,
              },
            ]}>
            <Text
              style={[
                styles.pillText,
                { color: isSelected ? theme.accentText : theme.textSecondary },
              ]}>
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
