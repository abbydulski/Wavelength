import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

type ReactionMap = Record<string, { agree: number; disagree: number; mine: 'agree' | 'disagree' | null }>;

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reactions, setReactions] = useState<ReactionMap>({});

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    try {
      // Get posts from people the user follows, most recent first
      const { data, error } = await supabase
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
          photos:post_photos(storage_path)
        `)
        .in(
          'user_id',
          // Include own posts + posts from people the user follows
          [
            user.id,
            ...((await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id)
            ).data?.map((f) => f.following_id) ?? []),
          ]
        )
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Feed error:', error);
        return;
      }

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

      // Fetch reactions for these posts
      const postIds = mapped.map((p) => p.id);
      if (postIds.length > 0) {
        const { data: rxData } = await supabase
          .from('post_reactions')
          .select('post_id, reaction, user_id')
          .in('post_id', postIds);

        const rxMap: ReactionMap = {};
        for (const pid of postIds) rxMap[pid] = { agree: 0, disagree: 0, mine: null };
        for (const r of rxData ?? []) {
          if (!rxMap[r.post_id]) rxMap[r.post_id] = { agree: 0, disagree: 0, mine: null };
          if (r.reaction === 'agree') rxMap[r.post_id].agree++;
          else rxMap[r.post_id].disagree++;
          if (r.user_id === user.id) rxMap[r.post_id].mine = r.reaction as 'agree' | 'disagree';
        }
        setReactions(rxMap);
      }
    } catch (err) {
      console.error('Feed fetch error:', err);
    }
  }, [user]);

  const handleReact = useCallback(async (postId: string, reaction: 'agree' | 'disagree') => {
    if (!user) return;
    const current = reactions[postId]?.mine;
    if (current === reaction) {
      // Remove reaction
      await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id);
      setReactions((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          [reaction]: Math.max(0, (prev[postId]?.[reaction] ?? 1) - 1),
          mine: null,
        },
      }));
    } else {
      // Upsert reaction
      await supabase.from('post_reactions').upsert(
        { post_id: postId, user_id: user.id, reaction },
        { onConflict: 'post_id,user_id' }
      );
      setReactions((prev) => {
        const old = prev[postId] ?? { agree: 0, disagree: 0, mine: null };
        return {
          ...prev,
          [postId]: {
            agree: old.agree + (reaction === 'agree' ? 1 : 0) - (current === 'agree' ? 1 : 0),
            disagree: old.disagree + (reaction === 'disagree' ? 1 : 0) - (current === 'disagree' ? 1 : 0),
            mine: reaction,
          },
        };
      });
    }
  }, [user, reactions]);

  useFocusEffect(
    useCallback(() => {
      fetchFeed().finally(() => setLoading(false));
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
        onPressPlace={() => router.push('/(tabs)/discover')}
        onPressUser={() => router.push(`/user/${item.user_id}`)}
        postId={item.id}
        agreeCount={reactions[item.id]?.agree ?? 0}
        disagreeCount={reactions[item.id]?.disagree ?? 0}
        userReaction={reactions[item.id]?.mine ?? null}
        onReact={handleReact}
      />
    ),
    [router, reactions, handleReact]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.content, ContentContainerWeb]}>
          <View style={styles.header}>
            <Text style={[styles.brandName, { color: theme.text }]}>Wavelength</Text>
          </View>
          {loading ? (
            <SkeletonList count={3} type="card" />
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  brandName: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize['2xl'],
  },
  loader: { marginTop: Spacing['3xl'] },
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
