import { CrossImage as Image } from '@/components/cross-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { WavelengthRating } from '@/components/wavelength-rating';
import { FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type UserProfile = { display_name: string; bio: string; photo_url: string; is_private: boolean };
type UserPost = {
  id: string;
  caption: string;
  rating: number;
  category: string;
  created_at: string;
  places: { name: string; address: string } | null;
};

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

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [profileRes, postsRes, followRes, requestRes, followersRes, followingRes] = await Promise.all([
        supabase.from('users').select('display_name, bio, photo_url, is_private').eq('id', id).single(),
        supabase.from('posts').select('id, caption, rating, category, created_at, places(name, address)').eq('user_id', id).order('created_at', { ascending: false }),
        user ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from('follow_requests').select('id').eq('from_user_id', user.id).eq('to_user_id', id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
      ]);
      if (profileRes.data) setProfile(profileRes.data as any);
      // If private and not following, hide posts
      const isPriv = (profileRes.data as any)?.is_private;
      const following = !!followRes.data;
      const isOwn = user?.id === id;
      if (isPriv && !following && !isOwn) {
        setPosts([]);
      } else {
        setPosts((postsRes.data as unknown as UserPost[]) ?? []);
      }
      setIsFollowing(following);
      setIsRequested(!!requestRes.data);
      setFollowerCount(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);
      setLoading(false);
    })();
  }, [id, user]);

  const toggleFollow = async () => {
    if (!user || !id) return;
    setToggling(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else if (isRequested) {
      await supabase.from('follow_requests').delete().eq('from_user_id', user.id).eq('to_user_id', id);
      setIsRequested(false);
    } else if (profile?.is_private) {
      await supabase.from('follow_requests').insert({ from_user_id: user.id, to_user_id: id });
      setIsRequested(true);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    import('@/lib/haptics').then(h => h.hapticMedium());
    setToggling(false);
  };

  const isOwnProfile = user?.id === id;

  const renderPost = ({ item }: { item: UserPost }) => (
    <Pressable
      onPress={() => router.push(`/post/${item.id}`)}
      style={({ pressed }) => [styles.postItem, { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.postCategory, { color: theme.textTertiary }]}>
        {item.category?.toUpperCase() || 'PLACE'}
      </Text>
      <Text style={[styles.postPlace, { color: theme.text }]}>
        {item.places?.name ?? 'Unknown'}
      </Text>
      <WavelengthRating rating={item.rating} size="sm" />
      <Text style={[styles.postCaption, { color: theme.text }]} numberOfLines={2}>
        "{item.caption}"
      </Text>
      <View style={styles.postFooter}>
        {item.places?.address ? (
          <Text style={[styles.postAddress, { color: theme.textTertiary }]} numberOfLines={1}>
            {item.places.address}
          </Text>
        ) : null}
        <Text style={[styles.postDate, { color: theme.textTertiary }]}>{timeAgo(item.created_at)}</Text>
      </View>
    </Pressable>
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

  const isPrivateHidden = profile?.is_private && !isFollowing && !isOwnProfile;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={isPrivateHidden ? [] : posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Text style={[styles.backText, { color: theme.accent }]}>←</Text>
              </Pressable>

              <View style={styles.profileSection}>
                <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                  {profile?.photo_url ? (
                    <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: theme.textTertiary }]}>
                      {(profile?.display_name || '?')[0].toUpperCase()}
                    </Text>
                  )}
                </View>

                <Text style={[styles.name, { color: theme.text }]}>{profile?.display_name}</Text>
                {profile?.bio ? (
                  <Text style={[styles.bio, { color: theme.textSecondary }]}>{profile.bio}</Text>
                ) : null}

                <Text style={[styles.statsText, { color: theme.textTertiary }]}>
                  {posts.length} {posts.length === 1 ? 'rec' : 'recs'} · {followerCount} {followerCount === 1 ? 'follower' : 'followers'} · {followingCount} following
                </Text>

                {!isOwnProfile && (
                  <Pressable onPress={toggleFollow} disabled={toggling}>
                    <Text style={[styles.followLink, { color: isFollowing ? theme.textTertiary : theme.accent }]}>
                      {toggling ? '...' : isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              {isPrivateHidden ? (
                <Text style={[styles.privateText, { color: theme.textTertiary }]}>
                  This account is private.{'\n'}Follow to see their recommendations.
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !isPrivateHidden ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                  No recommendations yet
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: WebNavHeight + Spacing.md,
    paddingBottom: Spacing.md,
  },
  backText: {
    fontSize: 20,
    marginBottom: Spacing.xl,
  },
  profileSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  avatarImage: { width: 64, height: 64 },
  avatarText: { fontSize: FontSize.xl, fontWeight: '600' },
  name: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize['2xl'],
  },
  bio: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },
  statsText: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  followLink: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  privateText: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingTop: Spacing['3xl'],
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  postItem: {
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  postCategory: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '500',
  },
  postPlace: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.lg,
    lineHeight: 24,
  },
  postCaption: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postAddress: {
    fontSize: 11,
    flex: 1,
    marginRight: Spacing.md,
  },
  postDate: {
    fontSize: 11,
  },
  emptyContainer: {
    paddingTop: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
  },
});
