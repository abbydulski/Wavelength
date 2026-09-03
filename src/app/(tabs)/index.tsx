import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecommendationCard } from '@/components/recommendation-card';
import { SkeletonList } from '@/components/skeleton';
import { ThemedView } from '@/components/themed-view';
import {
    BottomTabInset,
    ContentContainerWeb,
    FontSize,
    Spacing,
    WebNavHeight
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type FeedPost = {
  id: string;
  user_id: string;
  place_id: string;
  display_name: string;
  user_photo_url: string;
  place_name: string;
  place_address: string;
  caption: string;
  rating: number;
  category: string;
  created_at: string;
  photo_url: string | null;
  photo_urls: string[];
};

type LoveMap = Record<string, { count: number; loved: boolean }>;

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [loves, setLoves] = useState<LoveMap>({});
  const lastSeenRef = useRef<string | null>(null);

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    try {
      // People the user follows (+ self) — resolved first so the posts query
      // has a concrete id list.
      const followsRes = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const authorIds = [user.id, ...(followsRes.data?.map((f) => f.following_id) ?? [])];

      // Get posts from those authors, most recent first
      const { data, error: feedError } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          place_id,
          caption,
          rating,
          category,
          created_at,
          user:users!posts_user_id_fkey(display_name, photo_url),
          place:places!posts_place_id_fkey(name, address),
          photos:post_photos(storage_path, display_order)
        `)
        .in('user_id', authorIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (feedError) throw feedError;
      setError(false);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const mapped: FeedPost[] = (data ?? []).map((p: any) => {
        const allPhotos = (p.photos ?? [])
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((ph: any) => `${supabaseUrl}/storage/v1/object/public/post-photos/${ph.storage_path}`);
        return {
          id: p.id,
          user_id: p.user_id,
          place_id: p.place_id,
          display_name: p.user?.display_name ?? 'Unknown',
          user_photo_url: p.user?.photo_url ?? '',
          place_name: p.place?.name ?? '',
          place_address: p.place?.address ?? '',
          caption: p.caption ?? '',
          rating: p.rating,
          category: p.category ?? '',
          created_at: p.created_at,
          photo_url: allPhotos[0] ?? null,
          photo_urls: allPhotos,
        };
      });
      setPosts(mapped);

      // Fetch loves for these posts
      const postIds = mapped.map((p) => p.id);
      if (postIds.length > 0) {
        const { data: rxData } = await supabase
          .from('post_reactions')
          .select('post_id, user_id')
          .in('post_id', postIds)
          .eq('reaction', 'agree');

        const loveMap: LoveMap = {};
        for (const pid of postIds) loveMap[pid] = { count: 0, loved: false };
        for (const r of rxData ?? []) {
          if (!loveMap[r.post_id]) loveMap[r.post_id] = { count: 0, loved: false };
          loveMap[r.post_id].count++;
          if (r.user_id === user.id) loveMap[r.post_id].loved = true;
        }
        setLoves(loveMap);
      }
    } catch (err) {
      console.error('Feed fetch error:', err);
      setError(true);
    }
  }, [user]);

  const handleLove = useCallback(async (postId: string) => {
    if (!user) return;
    const current = loves[postId]?.loved;
    const prevState = loves[postId] ?? { count: 0, loved: false };
    import('@/lib/haptics').then((h) => h.hapticLight());

    // Optimistic update, rolled back if the write fails.
    setLoves((prev) => ({
      ...prev,
      [postId]: current
        ? { count: Math.max(0, (prev[postId]?.count ?? 1) - 1), loved: false }
        : { count: (prev[postId]?.count ?? 0) + 1, loved: true },
    }));

    const { error: rxError } = current
      ? await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id)
      : await supabase.from('post_reactions').upsert(
          { post_id: postId, user_id: user.id, reaction: 'agree' },
          { onConflict: 'post_id,user_id' }
        );

    if (rxError) {
      // Revert on failure so UI matches the DB.
      setLoves((prev) => ({ ...prev, [postId]: prevState }));
    }
  }, [user, loves]);

  useFocusEffect(
    useCallback(() => {
      // Load last-seen timestamp on first focus
      if (!lastSeenRef.current) {
        AsyncStorage.getItem('feed_last_seen').then((val) => {
          lastSeenRef.current = val || new Date(0).toISOString();
        });
      }
      fetchFeed().finally(() => {
        setLoading(false);
        // Update last-seen after loading
        AsyncStorage.setItem('feed_last_seen', new Date().toISOString());
      });
    }, [fetchFeed])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }, [fetchFeed]);

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => (
      <RecommendationCard
        displayName={item.display_name}
        avatarUrl={item.user_photo_url || undefined}
        placeName={item.place_name}
        placeAddress={item.place_address}
        note={item.caption}
        rating={item.rating}
        category={item.category}
        photoUrl={item.photo_url ?? undefined}
        photoUrls={item.photo_urls}
        createdAt={item.created_at}
        isNetwork
        isNew={!!lastSeenRef.current && item.created_at > lastSeenRef.current && item.user_id !== user?.id}
        onPressUser={() => router.push(`/user/${item.user_id}`)}
        onPressPlace={() => router.push(`/post/${item.id}`)}
        postId={item.id}
        loveCount={loves[item.id]?.count ?? 0}
        loved={loves[item.id]?.loved ?? false}
        onLove={handleLove}
      />
    ),
    [router, loves, handleLove]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.content, ContentContainerWeb]}>
          <View style={styles.header}>
            <Text style={[styles.brandName, { color: theme.text }]}>Wavelength</Text>
            <Pressable onPress={() => router.push('/activity')} hitSlop={8}>
              <Text style={[styles.activityLink, { color: theme.textTertiary }]}>Activity</Text>
            </Pressable>
          </View>
          {loading ? (
            <SkeletonList count={3} type="card" />
          ) : error && posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn&apos;t load your feed</Text>
              <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                Check your connection and try again.
              </Text>
              <Pressable onPress={onRefresh}>
                <Text style={[styles.emptyCta, { color: theme.accent }]}>Retry →</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderPost}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Your feed is quiet
                  </Text>
                  <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                    Recommendations from people you follow{'\n'}will show up here.
                  </Text>
                  <Pressable onPress={() => router.push('/(tabs)/search')}>
                    <Text style={[styles.emptyCta, { color: theme.accent }]}>
                      Find people to follow →
                    </Text>
                  </Pressable>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingTop: WebNavHeight },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  brandName: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize['2xl'],
  },
  activityLink: {
    fontFamily: 'Lora_400Regular',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: BottomTabInset + Spacing['2xl'],
  },
  emptyContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['3xl'] + Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.lg,
  },
  emptyTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.xl,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  emptyCta: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
  },
});
