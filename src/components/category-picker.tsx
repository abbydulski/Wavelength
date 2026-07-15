import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { FontSize, Spacing } from '@/constants/theme';
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
                borderBottomColor: isSelected ? theme.text : 'transparent',
              },
            ]}>
            <Text
              style={[
                styles.pillText,
                { color: isSelected ? theme.text : theme.textTertiary },
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
    gap: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  pill: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1.5,
  },
  pillText: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.sm,
  },
});
