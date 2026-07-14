import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WavelengthRating } from '@/components/wavelength-rating';
import { BorderRadius, BottomTabInset, ContentContainerWeb, FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type UserPost = {
  id: string;
  caption: string;
  rating: number;
  category: string;
  created_at: string;
  places: { name: string; address: string } | null;
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followRequests, setFollowRequests] = useState<{ id: string; from_user_id: string; display_name: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, postsRes, requestsRes] = await Promise.all([
        supabase.from('users').select('display_name, bio, photo_url, is_private').eq('id', user.id).single(),
        supabase
          .from('posts')
          .select('id, caption, rating, category, created_at, places(name, address)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('follow_requests')
          .select('id, from_user_id, users:users!follow_requests_from_user_id_fkey(display_name)')
          .eq('to_user_id', user.id),
      ]);
      if (profileRes.data) {
        setDisplayName(profileRes.data.display_name ?? '');
        setBio((profileRes.data as any).bio ?? '');
        setPhotoUrl(profileRes.data.photo_url ?? null);
        setIsPrivate((profileRes.data as any).is_private ?? false);
      }
      setPosts((postsRes.data as UserPost[]) ?? []);
      setFollowRequests(
        (requestsRes.data ?? []).map((r: any) => ({
          id: r.id,
          from_user_id: r.from_user_id,
          display_name: r.users?.display_name ?? 'Someone',
        }))
      );
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const pickProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0] || !user) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from('users').update({ photo_url: newUrl }).eq('id', user.id);
      setPhotoUrl(newUrl);
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const startEditing = () => {
    setEditName(displayName);
    setEditBio(bio);
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from('users').update({
        display_name: editName.trim(),
        bio: editBio.trim(),
      }).eq('id', user.id);
      setDisplayName(editName.trim());
      setBio(editBio.trim());
      setEditing(false);
    } catch (err) {
      console.error('Save profile error:', err);
    } finally {
      setSaving(false);
    }
  };

  const approveRequest = async (requestId: string, fromUserId: string) => {
    if (!user) return;
    // Add to follows + delete the request
    await supabase.from('follows').insert({ follower_id: fromUserId, following_id: user.id });
    await supabase.from('follow_requests').delete().eq('id', requestId);
    setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  const denyRequest = async (requestId: string) => {
    await supabase.from('follow_requests').delete().eq('id', requestId);
    setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  const deletePost = (postId: string) => {
    import('@/lib/haptics').then(h => h.hapticWarning());
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this recommendation?')) {
        supabase.from('posts').delete().eq('id', postId).then(() => {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        });
      }
    } else {
      Alert.alert('Delete post', 'Are you sure you want to delete this recommendation?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('posts').delete().eq('id', postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          },
        },
      ]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const renderPost = ({ item }: { item: UserPost }) => (
    <View style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable
        style={styles.deleteBtn}
        onPress={() => deletePost(item.id)}
        hitSlop={8}>
        <Text style={[styles.deleteBtnText, { color: theme.textTertiary }]}>×</Text>
      </Pressable>
      <Text style={[styles.postCategory, { color: theme.rust }]}>
        {item.category?.toUpperCase() || 'PLACE'}
      </Text>
      <Text style={[styles.postPlaceName, { color: theme.text }]}>
        {item.places?.name ?? 'Unknown place'}
      </Text>
      <WavelengthRating rating={item.rating} size="sm" />
      <Text style={[styles.postCaption, { color: theme.text }]} numberOfLines={2}>
        "{item.caption}"
      </Text>
      <Text style={[styles.postDate, { color: theme.textTertiary }]}>
        {timeAgo(item.created_at)}
      </Text>
    </View>
  );

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={pickProfilePhoto} style={styles.avatarContainer}>
              {uploadingPhoto ? (
                <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              ) : photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.avatarFallback, { color: theme.textTertiary }]}>
                    {(displayName || user?.email?.[0] || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.editPhotoText, { color: theme.accent }]}>Photo</Text>
            </Pressable>
            <View style={styles.headerInfo}>
              {editing ? (
                <>
                  <TextInput
                    style={[styles.editInput, { color: theme.text, borderColor: theme.border }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Display name"
                    placeholderTextColor={theme.textTertiary}
                  />
                  <TextInput
                    style={[styles.editInput, styles.editBioInput, { color: theme.text, borderColor: theme.border }]}
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Bio"
                    placeholderTextColor={theme.textTertiary}
                    multiline
                  />
                  <View style={styles.editActions}>
                    <Pressable onPress={() => setEditing(false)}>
                      <Text style={[styles.editActionText, { color: theme.textSecondary }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveProfile}
                      disabled={saving}
                      style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
                      <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.title, { color: theme.text }]}>
                    {displayName || user?.email?.split('@')[0] || 'You'}
                  </Text>
                  {bio ? (
                    <ThemedText themeColor="textSecondary" style={styles.bioText}>
                      {bio}
                    </ThemedText>
                  ) : null}
                  <Text style={[styles.postsCount, { color: theme.textSecondary }]}>
                    {posts.length} {posts.length === 1 ? 'recommendation' : 'recommendations'}
                  </Text>
                  <Pressable onPress={startEditing}>
                    <Text style={[styles.editProfileText, { color: theme.accent }]}>Edit profile</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          {!editing && (
            <View style={styles.settingsRow}>
              <View style={[styles.privacyRow, { borderColor: theme.border }]}>
                <View style={styles.privacyInfo}>
                  <Text style={[styles.privacyLabel, { color: theme.text }]}>Private account</Text>
                  <Text style={[styles.privacyHint, { color: theme.textTertiary }]}>
                    Your ratings count, but your posts are hidden from non-followers
                  </Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={async (val) => {
                    setIsPrivate(val);
                    await supabase.from('users').update({ is_private: val }).eq('id', user!.id);
                  }}
                  trackColor={{ false: theme.backgroundElement, true: theme.accent }}
                />
              </View>
              <Pressable
                style={[styles.signOutButton, { borderColor: theme.border }]}
                onPress={signOut}>
                <Text style={[styles.signOutText, { color: theme.destructive }]}>Sign out</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Follow requests */}
        {followRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={[styles.requestsTitle, { color: theme.text }]}>
              Follow requests ({followRequests.length})
            </Text>
            {followRequests.map((req) => (
              <View key={req.id} style={[styles.requestCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.requestName, { color: theme.text }]}>{req.display_name}</Text>
                <View style={styles.requestActions}>
                  <Pressable
                    onPress={() => approveRequest(req.id, req.from_user_id)}
                    style={[styles.requestBtn, { backgroundColor: theme.accent }]}>
                    <Text style={styles.requestBtnText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => denyRequest(req.id)}
                    style={[styles.requestBtn, { borderColor: theme.border, borderWidth: 1 }]}>
                    <Text style={[styles.requestDenyText, { color: theme.textSecondary }]}>Deny</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet</Text>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              Share your first recommendation!
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={fetchProfile}
                tintColor={theme.accent}
              />
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
    paddingHorizontal: Spacing.xl,
    paddingTop: WebNavHeight + Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    ...ContentContainerWeb,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarFallback: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
  },
  editPhotoText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize['2xl'] },
  email: { fontSize: FontSize.sm },
  settingsRow: {
    gap: Spacing.lg,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  privacyInfo: { flex: 1, gap: 2 },
  privacyLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  privacyHint: { fontSize: FontSize.xs, lineHeight: 16 },
  signOutButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  signOutText: { fontSize: FontSize.sm, fontFamily: 'Lora_600SemiBold' },
  postsCount: { fontSize: FontSize.sm },
  bioText: { fontSize: FontSize.sm },
  editProfileText: { fontSize: FontSize.sm, fontWeight: '600' },
  editInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
  },
  editBioInput: { minHeight: 60, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  editActionText: { fontSize: FontSize.sm, fontWeight: '500' },
  saveBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  saveBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  requestsSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  requestsTitle: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  requestName: { flex: 1, fontWeight: '600', fontSize: FontSize.sm },
  requestActions: { flexDirection: 'row', gap: Spacing.md },
  requestBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  requestBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  requestDenyText: { fontSize: FontSize.xs, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyTitle: { fontFamily: 'Lora_500Medium', fontSize: FontSize.lg },
  emptySubtitle: { fontSize: FontSize.base, textAlign: 'center' },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing['2xl'],
    gap: Spacing.md,
    ...ContentContainerWeb,
  },
  postCard: {
    position: 'relative' as const,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  postCategory: { fontSize: 11, letterSpacing: 1.5, fontWeight: '500' },
  postPlaceName: { fontFamily: 'Lora_500Medium', fontSize: FontSize.lg },
  postCaption: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  postDate: { fontSize: FontSize.xs },
  deleteBtn: {
    position: 'absolute' as const,
    top: Spacing.md,
    right: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  deleteBtnText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
});
