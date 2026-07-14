import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/components/category-picker';
import { DiscoverMap } from '@/components/discover-map';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WavelengthRating } from '@/components/wavelength-rating';
import { BorderRadius, BottomTabInset, ContentContainerWeb, FontSize, Spacing, WebNavHeight } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type DiscoverPlace = {
  place_id: string;
  google_place_id: string;
  name: string;
  address: string;
  category: string;
  avg_rating: number;
  rating_count: number;
  distance_miles: number;
  lat?: number;
  lng?: number;
};

const FILTER_CATEGORIES = [{ key: '', label: 'All' }, ...CATEGORIES];

export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { location: userLocation, loading: locationLoading } = useLocation();
  const [places, setPlaces] = useState<DiscoverPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');

  const fetchPlaces = useCallback(async () => {
    if (!userLocation) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('discover_nearby_places', {
        p_lat: userLocation.latitude,
        p_lng: userLocation.longitude,
        p_radius_miles: 100,
        p_limit: 50,
      });
      if (error) throw error;
      setPlaces(data ?? []);
    } catch (err) {
      console.error('Discover fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useFocusEffect(
    useCallback(() => {
      if (userLocation) fetchPlaces();
    }, [userLocation, fetchPlaces])
  );

  const filteredPlaces = useMemo(() => {
    if (!selectedCategory) return places;
    return places.filter((p) => p.category === selectedCategory);
  }, [places, selectedCategory]);

  const renderPlace = ({ item }: { item: DiscoverPlace }) => (
    <Pressable
      style={[styles.placeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/place/${item.place_id}`)}>
      <View style={styles.placeTop}>
        <Text style={[styles.placeCategory, { color: theme.rust }]}>
          {item.category?.toUpperCase() || 'PLACE'}
        </Text>
        <Text style={[styles.placeDistance, { color: theme.textTertiary }]}>
          {item.distance_miles.toFixed(1)} mi
        </Text>
      </View>
      <Text style={[styles.placeName, { color: theme.text }]}>{item.name}</Text>
      <Text style={[styles.placeAddress, { color: theme.textSecondary }]} numberOfLines={1}>
        {item.address}
      </Text>
      <View style={styles.placeBottom}>
        <WavelengthRating rating={item.avg_rating} size="sm" />
        <Text style={[styles.ratingCount, { color: theme.textTertiary }]}>
          {item.rating_count} {item.rating_count === 1 ? 'rating' : 'ratings'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>Discover</Text>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Rated places near you
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              style={[styles.viewToggle, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.viewToggleText, { color: theme.text }]}>
                {viewMode === 'list' ? '🗺️ Map' : '📋 List'}
              </Text>
            </Pressable>
          </View>

          {/* Category filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {FILTER_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isActive ? theme.accent : theme.backgroundElement,
                      borderColor: isActive ? theme.accent : theme.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.filterText,
                      { color: isActive ? theme.accentText : theme.textSecondary },
                    ]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading || locationLoading ? (
          <SkeletonList count={4} type="place" />
        ) : filteredPlaces.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No places yet</Text>
            <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
              {selectedCategory ? 'No places in this category nearby.' : 'Be the first to rate a place nearby!'}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredPlaces}
            keyExtractor={(item) => item.place_id}
            renderItem={viewMode === 'list' ? renderPlace : renderPlace}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              viewMode === 'map' && userLocation ? (
                <View style={styles.mapWrapper}>
                  <DiscoverMap
                    places={filteredPlaces}
                    centerLat={userLocation.latitude}
                    centerLng={userLocation.longitude}
                    onPressPlace={(id) => router.push(`/place/${id}`)}
                  />
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await fetchPlaces();
                  setRefreshing(false);
                }}
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
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    ...ContentContainerWeb,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontFamily: 'Lora_600SemiBold', fontSize: FontSize['2xl'] },
  subtitle: { fontSize: FontSize.base },
  viewToggle: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  viewToggleText: { fontSize: FontSize.sm, fontWeight: '600' },
  filterRow: {
    gap: Spacing.md,
  },
  filterPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: FontSize.xs, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyTitle: { fontFamily: 'Lora_500Medium', fontSize: FontSize.lg },
  emptySubtitle: { fontSize: FontSize.base, textAlign: 'center' },
  mapWrapper: {
    marginBottom: Spacing.lg,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: BottomTabInset + Spacing['2xl'],
    gap: Spacing.md,
    ...ContentContainerWeb,
  },
  placeCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  placeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeCategory: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  placeDistance: { fontSize: FontSize.xs },
  placeName: {
    fontFamily: 'Lora_500Medium',
    fontSize: FontSize.xl,
    lineHeight: 28,
  },
  placeAddress: { fontSize: FontSize.sm },
  placeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ratingCount: { fontSize: FontSize.xs },
});
