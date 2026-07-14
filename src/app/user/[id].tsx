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

import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WavelengthRating } from '@/components/wavelength-rating';
import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type UserProfile = { display_name: string; bio: string; photo_url: string; posts_count: number };
type UserPost = {
  id: string;
  caption: string;
  rating: number;
  category: string;
  created_at: string;
  places: { name: string } | null;
};

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

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [profileRes, postsRes, followRes, requestRes] = await Promise.all([
        supabase.from('users').select('display_name, bio, photo_url, posts_count, is_private').eq('id', id).single(),
        supabase.from('posts').select('id, caption, rating, category, created_at, places(name)').eq('user_id', id).order('created_at', { ascending: false }),
        user ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from('follow_requests').select('id').eq('from_user_id', user.id).eq('to_user_id', id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (profileRes.data) setProfile(profileRes.data as any);
      setPosts((postsRes.data as UserPost[]) ?? []);
      setIsFollowing(!!followRes.data);
      setIsRequested(!!requestRes.data);
      setLoading(false);
    })();
  }, [id, user]);

  const toggleFollow = async () => {
    if (!user || !id) return;
    setToggling(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
      setIsFollowing(false);
    } else if (isRequested) {
      await supabase.from('follow_requests').delete().eq('from_user_id', user.id).eq('to_user_id', id);
      setIsRequested(false);
    } else if ((profile as any)?.is_private) {
      await supabase.from('follow_requests').insert({ from_user_id: user.id, to_user_id: id });
      setIsRequested(true);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
      setIsFollowing(true);
    }
    setToggling(false);
  };

  const isOwnProfile = user?.id === id;

  const renderPost = ({ item }: { item: UserPost }) => (
    <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.postCategory, { color: theme.rust }]}>{item.category?.toUpperCase() || 'PLACE'}</Text>
      <Text style={[styles.postPlace, { color: theme.text }]}>{item.places?.name ?? 'Unknown'}</Text>
      <WavelengthRating rating={item.rating} size="sm" />
      <Text style={[styles.postCaption, { color: theme.text }]} numberOfLines={2}>"{item.caption}"</Text>
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.backText, { color: theme.accent }]}>← Back</Text>
          </Pressable>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: theme.textTertiary }]}>
                  {(profile?.display_name || '?')[0].toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.name, { color: theme.text }]}>{profile?.display_name}</Text>
              {profile?.bio ? <ThemedText themeColor="textSecondary" type="small">{profile.bio}</ThemedText> : null}
              <ThemedText themeColor="textSecondary" type="small">
                {posts.length} {posts.length === 1 ? 'recommendation' : 'recommendations'}
              </ThemedText>
            </View>
            {!isOwnProfile && (
              <Pressable
                onPress={toggleFollow}
                disabled={toggling}
                style={[styles.followBtn, (isFollowing || isRequested) ? { borderColor: theme.border, borderWidth: 1 } : { backgroundColor: theme.accent }]}>
                <Text style={[styles.followText, { color: (isFollowing || isRequested) ? theme.text : '#fff' }]}>
                  {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.lg },
  backText: { fontSize: FontSize.base, fontWeight: '600' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: FontSize.xl, fontWeight: '700' },
  profileInfo: { flex: 1, gap: Spacing.xs },
  name: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize.xl },
  followBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, minWidth: 90, alignItems: 'center' },
  followText: { fontSize: FontSize.sm, fontWeight: '600' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['2xl'], gap: Spacing.md },
  postCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.xl, gap: Spacing.md },
  postCategory: { fontSize: 11, letterSpacing: 1.5, fontWeight: '500' },
  postPlace: { fontFamily: 'Lora_500Medium', fontSize: FontSize.lg },
  postCaption: { fontFamily: 'Lora_400Regular_Italic', fontStyle: 'italic', fontSize: FontSize.base, lineHeight: 22 },
});
