import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecommendationCard } from '@/components/recommendation-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PostDetail = {
  id: string;
  user_id: string;
  display_name: string;
  user_photo_url: string;
  place_name: string;
  place_address: string;
  caption: string;
  rating: number;
  category: string;
  created_at: string;
  photo_urls: string[];
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [love, setLove] = useState<{ count: number; loved: boolean }>({ count: 0, loved: false });

  const fetchPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error: postError } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          caption,
          rating,
          category,
          created_at,
          user:users!posts_user_id_fkey(display_name, photo_url),
          place:places!posts_place_id_fkey(name, address),
          photos:post_photos(storage_path, display_order)
        `)
        .eq('id', id)
        .single();

      if (postError || !data) throw postError ?? new Error('Not found');

      const p = data as any;
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const photo_urls = (p.photos ?? [])
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((ph: any) => `${supabaseUrl}/storage/v1/object/public/post-photos/${ph.storage_path}`);

      setPost({
        id: p.id,
        user_id: p.user_id,
        display_name: p.user?.display_name ?? 'Unknown',
        user_photo_url: p.user?.photo_url ?? '',
        place_name: p.place?.name ?? '',
        place_address: p.place?.address ?? '',
        caption: p.caption ?? '',
        rating: p.rating,
        category: p.category ?? '',
        created_at: p.created_at,
        photo_urls,
      });

      const { data: rxData } = await supabase
        .from('post_reactions')
        .select('user_id')
        .eq('post_id', id)
        .eq('reaction', 'agree');
      const count = rxData?.length ?? 0;
      const loved = !!rxData?.some((r: any) => r.user_id === user?.id);
      setLove({ count, loved });
      setError(false);
    } catch (err) {
      console.error('Post fetch error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleLove = useCallback(async (postId: string) => {
    if (!user) return;
    const current = love.loved;
    const prev = love;
    import('@/lib/haptics').then((h) => h.hapticLight());
    setLove(current
      ? { count: Math.max(0, love.count - 1), loved: false }
      : { count: love.count + 1, loved: true });
    const { error: rxError } = current
      ? await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id)
      : await supabase.from('post_reactions').upsert(
          { post_id: postId, user_id: user.id, reaction: 'agree' },
          { onConflict: 'post_id,user_id' }
        );
    if (rxError) setLove(prev);
  }, [user, love]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.backText, { color: theme.accent }]}>←</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : error || !post ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Post unavailable</Text>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              This recommendation may have been removed or is private.
            </ThemedText>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <RecommendationCard
              displayName={post.display_name}
              avatarUrl={post.user_photo_url || undefined}
              placeName={post.place_name}
              placeAddress={post.place_address}
              note={post.caption}
              rating={post.rating}
              category={post.category}
              photoUrls={post.photo_urls}
              createdAt={post.created_at}
              isNetwork
              onPressUser={post.user_id === user?.id ? undefined : () => router.push(`/user/${post.user_id}`)}
              postId={post.id}
              loveCount={love.count}
              loved={love.loved}
              onLove={handleLove}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontSize: 28, fontFamily: 'Lora_400Regular' },
  scrollContent: { paddingBottom: Spacing['3xl'] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: 'Lora_500Medium' },
  emptySubtitle: { fontSize: FontSize.sm, textAlign: 'center' },
});
