import { CrossImage as Image } from '@/components/cross-image';
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
import { BottomTabInset, ContentContainerWeb, FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { convertHeicOnWeb } from '@/lib/heic';
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
  const { user, signOut, deleteAccount } = useAuth();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followRequests, setFollowRequests] = useState<{ id: string; from_user_id: string; display_name: string }[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const performDeleteAccount = useCallback(async () => {
    setDeletingAccount(true);
    const { error: delError } = await deleteAccount();
    if (delError) {
      setDeletingAccount(false);
      const msg = 'Could not delete your account. Please try again.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Deletion failed', msg);
    }
    // On success the auth listener clears the session and routes to auth.
  }, [deleteAccount]);

  const confirmDeleteAccount = useCallback(() => {
    import('@/lib/haptics').then((h) => h.hapticWarning());
    const message =
      'This permanently deletes your account and all your recommendations, follows, and requests. This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) performDeleteAccount();
    } else {
      Alert.alert('Delete account', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDeleteAccount },
      ]);
    }
  }, [performDeleteAccount]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, postsRes, requestsRes, followersRes, followingRes] = await Promise.all([
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
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
      ]);
      if (profileRes.data) {
        setDisplayName(profileRes.data.display_name ?? '');
        setBio((profileRes.data as any).bio ?? '');
        setPhotoUrl(profileRes.data.photo_url ?? null);
        setIsPrivate((profileRes.data as any).is_private ?? false);
      }
      setPosts((postsRes.data as unknown as UserPost[]) ?? []);
      setFollowerCount(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);
      setFollowRequests(
        (requestsRes.data ?? []).map((r: any) => ({
          id: r.id,
          from_user_id: r.from_user_id,
          display_name: r.users?.display_name ?? 'Someone',
        }))
      );
      setError(false);
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  const pickProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets[0] || !user) return;

    setUploadingPhoto(true);
    try {
      // On web, convert HEIC/HEIF to JPEG so browser can display and upload it
      const asset = await convertHeicOnWeb(result.assets[0]);
      // Determine content type from mimeType (reliable) or URI extension (fallback)
      const mime = asset.mimeType?.toLowerCase();
      let contentType = 'image/jpeg';
      let ext = 'jpg';
      if (mime === 'image/png') { contentType = 'image/png'; ext = 'png'; }
      else if (mime === 'image/webp') { contentType = 'image/webp'; ext = 'webp'; }
      else if (mime === 'image/heic' || mime === 'image/heif') { contentType = 'image/jpeg'; ext = 'jpg'; }
      else if (!mime) {
        const uriExt = (asset.uri.split('.').pop() ?? '').toLowerCase();
        if (uriExt === 'png') { contentType = 'image/png'; ext = 'png'; }
      }
      const filePath = `${user.id}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType });

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
    <View style={[styles.postCard, { borderBottomColor: theme.border }]}>
      <View style={styles.postTop}>
        <View style={{ flex: 1, gap: Spacing.xs }}>
          <Text style={[styles.postCategory, { color: theme.textTertiary }]}>
            {item.category?.toUpperCase() || 'PLACE'}
          </Text>
          <Text style={[styles.postPlaceName, { color: theme.text }]}>
            {item.places?.name ?? 'Unknown place'}
          </Text>
        </View>
        <Pressable
          onPress={() => deletePost(item.id)}
          hitSlop={8}>
          <Text style={[styles.deleteBtnText, { color: theme.textTertiary }]}>×</Text>
        </Pressable>
      </View>
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
                    style={[styles.editInput, { color: theme.text, borderBottomColor: theme.border }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Display name"
                    placeholderTextColor={theme.textTertiary}
                    autoFocus
                  />
                  <TextInput
                    style={[styles.editInput, styles.editBioInput, { color: theme.text, borderBottomColor: theme.border }]}
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Add a bio..."
                    placeholderTextColor={theme.textTertiary}
                    multiline
                  />
                  <View style={styles.editActions}>
                    <Pressable onPress={() => setEditing(false)}>
                      <Text style={[styles.editActionText, { color: theme.textTertiary }]}>cancel</Text>
                    </Pressable>
                    <Text style={{ color: theme.border }}>·</Text>
                    <Pressable onPress={saveProfile} disabled={saving}>
                      <Text style={[styles.editActionText, { color: theme.accent }]}>
                        {saving ? 'saving...' : 'save'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.title, { color: theme.text }]}>
                    {displayName || user?.email?.split('@')[0] || 'You'}
                  </Text>
                  {bio ? (
                    <Text style={[styles.bioText, { color: theme.textSecondary }]}>
                      {bio}
                    </Text>
                  ) : null}
                  <Text style={[styles.statsText, { color: theme.textSecondary }]}>
                    {posts.length} {posts.length === 1 ? 'rec' : 'recs'} · {followerCount} {followerCount === 1 ? 'follower' : 'followers'} · {followingCount} following
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
              <View style={[styles.privacyRow, { borderBottomColor: theme.border }]}>
                <View style={styles.privacyInfo}>
                  <Text style={[styles.privacyLabel, { color: theme.text }]}>Private account</Text>
                  <Text style={[styles.privacyHint, { color: theme.textTertiary }]}>
                    Posts hidden from non-followers
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
              <Pressable onPress={signOut}>
                <Text style={[styles.signOutText, { color: theme.textTertiary }]}>Sign out</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteAccount}
                disabled={deletingAccount}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed || deletingAccount ? 0.6 : 1 })}>
                <Text style={[styles.deleteAccountText, { color: theme.destructive }]}>
                  {deletingAccount ? 'Deleting account…' : 'Delete account'}
                </Text>
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
              <View key={req.id} style={[styles.requestCard, { borderBottomColor: theme.border }]}>
                <Text style={[styles.requestName, { color: theme.text }]}>{req.display_name}</Text>
                <View style={styles.requestActions}>
                  <Pressable onPress={() => approveRequest(req.id, req.from_user_id)}>
                    <Text style={[styles.requestAcceptText, { color: theme.accent }]}>Accept</Text>
                  </Pressable>
                  <Text style={{ color: theme.border }}>·</Text>
                  <Pressable onPress={() => denyRequest(req.id)}>
                    <Text style={[styles.requestDenyText, { color: theme.textTertiary }]}>Deny</Text>
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
        ) : error && posts.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Couldn&apos;t load your profile</Text>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              Check your connection and try again.
            </ThemedText>
            <Pressable onPress={onRefresh}>
              <Text style={[styles.retryText, { color: theme.accent }]}>Retry →</Text>
            </Pressable>
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
                refreshing={refreshing}
                onRefresh={onRefresh}
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
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  privacyInfo: { flex: 1, gap: 2 },
  privacyLabel: { fontFamily: 'Lora_500Medium', fontSize: FontSize.sm },
  privacyHint: { fontSize: 11, lineHeight: 16 },
  signOutText: { fontSize: FontSize.sm, fontFamily: 'Lora_400Regular', marginTop: Spacing.sm },
  deleteAccountText: { fontSize: FontSize.sm, fontFamily: 'Lora_400Regular', marginTop: Spacing.lg },
  statsText: { fontSize: FontSize.sm },
  bioText: { fontSize: FontSize.sm },
  editProfileText: { fontSize: FontSize.sm, fontWeight: '600' },
  editInput: {
    fontFamily: 'Lora_400Regular',
    fontSize: FontSize.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xs,
  },
  editBioInput: { minHeight: 50, textAlignVertical: 'top' as const },
  editActions: { flexDirection: 'row' as const, gap: Spacing.sm, alignItems: 'center' as const, marginTop: Spacing.xs },
  editActionText: { fontFamily: 'Lora_400Regular', fontSize: 12 },
  requestsSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  requestsTitle: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize.sm },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  requestName: { flex: 1, fontFamily: 'Lora_500Medium', fontSize: FontSize.sm },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  requestAcceptText: { fontFamily: 'Lora_500Medium', fontSize: 12 },
  requestDenyText: { fontSize: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyTitle: { fontFamily: 'Lora_500Medium', fontSize: FontSize.lg },
  emptySubtitle: { fontSize: FontSize.base, textAlign: 'center' },
  retryText: { fontFamily: 'Lora_500Medium', fontSize: FontSize.sm, marginTop: Spacing.sm },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing['2xl'],
    gap: Spacing.md,
    ...ContentContainerWeb,
  },
  postCard: {
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  postCategory: { fontSize: 10, letterSpacing: 1.8, fontWeight: '500' },
  postPlaceName: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize.base },
  postCaption: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  postDate: { fontSize: FontSize.xs },
  deleteBtnText: {
    fontSize: 18,
    lineHeight: 20,
  },
});
