import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryPicker, type CategoryKey } from '@/components/category-picker';
import { PlaceSearch, type PlaceResult } from '@/components/place-search';
import { RatingPicker } from '@/components/rating-picker';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ContentContainerWeb, FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function CreateScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { location: userLocation } = useLocation();

  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<CategoryKey | ''>('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }
  }, [toast, toastOpacity]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
      exif: false,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets].slice(0, 5));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const useCurrentLocation = async () => {
    if (!userLocation) {
      Alert.alert('Location unavailable', 'Could not determine your current location.');
      return;
    }
    setGettingLocation(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${userLocation.latitude},${userLocation.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
      );
      const data = await res.json();
      const result = data.results?.[0];
      if (result) {
        setPlace({
          placeId: result.place_id,
          name: result.formatted_address?.split(',')[0] ?? 'Current Location',
          address: result.formatted_address ?? '',
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        });
      } else {
        setPlace({
          placeId: `custom-${Date.now()}`,
          name: 'Current Location',
          address: `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`,
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        });
      }
    } catch {
      setPlace({
        placeId: `custom-${Date.now()}`,
        name: 'Current Location',
        address: `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`,
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const canSubmit = place && photos.length > 0 && rating > 0 && category && caption.trim().length > 0;

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setLoading(true);
    try {
      // 1. Upsert place
      const locationValue = place.lat && place.lng
        ? `SRID=4326;POINT(${place.lng} ${place.lat})`
        : `SRID=4326;POINT(0 0)`;

      const { data: placeData, error: placeError } = await supabase
        .from('places')
        .upsert(
          {
            google_place_id: place.placeId,
            name: place.name,
            address: place.address,
            location: locationValue,
            category,
          },
          { onConflict: 'google_place_id' }
        )
        .select('id')
        .single();

      if (placeError) {
        console.error('Place upsert error:', placeError);
        throw placeError;
      }

      // 2. Create post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          place_id: placeData.id,
          caption: caption.trim(),
          rating,
          category,
        })
        .select('id')
        .single();

      if (postError) {
        console.error('Post insert error:', postError);
        throw postError;
      }

      // 3. Upload photos & create post_photos records
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const rawExt = (photo.uri.split('.').pop() ?? 'jpg').toLowerCase();
        const ext = rawExt === 'heic' || rawExt === 'heif' ? 'jpg' : rawExt;
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const filePath = `${user.id}/${postData.id}/${i}.${ext}`;

        const response = await fetch(photo.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('post-photos')
          .upload(filePath, blob, { contentType });

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          throw uploadError;
        }

        const { error: photoRecordError } = await supabase.from('post_photos').insert({
          post_id: postData.id,
          storage_path: filePath,
          display_order: i,
        });

        if (photoRecordError) {
          console.error('Post photo record error:', photoRecordError);
          throw photoRecordError;
        }
      }

      // Reset form
      setPlace(null);
      setPhotos([]);
      setRating(0);
      setCategory('');
      setCaption('');
      import('@/lib/haptics').then(h => h.hapticSuccess());
      setToast('Your recommendation is live.');
    } catch (err: any) {
      console.error('Submit error:', err);
      showAlert('Error', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Header */}
            <Text style={[styles.title, { color: theme.text }]}>Share a place</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Recommend somewhere you love.
            </Text>

            {/* Place search */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>PLACE</Text>
              <PlaceSearch
                selectedPlace={place}
                onSelect={setPlace}
                onClear={() => setPlace(null)}
                onSearchActive={setSearchActive}
              />
              {!place && !searchActive && (
                <Pressable
                  onPress={useCurrentLocation}
                  disabled={gettingLocation}>
                  {gettingLocation ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Text style={[styles.currentLocationText, { color: theme.accent }]}>
                      or use current location →
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            {/* Photos */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>
                PHOTOS {photos.length > 0 ? `${photos.length}/5` : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
                {photos.map((photo, i) => (
                  <View key={i} style={styles.photoWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => removePhoto(i)}>
                      <Text style={[styles.removePhotoText, { color: theme.textTertiary }]}>×</Text>
                    </Pressable>
                  </View>
                ))}
                {photos.length < 5 && (
                  <Pressable
                    style={[styles.addPhotoButton, { borderBottomColor: theme.border }]}
                    onPress={pickImage}>
                    <Text style={[styles.addPhotoPlus, { color: theme.textTertiary }]}>+</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>

            {/* Rating */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>YOUR RATING</Text>
              <RatingPicker value={rating} onChange={setRating} />
            </View>

            {/* Category */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>CATEGORY</Text>
              <CategoryPicker value={category} onChange={setCategory} />
            </View>

            {/* Caption */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>YOUR NOTE</Text>
              <TextInput
                style={[styles.captionInput, {
                  color: theme.text,
                  borderBottomColor: theme.border,
                }]}
                placeholder="What makes this place special?"
                placeholderTextColor={theme.textTertiary}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: theme.textTertiary }]}>
                {caption.length}/500
              </Text>
            </View>

            {/* Submit */}
            <Pressable
              style={[styles.submitButton, {
                opacity: loading ? 0.6 : 1,
                borderBottomColor: canSubmit ? theme.accent : theme.border,
              }]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}>
              <Text style={[styles.submitText, {
                color: canSubmit ? theme.accent : theme.textTertiary,
              }]}>
                {loading ? 'Posting...' : 'Share recommendation →'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Inline toast */}
      {toast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity, backgroundColor: theme.accent }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: WebNavHeight + Spacing.xl,
    paddingBottom: BottomTabInset + Spacing['3xl'],
    gap: Spacing.xl,
    ...ContentContainerWeb,
  },
  title: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize['2xl'] },
  subtitle: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
    marginTop: -Spacing.lg,
  },
  section: { gap: Spacing.md },
  sectionLabel: { fontSize: 10, letterSpacing: 1.8, fontWeight: '500' },
  currentLocationText: {
    fontFamily: 'Lora_500Medium',
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  photosRow: { gap: Spacing.md, alignItems: 'flex-end' },
  photoWrapper: { position: 'relative' },
  photoThumb: { width: 72, height: 72, borderRadius: 4 },
  removePhoto: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: { fontSize: 16, lineHeight: 18 },
  addPhotoButton: {
    width: 72,
    height: 72,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoPlus: { fontSize: 24, lineHeight: 28 },
  captionInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    fontSize: FontSize.base,
    minHeight: 80,
    fontFamily: 'Lora_400Regular',
  },
  charCount: { fontSize: FontSize.xs, textAlign: 'right' },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    alignItems: 'flex-start',
    marginTop: Spacing.md,
  },
  submitText: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.base,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 20,
  },
  toastText: {
    color: '#fff',
    fontFamily: 'Lora_500Medium',
    fontSize: 13,
  },
});
