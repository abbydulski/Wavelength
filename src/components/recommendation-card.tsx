import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

import { CrossImage as Image } from './cross-image';
import { PressableScale } from './pressable-scale';

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
  loveCount?: number;
  loved?: boolean;
  onLove?: (postId: string) => void;
  isNew?: boolean;
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
  loveCount = 0,
  loved,
  onLove,
  isNew,
}: RecommendationCardProps) {
  const theme = useTheme();
  const photos = photoUrls?.length ? photoUrls : photoUrl ? [photoUrl] : [];

  return (
    <PressableScale
      style={[styles.card, { borderBottomColor: theme.border }]}
      onPress={onPressPlace}
      disabled={!onPressPlace}>
      {/* Who + when */}
      <View style={styles.topRow}>
        <Pressable
          style={({ pressed }) => [styles.recommender, { opacity: pressed && onPressUser ? 0.6 : 1 }]}
          onPress={onPressUser}
          disabled={!onPressUser}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarFallback, { color: theme.textTertiary }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={[styles.nameText, { color: theme.text }]}>{displayName}</Text>
            <Text style={[styles.metaText, { color: theme.textTertiary }]}>
              {createdAt ? timeAgo(createdAt) : ''}
              {distance ? ` · ${distance}` : ''}
              {isNew ? <Text style={{ color: theme.accent }}> · new</Text> : ''}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Category + Place */}
      <View style={styles.placeBlock}>
        <Text style={[styles.category, { color: theme.textTertiary }]}>{category.toUpperCase()}</Text>
        <Text style={[styles.placeName, { color: theme.text }]}>{placeName}</Text>
      </View>

      {/* Rating */}
      <WavelengthRating rating={rating} />

      {/* Post photos — swipeable */}
      {photos.length > 0 ? (
        <PhotoCarousel photos={photos} />
      ) : null}

      {/* The human note */}
      <Text style={[styles.note, { color: theme.text }]}>&ldquo;{note}&rdquo;</Text>

      {/* Footer: address + reactions */}
      <View style={styles.bottomRow}>
        {placeAddress ? (
          <Text style={[styles.location, { color: theme.textTertiary }]} numberOfLines={1}>
            {placeAddress}
          </Text>
        ) : null}
        {postId && onLove ? (
          <LoveButton
            loved={!!loved}
            count={loveCount}
            onPress={() => {
              onLove(postId);
              import('@/lib/haptics').then((h) => h.hapticMedium());
            }}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}

function LoveButton({ loved, count, onPress }: { loved: boolean; count: number; onPress: () => void }) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = (e: any) => {
    e.stopPropagation?.();
    // Punch the label when loving (not when un-loving).
    if (!loved) {
      scale.setValue(0.8);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
    }
    onPress();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.Text
        style={[styles.reactionText, { color: loved ? theme.accent : theme.textTertiary, transform: [{ scale }] }]}>
        love{count > 0 ? ` ${count}` : ''}
      </Animated.Text>
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

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const photoWidth = Math.min(Dimensions.get('window').width - Spacing.xs * 2, 600);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / photoWidth);
    setActiveIndex(idx);
  }, [photoWidth]);

  if (photos.length === 1) {
    return (
      <View style={styles.photoContainer}>
        <Image source={{ uri: photos[0] }} style={styles.photo} contentFit="cover" />
      </View>
    );
  }

  return (
    <View style={styles.photoContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={{ width: photoWidth }}>
        {photos.map((uri, i) => (
          <Image key={i} source={{ uri }} style={[styles.photo, { width: photoWidth }]} contentFit="cover" />
        ))}
      </ScrollView>
      <View style={styles.dotsRow}>
        {photos.map((_, i) => (
          <Dot key={i} active={i === activeIndex} />
        ))}
      </View>
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  const width = useRef(new Animated.Value(active ? 14 : 5)).current;
  const dotOpacity = useRef(new Animated.Value(active ? 1 : 0.45)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(width, { toValue: active ? 14 : 5, useNativeDriver: false, speed: 20, bounciness: 8 }),
      Animated.timing(dotOpacity, { toValue: active ? 1 : 0.45, duration: 150, useNativeDriver: false }),
    ]).start();
  }, [active, width, dotOpacity]);

  return <Animated.View style={[styles.dot, { width, opacity: dotOpacity }]} />;
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommender: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
  },
  avatarFallback: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  nameText: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.sm,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  placeBlock: {
    gap: 2,
  },
  category: {
    fontSize: FontSize.xs,
    letterSpacing: 2,
    fontWeight: '500',
  },
  placeName: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.xl,
    lineHeight: 28,
  },
  note: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 23,
  },
  photoContainer: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
  },

  dotsRow: {
    position: 'absolute' as const,
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  dot: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  location: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  reactionText: {
    fontFamily: 'Lora_400Regular',
    fontSize: FontSize.xs,
  },
});
