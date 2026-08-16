import { CrossImage as Image } from '@/components/cross-image';
import { useRouter } from 'expo-router';
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
import { FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type ActivityItem = {
  id: string;
  type: 'love' | 'follow' | 'follow_request';
  actor_id: string;
  actor_name: string;
  actor_photo: string;
  context?: string; // place name for loves
  created_at: string;
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

export default function ActivityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Fetch loves on my posts, new followers, and follow requests in parallel
        const [lovesRes, followsRes, requestsRes] = await Promise.all([
          supabase
            .from('post_reactions')
            .select('id, user_id, created_at, reaction, post:posts!inner(user_id, place:places(name)), actor:users!post_reactions_user_id_fkey(display_name, photo_url)')
            .eq('post.user_id', user.id)
            .neq('user_id', user.id)
            .eq('reaction', 'agree')
            .order('created_at', { ascending: false })
            .limit(30),
          supabase
            .from('follows')
            .select('id, follower_id, created_at, actor:users!follows_follower_id_fkey(display_name, photo_url)')
            .eq('following_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('follow_requests')
            .select('id, from_user_id, created_at, actor:users!follow_requests_from_user_id_fkey(display_name, photo_url)')
            .eq('to_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        const all: ActivityItem[] = [];

        for (const r of lovesRes.data ?? []) {
          const a = r as any;
          all.push({
            id: `love-${a.id}`,
            type: 'love',
            actor_id: a.user_id,
            actor_name: a.actor?.display_name ?? 'Someone',
            actor_photo: a.actor?.photo_url ?? '',
            context: a.post?.place?.name ?? '',
            created_at: a.created_at,
          });
        }

        for (const f of followsRes.data ?? []) {
          const a = f as any;
          all.push({
            id: `follow-${a.id}`,
            type: 'follow',
            actor_id: a.follower_id,
            actor_name: a.actor?.display_name ?? 'Someone',
            actor_photo: a.actor?.photo_url ?? '',
            created_at: a.created_at,
          });
        }

        for (const r of requestsRes.data ?? []) {
          const a = r as any;
          all.push({
            id: `request-${a.id}`,
            type: 'follow_request',
            actor_id: a.from_user_id,
            actor_name: a.actor?.display_name ?? 'Someone',
            actor_photo: a.actor?.photo_url ?? '',
            created_at: a.created_at,
          });
        }

        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(all);
      } catch (err) {
        console.error('Activity fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const renderItem = ({ item }: { item: ActivityItem }) => {
    let message = '';
    if (item.type === 'love') message = `loved your rec${item.context ? ` of ${item.context}` : ''}`;
    else if (item.type === 'follow') message = 'started following you';
    else message = 'requested to follow you';

    return (
      <Pressable
        style={[styles.item, { borderBottomColor: theme.border }]}
        onPress={() => router.push(`/user/${item.actor_id}`)}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
          {item.actor_photo ? (
            <Image source={{ uri: item.actor_photo }} style={styles.avatarImg} />
          ) : (
            <Text style={[styles.avatarText, { color: theme.textTertiary }]}>
              {item.actor_name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemText, { color: theme.text }]}>
            <Text style={styles.actorName}>{item.actor_name}</Text> {message}
          </Text>
          <Text style={[styles.itemTime, { color: theme.textTertiary }]}>{timeAgo(item.created_at)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.backText, { color: theme.accent }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Activity</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: Spacing['3xl'] }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                  No activity yet
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: WebNavHeight + Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backText: { fontSize: 20 },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.xl,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
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
  avatarImg: { width: 36, height: 36 },
  avatarText: { fontSize: 13, fontWeight: '600' },
  itemContent: { flex: 1, gap: 2 },
  itemText: {
    fontFamily: 'Lora_400Regular',
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  actorName: {
    fontFamily: 'Lora_600SemiBold',
  },
  itemTime: {
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
