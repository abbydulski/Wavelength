import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { ThemedView } from '@/components/themed-view';
import { WavelengthRating } from '@/components/wavelength-rating';
import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

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
};

type PlaceInfo = {
  id: string;
  name: string;
  address: string;
  category: string;
  avg_rating: number;
  rating_count: number;
};

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [ratings, setRatings] = useState<PlaceRating[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      // Fetch place info
      const placeRes = await supabase
        .from('places')
        .select('id, name, address, category, avg_rating, rating_count')
        .eq('id', id)
        .single();
      if (placeRes.data) setPlace(placeRes.data);

      // Fetch posts for this place with user info and photos
      const postsRes = await supabase
        .from('posts')
        .select('id, user_id, caption, rating, category, created_at, user:users(display_name, photo_url), photos:post_photos(storage_path, display_order)')
        .eq('place_id', id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      // Check which posters the current user follows
      const posts = postsRes.data ?? [];
      let followingSet = new Set<string>();
      // Also fetch which posters are private
      let privateSet = new Set<string>();
      if (posts.length > 0) {
        const posterIds = [...new Set(posts.map((p: any) => p.user_id))];
        const [followRes, privacyRes] = await Promise.all([
          supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id)
            .in('following_id', posterIds),
          supabase
            .from('users')
            .select('id, is_private')
            .in('id', posterIds)
            .eq('is_private', true),
        ]);
        followingSet = new Set((followRes.data ?? []).map((f: any) => f.following_id));
        privateSet = new Set((privacyRes.data ?? []).map((u: any) => u.id));
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const mapped: PlaceRating[] = posts
        // Filter out private users' posts unless it's your own post or you follow them
        .filter((p: any) => {
          if (p.user_id === user.id) return true; // always show your own
          if (privateSet.has(p.user_id) && !followingSet.has(p.user_id)) return false;
          return true;
        })
        .map((p: any) => {
          const sortedPhotos = (p.photos ?? [])
            .sort((a: any, b: any) => a.display_order - b.display_order)
            .map((ph: any) => `${supabaseUrl}/storage/v1/object/public/post-photos/${ph.storage_path}`);
          return {
            post_id: p.id,
            user_id: p.user_id,
            display_name: p.user?.display_name ?? 'Unknown',
            photo_url: p.user?.photo_url ?? '',
            caption: p.caption,
            rating: p.rating,
            category: p.category,
            created_at: p.created_at,
            is_network: followingSet.has(p.user_id),
            post_photos: sortedPhotos,
          };
        });

      // Sort: network first, then by date
      mapped.sort((a, b) => {
        if (a.is_network !== b.is_network) return a.is_network ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setRatings(mapped);
    } catch (err) {
      console.error('Place detail error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const networkRatings = ratings.filter((r) => r.is_network);
  const otherRatings = ratings.filter((r) => !r.is_network);

  const renderRating = ({ item }: { item: PlaceRating }) => (
    <View style={[styles.ratingCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.ratingHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: theme.textTertiary }]}>
              {item.display_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          )}
        </View>
        <View style={styles.ratingMeta}>
          <Text style={[styles.ratingAuthor, { color: theme.text }]}>{item.display_name}</Text>
          <Text style={[styles.ratingDate, { color: theme.textTertiary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        {item.is_network && (
          <View style={[styles.networkBadge, { backgroundColor: theme.accentLight }]}>
            <Text style={[styles.networkBadgeText, { color: theme.accent }]}>Friend</Text>
          </View>
        )}
      </View>
      <WavelengthRating rating={item.rating} size="sm" />
      {item.post_photos.length > 0 && (
        <FlatList
          data={item.post_photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, i) => `${item.post_id}-photo-${i}`}
          renderItem={({ item: uri }) => (
            <Image source={{ uri }} style={styles.postPhoto} contentFit="cover" />
          )}
          style={styles.photoList}
        />
      )}
      <Text style={[styles.ratingCaption, { color: theme.text }]}>"{item.caption}"</Text>
    </View>
  );

  const ListHeader = () => (
    <View style={styles.headerSection}>
      {/* Back button */}
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/discover')} hitSlop={12}>
        <Text style={[styles.backText, { color: theme.accent }]}>← Back</Text>
      </Pressable>

      {place && (
        <>
          <Text style={[styles.placeCategory, { color: theme.rust }]}>
            {place.category?.toUpperCase() || 'PLACE'}
          </Text>
          <Text style={[styles.placeName, { color: theme.text }]}>{place.name}</Text>
          <Text style={[styles.placeAddress, { color: theme.textSecondary }]}>{place.address}</Text>
          <View style={styles.ratingRow}>
            <WavelengthRating rating={place.avg_rating} />
            <Text style={[styles.ratingCountText, { color: theme.textTertiary }]}>
              {place.rating_count} {place.rating_count === 1 ? 'rating' : 'ratings'}
            </Text>
          </View>
        </>
      )}

      {/* Section headers */}
      {networkRatings.length > 0 && (
        <Text style={[styles.sectionLabel, { color: theme.accent }]}>FROM YOUR NETWORK</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Combine: network first, then divider label, then others
  const allItems = [
    ...networkRatings,
    ...otherRatings,
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.post_id}
          renderItem={renderRating}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No ratings yet. Be the first!
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  headerSection: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.md },
  backText: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base },
  placeCategory: { fontSize: 11, letterSpacing: 1.5, fontWeight: '500', marginTop: Spacing.md },
  placeName: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize['2xl'], lineHeight: 34 },
  placeAddress: { fontSize: FontSize.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ratingCountText: { fontSize: FontSize.sm },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600', marginTop: Spacing.xl },
  listContent: { paddingBottom: Spacing['3xl'], gap: Spacing.md },
  ratingCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  ratingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { width: 32, height: 32, borderRadius: 16 },
  avatarText: { fontSize: FontSize.sm, fontWeight: '600' },
  ratingMeta: { flex: 1 },
  ratingAuthor: { fontSize: FontSize.base, fontWeight: '500' },
  ratingDate: { fontSize: FontSize.xs },
  networkBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  networkBadgeText: { fontSize: 11, fontWeight: '600' },
  ratingCaption: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  postPhoto: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  photoList: {
    marginVertical: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.base, fontFamily: 'Lora_400Regular_Italic', fontStyle: 'italic' },
});
