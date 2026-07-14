import {
    TabList,
    TabListProps,
    Tabs,
    TabSlot,
    TabTrigger,
    TabTriggerSlotProps,
} from 'expo-router/ui';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Feed</TabButton>
          </TabTrigger>
          <TabTrigger name="discover" href="/discover" asChild>
            <TabButton>Discover</TabButton>
          </TabTrigger>
          <TabTrigger name="create" href="/create" asChild>
            <TabButton>Create</TabButton>
          </TabTrigger>
          <TabTrigger name="search" href="/search" asChild>
            <TabButton>Search</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          isFocused && { backgroundColor: theme.accentLight },
        ]}>
        <ThemedText
          type="small"
          style={isFocused ? { color: theme.accent } : { color: theme.textSecondary }}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <View style={styles.brandContainer}>
          <Image
            source={require('../../public/Wavelength_Logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <ThemedText style={styles.brandText}>Wavelength</ThemedText>
        </View>

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    zIndex: 10,
  },
  innerContainer: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Spacing['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto',
    gap: Spacing.sm,
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandText: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Spacing.lg,
  },
});
