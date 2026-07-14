import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;

// Lazy-load to avoid crash on web
async function getHaptics() {
  if (Platform.OS === 'web') return null;
  if (!Haptics) {
    Haptics = await import('expo-haptics');
  }
  return Haptics;
}

/** Light tap — rating selection, pill tap, toggle */
export async function hapticLight() {
  const h = await getHaptics();
  h?.impactAsync(h.ImpactFeedbackStyle.Light);
}

/** Medium tap — follow, agree/disagree, submit */
export async function hapticMedium() {
  const h = await getHaptics();
  h?.impactAsync(h.ImpactFeedbackStyle.Medium);
}

/** Success — post created, profile saved */
export async function hapticSuccess() {
  const h = await getHaptics();
  h?.notificationAsync(h.NotificationFeedbackType.Success);
}

/** Warning — delete confirmation */
export async function hapticWarning() {
  const h = await getHaptics();
  h?.notificationAsync(h.NotificationFeedbackType.Warning);
}
