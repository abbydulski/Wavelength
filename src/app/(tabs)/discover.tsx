import { CrossImage as Image } from '@/components/cross-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/components/category-picker';
import { DiscoverMap } from '@/components/discover-map';
import { SkeletonList } from '@/components/skeleton';
import { ThemedView } from '@/components/themed-view';
import { WavelengthRating } from '@/components/wavelength-rating';
import { FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type DiscoverPlace = {
  place_id: string;
  google_place_id: string;
  name: string;
  address: string;
  category: string;
  avg_rating: number;
  rating_count: number;
  distance_miles: number;
  lat?: number;
  lng?: number;
};

type PlaceRating = {
  post_id: string;
  user_id: string;
  display_name: string;
  photo_url: string;
  caption: string;
  rating: number;
  category: string;
  created_at: string;
  is_network: boolean;
  post_photos: string[];
  is_private_locked: boolean;
};

const FILTER_CATEGORIES = [{ key: '', label: 'All' }, ...CATEGORIES];

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { location: userLocation, loading: locationLoading } = useLocation();
  const [places, setPlaces] = useState<DiscoverPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Place detail overlay state
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [placeDetail, setPlaceDetail] = useState<DiscoverPlace | null>(null);
  const [placeRatings, setPlaceRatings] = useState<PlaceRating[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPlaces = useCallback(async () => {
    if (!userLocation) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('discover_nearby_places', {
        p_lat: userLocation.latitude,
        p_lng: userLocation.longitude,
        p_radius_miles: 100,
        p_limit: 50,
      });
      if (error) throw error;
      setPlaces(data ?? []);
      setError(false);
    } catch (err) {
      console.error('Discover fetch error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useFocusEffect(
    useCallback(() => {
      if (userLocation) fetchPlaces();
    }, [userLocation, fetchPlaces])
  );

  const filteredPlaces = useMemo(() => {
    let result = places;
    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [places, selectedCategory, searchQuery]);

  // Fetch place detail when a marker is tapped
  const handlePlaceTap = useCallback(async (placeId: string) => {
    if (!user) return;
    const place = places.find((p) => p.place_id === placeId);
    if (!place) return;

    setSelectedPlaceId(placeId);
    setPlaceDetail(place);
    setDetailLoading(true);
    setPlaceRatings([]);

    try {
      // Privacy classification (network / public / private-locked) is enforced
      // server-side by the get_place_ratings SECURITY DEFINER RPC. Locked rows
      // come back with nulled identity/caption and is_private_locked = true.
      const { data, error } = await supabase.rpc('get_place_ratings', {
        p_place_id: placeId,
        p_user_id: user.id,
        p_limit: 50,
      });
      if (error) throw error;
      const rows = (data ?? []) as any[];

      // Photos aren't returned by the RPC — fetch them only for the visible
      // (non-locked) rows, whose parent posts are readable under RLS.
      const visibleIds = rows.filter((r) => !r.is_private_locked).map((r) => r.post_id);
      const photosByPost = new Map<string, { storage_path: string; display_order: number }[]>();
      if (visibleIds.length > 0) {
        const photosRes = await supabase
          .from('post_photos')
          .select('post_id, storage_path, display_order')
          .in('post_id', visibleIds);
        for (const ph of photosRes.data ?? []) {
          const arr = photosByPost.get(ph.post_id) ?? [];
          arr.push(ph);
          photosByPost.set(ph.post_id, arr);
        }
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const mapped: PlaceRating[] = rows.map((r) => ({
        post_id: r.post_id,
        user_id: r.user_id ?? '',
        display_name: r.is_private_locked ? '' : r.display_name ?? 'Unknown',
        photo_url: r.is_private_locked ? '' : r.photo_url ?? '',
        caption: r.is_private_locked ? '' : r.caption ?? '',
        rating: r.rating,
        category: r.category,
        created_at: r.created_at,
        is_network: !!r.is_network,
        is_private_locked: !!r.is_private_locked,
        post_photos: r.is_private_locked
          ? []
          : (photosByPost.get(r.post_id) ?? [])
              .sort((a, b) => a.display_order - b.display_order)
              .map((ph) => `${supabaseUrl}/storage/v1/object/public/post-photos/${ph.storage_path}`),
      }));

      mapped.sort((a, b) => {
        // Friends first, then named public posts, then anonymous locked ratings.
        if (a.is_network !== b.is_network) return a.is_network ? -1 : 1;
        if (a.is_private_locked !== b.is_private_locked) return a.is_private_locked ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setPlaceRatings(mapped);
    } catch (err) {
      console.error('Place detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [user, places]);

  const openDirections = useCallback(() => {
    if (!placeDetail) return;
    const addr = encodeURIComponent(placeDetail.address || placeDetail.name);
    const hasCoords = placeDetail.lat && placeDetail.lng && placeDetail.lat !== 0;
    if (Platform.OS === 'web') {
      const url = hasCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${placeDetail.lat},${placeDetail.lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
      window.open(url, '_blank');
    } else if (Platform.OS === 'ios') {
      const url = hasCoords
        ? `maps://app?daddr=${placeDetail.lat},${placeDetail.lng}`
        : `maps://app?daddr=${addr}`;
      Linking.openURL(url);
    } else {
      const url = hasCoords
        ? `google.navigation:q=${placeDetail.lat},${placeDetail.lng}`
        : `google.navigation:q=${addr}`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${hasCoords ? `${placeDetail.lat},${placeDetail.lng}` : addr}`);
      });
    }
  }, [placeDetail]);

  return (
    <ThemedView style={styles.container}>
      {/* Floating header */}
      <View style={[styles.floatingHeader, { paddingTop: (Platform.OS === 'web' ? WebNavHeight : insets.top) + Spacing.lg, backgroundColor: theme.background + 'E6' }]}>
        <Text style={[styles.title, { color: theme.text }]}>Discover</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text, borderBottomColor: theme.border }]}
          placeholder="Search places..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {FILTER_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedCategory(cat.key)}>
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? theme.text : theme.textTertiary,
                      borderBottomColor: isActive ? theme.text : 'transparent',
                    },
                  ]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Full-page map */}
      {loading || locationLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error && places.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn&apos;t load the map</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Check your connection and try again.
          </Text>
          <Pressable onPress={fetchPlaces}>
            <Text style={[styles.emptyCta, { color: theme.accent }]}>Retry →</Text>
          </Pressable>
        </View>
      ) : filteredPlaces.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {selectedCategory ? 'Nothing here yet' : 'Your map is empty'}
          </Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            {selectedCategory
              ? 'No one in your circle has shared a spot in this category yet.'
              : 'Share your favorite local spots and\nthey\'ll appear on the map.'}
          </Text>
          {!selectedCategory && (
            <Pressable onPress={() => router.push('/(tabs)/create')}>
              <Text style={[styles.emptyCta, { color: theme.accent }]}>Share a place →</Text>
            </Pressable>
          )}
        </View>
      ) : userLocation ? (
        <DiscoverMap
          places={filteredPlaces}
          centerLat={userLocation.latitude}
          centerLng={userLocation.longitude}
          onPressPlace={handlePlaceTap}
        />
      ) : null}

      {/* Place detail overlay */}
      {selectedPlaceId && placeDetail && (
        <View style={[styles.overlay, { backgroundColor: theme.background + 'F7' }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.overlayScroll}>
            {/* Close */}
            <Pressable onPress={() => setSelectedPlaceId(null)} hitSlop={12} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: theme.textTertiary }]}>×</Text>
            </Pressable>

            {/* Place info */}
            <Text style={[styles.overlayCategory, { color: theme.textTertiary }]}>
              {placeDetail.category?.toUpperCase() || 'PLACE'}
            </Text>
            <Text style={[styles.overlayName, { color: theme.text }]}>{placeDetail.name}</Text>
            <Text style={[styles.overlayAddress, { color: theme.textSecondary }]}>{placeDetail.address}</Text>

            <View style={styles.overlayRatingRow}>
              <WavelengthRating rating={placeDetail.avg_rating} />
              <Text style={[styles.overlayRatingCount, { color: theme.textTertiary }]}>
                {placeDetail.rating_count} {placeDetail.rating_count === 1 ? 'rating' : 'ratings'}
              </Text>
            </View>

            <View style={styles.overlayActions}>
              <Pressable onPress={openDirections}>
                <Text style={[styles.overlayActionText, { color: theme.accent }]}>Get directions →</Text>
              </Pressable>
              <Text style={{ color: theme.border }}>·</Text>
              <Text style={[styles.overlayDistance, { color: theme.textTertiary }]}>
                {placeDetail.distance_miles.toFixed(1)} mi away
              </Text>
            </View>

            {/* Divider */}
            <View style={[styles.overlayDivider, { backgroundColor: theme.border }]} />

            {/* Ratings */}
            {detailLoading ? (
              <SkeletonList count={3} type="card" />
            ) : placeRatings.length === 0 ? (
              <Text style={[styles.overlayEmpty, { color: theme.textTertiary }]}>
                No reviews yet
              </Text>
            ) : (
              placeRatings.map((r) =>
                r.is_private_locked ? (
                  <View key={r.post_id} style={styles.lockedRow}>
                    <View style={[styles.reviewAvatar, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={[styles.reviewAvatarText, { color: theme.textTertiary }]}>🔒</Text>
                    </View>
                    <Text style={[styles.lockedName, { color: theme.textTertiary }]}>Private member</Text>
                    <WavelengthRating rating={r.rating} size="sm" />
                  </View>
                ) : (
                  <View key={r.post_id} style={[styles.reviewItem, { borderBottomColor: theme.border }]}>
                    <View style={styles.reviewHeader}>
                      <View style={[styles.reviewAvatar, { backgroundColor: theme.backgroundElement }]}>
                        {r.photo_url ? (
                          <Image source={{ uri: r.photo_url }} style={styles.reviewAvatarImg} />
                        ) : (
                          <Text style={[styles.reviewAvatarText, { color: theme.textTertiary }]}>
                            {r.display_name?.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reviewName, { color: theme.text }]}>
                          {r.display_name}
                          {r.is_network ? <Text style={{ color: theme.accent }}> · friend</Text> : ''}
                        </Text>
                        <Text style={[styles.reviewDate, { color: theme.textTertiary }]}>{timeAgo(r.created_at)}</Text>
                      </View>
                      <WavelengthRating rating={r.rating} size="sm" />
                    </View>
                    {r.post_photos.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotos}>
                        {r.post_photos.map((uri, i) => (
                          <Image key={i} source={{ uri }} style={styles.reviewPhoto} contentFit="cover" />
                        ))}
                      </ScrollView>
                    )}
                    <Text style={[styles.reviewCaption, { color: theme.text }]}>"{r.caption}"</Text>
                  </View>
                )
              )
            )}
          </ScrollView>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.xl,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    gap: Spacing.lg,
    paddingRight: Spacing.xl,
  },
  filterText: {
    fontFamily: 'Lora_500Medium',
    fontSize: 12,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.lg,
  },
  emptyBody: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    fontFamily: 'Lora_500Medium',
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  searchInput: {
    fontFamily: 'Lora_400Regular',
    fontSize: 13,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },

  // Place detail overlay
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '65%',
    zIndex: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  overlayScroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'] + Spacing['3xl'],
  },
  closeBtn: {
    alignSelf: 'flex-end',
  },
  closeText: {
    fontSize: 24,
    lineHeight: 26,
  },
  overlayCategory: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  overlayName: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize['2xl'],
    lineHeight: 32,
    marginBottom: Spacing.xs,
  },
  overlayAddress: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  overlayRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  overlayRatingCount: {
    fontSize: FontSize.xs,
  },
  overlayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  overlayActionText: {
    fontFamily: 'Lora_500Medium',
    fontSize: 13,
  },
  overlayDistance: {
    fontSize: 12,
  },
  overlayDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing.lg,
  },
  overlayEmpty: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  reviewItem: {
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  reviewAvatarImg: {
    width: 28,
    height: 28,
  },
  reviewAvatarText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reviewName: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.sm,
  },
  reviewDate: {
    fontSize: 11,
  },
  reviewPhotos: {
    marginTop: Spacing.xs,
  },
  reviewPhoto: {
    width: 140,
    height: 140,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  reviewCaption: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  lockedName: {
    flex: 1,
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
  },
});
