import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
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

type UserResult = {
  id: string;
  display_name: string;
  photo_url: string;
  bio: string;
  posts_count: number;
  is_private: boolean;
};

export default function SearchScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Load who the current user follows + pending requests
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follow_requests').select('to_user_id').eq('from_user_id', user.id),
    ]).then(([followsRes, requestsRes]) => {
      if (followsRes.data) setFollowingIds(new Set(followsRes.data.map((r) => r.following_id)));
      if (requestsRes.data) setRequestedIds(new Set(requestsRes.data.map((r) => r.to_user_id)));
    });
  }, [user]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('users')
        .select('id, display_name, photo_url, bio, posts_count, is_private')
        .ilike('display_name', `%${query.trim()}%`)
        .neq('id', user?.id ?? '')
        .limit(20);
      setResults(data ?? []);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, user]);

  const toggleFollow = useCallback(
    async (targetId: string) => {
      if (!user) return;
      setTogglingId(targetId);
      const isFollowing = followingIds.has(targetId);
      const isRequested = requestedIds.has(targetId);
      const target = results.find((r) => r.id === targetId);

      if (isFollowing) {
        // Unfollow
        await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
        setFollowingIds((prev) => { const n = new Set(prev); n.delete(targetId); return n; });
      } else if (isRequested) {
        // Cancel request
        await supabase.from('follow_requests').delete().eq('from_user_id', user.id).eq('to_user_id', targetId);
        setRequestedIds((prev) => { const n = new Set(prev); n.delete(targetId); return n; });
      } else if (target?.is_private) {
        // Send follow request
        await supabase.from('follow_requests').insert({ from_user_id: user.id, to_user_id: targetId });
        setRequestedIds((prev) => new Set(prev).add(targetId));
      } else {
        // Instant follow
        await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
        setFollowingIds((prev) => new Set(prev).add(targetId));
      }
      import('@/lib/haptics').then(h => h.hapticMedium());
      setTogglingId(null);
    },
    [user, followingIds, requestedIds, results]
  );

  const renderUser = useCallback(
    ({ item }: { item: UserResult }) => {
      const isFollowing = followingIds.has(item.id);
      const isRequested = requestedIds.has(item.id);
      const btnLabel = isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow';
      const btnActive = isFollowing || isRequested;
      return (
        <View style={[styles.userCard, { borderBottomColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: theme.textTertiary }]}>
                {(item.display_name || '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {item.display_name}
              {item.is_private ? ' 🔒' : ''}
            </Text>
            {item.bio ? (
              <Text style={[styles.userBio, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.bio}
              </Text>
            ) : null}
            <Text style={[styles.userMeta, { color: theme.textTertiary }]}>
              {item.posts_count} {item.posts_count === 1 ? 'recommendation' : 'recommendations'}
            </Text>
          </View>
          <Pressable
            onPress={() => toggleFollow(item.id)}
            disabled={togglingId === item.id}>
            {togglingId === item.id ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Text style={[styles.followText, { color: btnActive ? theme.textTertiary : theme.accent }]}>
                {btnLabel}
              </Text>
            )}
          </Pressable>
        </View>
      );
    },
    [followingIds, requestedIds, theme, togglingId, toggleFollow]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.content, ContentContainerWeb]}>
          <ThemedText type="title" style={styles.title}>
            Search
          </ThemedText>
          <TextInput
            style={[
              styles.searchInput,
              {
                color: theme.text,
                borderBottomColor: theme.border,
              },
            ]}
            placeholder="Search by name..."
            placeholderTextColor={theme.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading ? (
            <ActivityIndicator style={styles.loader} color={theme.accent} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderUser}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                query.trim().length >= 2 ? (
                  <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    No users found
                  </ThemedText>
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    Type a name to find people
                  </ThemedText>
                )
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: WebNavHeight + Spacing.xl,
    paddingBottom: BottomTabInset,
  },
  title: { marginBottom: Spacing.lg },
  searchInput: {
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
    fontSize: FontSize.base,
    fontFamily: 'Lora_400Regular',
    marginBottom: Spacing.md,
  },
  loader: { marginTop: Spacing['2xl'] },
  listContent: {
    paddingBottom: Spacing['2xl'],
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarText: {
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  userName: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.sm,
  },
  userBio: {
    fontSize: 12,
    lineHeight: 16,
  },
  userMeta: {
    fontSize: 11,
  },
  userInfo: { flex: 1, gap: 2 },
  followText: {
    fontFamily: 'Lora_500Medium',
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing['2xl'],
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
  },
});
