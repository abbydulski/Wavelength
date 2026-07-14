import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WavelengthRating } from './wavelength-rating';

import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RecommendationCardProps = {
  avatarUrl?: string;
  displayName: string;
  placeName: string;
  placeAddress?: string;
  note: string;
  rating: number;
  category: string;
  distance?: string;
  photoUrl?: string;
  photoUrls?: string[];
  isNetwork?: boolean;
  onPressPlace?: () => void;
  onPressUser?: () => void;
  createdAt?: string;
  postId?: string;
  agreeCount?: number;
  disagreeCount?: number;
  userReaction?: 'agree' | 'disagree' | null;
  onReact?: (postId: string, reaction: 'agree' | 'disagree') => void;
};

export function RecommendationCard({
  avatarUrl,
  displayName,
  placeName,
  placeAddress,
  note,
  rating,
  category,
  distance,
  photoUrl,
  photoUrls,
  isNetwork,
  onPressPlace,
  onPressUser,
  createdAt,
  postId,
  agreeCount = 0,
  disagreeCount = 0,
  userReaction,
  onReact,
}: RecommendationCardProps) {
  const theme = useTheme();
  const photos = photoUrls?.length ? photoUrls : photoUrl ? [photoUrl] : [];
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPressPlace}
      disabled={!onPressPlace}>
      {/* Top row: avatar + recommends + distance */}
      <View style={styles.topRow}>
        <Pressable style={styles.recommender} onPress={onPressUser} disabled={!onPressUser}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarFallback, { color: theme.textTertiary }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={[styles.recommendsText, { color: theme.textSecondary }]}>
            <Text style={{ color: theme.text, fontWeight: '500' }}>{displayName}</Text>
            {' recommends'}
          </Text>
        </Pressable>
        {distance ? (
          <View style={[styles.distancePill, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.distanceText, { color: theme.textTertiary }]}>{distance}</Text>
          </View>
        ) : null}
      </View>

      {/* Category label */}
      <Text style={[styles.category, { color: theme.rust }]}>{category.toUpperCase()}</Text>

      {/* Place name — the visual anchor */}
      <Text style={[styles.placeName, { color: theme.text }]}>{placeName}</Text>

      {/* Rating */}
      <WavelengthRating rating={rating} />

      {/* Post photos */}
      {photos.length > 0 ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: photos[activePhotoIndex] }} style={styles.photo} contentFit="contain" />
          {photos.length > 1 && (
            <>
              {/* Arrow buttons */}
              {activePhotoIndex > 0 && (
                <Pressable
                  style={[styles.arrowBtn, styles.arrowLeft]}
                  onPress={(e) => { e.stopPropagation?.(); setActivePhotoIndex((i) => i - 1); }}>
                  <Text style={styles.arrowText}>‹</Text>
                </Pressable>
              )}
              {activePhotoIndex < photos.length - 1 && (
                <Pressable
                  style={[styles.arrowBtn, styles.arrowRight]}
                  onPress={(e) => { e.stopPropagation?.(); setActivePhotoIndex((i) => i + 1); }}>
                  <Text style={styles.arrowText}>›</Text>
                </Pressable>
              )}
              {/* Dots indicator */}
              <View style={styles.dotsRow}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activePhotoIndex && styles.dotActive]} />
                ))}
              </View>
              {/* Counter */}
              <View style={styles.counterPill}>
                <Text style={styles.counterText}>{activePhotoIndex + 1}/{photos.length}</Text>
              </View>
            </>
          )}
        </View>
      ) : null}

      {/* The human note — italic serif, the emotional core */}
      <Text style={[styles.note, { color: theme.text }]}>"{note}"</Text>

      {/* Agree / Disagree */}
      {postId && onReact ? (
        <View style={styles.reactionRow}>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onReact(postId, 'agree'); import('@/lib/haptics').then(h => h.hapticMedium()); }}
            style={[
              styles.reactionBtn,
              userReaction === 'agree' && { backgroundColor: '#D4EDDA' },
            ]}>
            <Text style={styles.reactionEmoji}>👍</Text>
            {agreeCount > 0 && (
              <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>{agreeCount}</Text>
            )}
          </Pressable>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onReact(postId, 'disagree'); import('@/lib/haptics').then(h => h.hapticMedium()); }}
            style={[
              styles.reactionBtn,
              userReaction === 'disagree' && { backgroundColor: '#F8D7DA' },
            ]}>
            <Text style={styles.reactionEmoji}>👎</Text>
            {disagreeCount > 0 && (
              <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>{disagreeCount}</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* Address + timestamp */}
      <View style={styles.bottomRow}>
        {placeAddress ? (
          <Text style={[styles.location, { color: theme.textTertiary }]} numberOfLines={1}>
            {placeAddress}
          </Text>
        ) : null}
        {createdAt ? (
          <Text style={[styles.timestamp, { color: theme.textTertiary }]}>
            {timeAgo(createdAt)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString();
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommender: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  avatarFallback: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  recommendsText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  distancePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  distanceText: {
    fontSize: FontSize.xs,
  },
  category: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  placeName: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.xl,
    lineHeight: 30,
  },
  note: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.base,
    lineHeight: 24,
  },
  photoContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative' as const,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  photo: {
    width: '100%',
    aspectRatio: 5 / 4,
    borderRadius: BorderRadius.md,
  },
  arrowBtn: {
    position: 'absolute' as const,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
  arrowText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 22,
    marginTop: -1,
  },
  dotsRow: {
    position: 'absolute' as const,
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  counterPill: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  timestamp: {
    fontSize: FontSize.xs,
    marginLeft: Spacing.md,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
