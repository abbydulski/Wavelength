import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

import { CATEGORIES } from '@/components/category-picker';
import { DiscoverMap } from '@/components/discover-map';
import { ThemedView } from '@/components/themed-view';
import { FontSize, Spacing, WebNavHeight } from '@/constants/theme';
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
  const [selectedCategory, setSelectedCategory] = useState('');

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

  return (
    <ThemedView style={styles.container}>
      {/* Floating header */}
      <View style={[styles.floatingHeader, { paddingTop: WebNavHeight + Spacing.lg, backgroundColor: theme.background + 'E6' }]}>
        <Text style={[styles.title, { color: theme.text }]}>Discover</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {FILTER_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedCategory(cat.key)}>
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? theme.text : theme.textTertiary,
                      borderBottomColor: isActive ? theme.text : 'transparent',
                    },
                  ]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Full-page map */}
      {loading || locationLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : filteredPlaces.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No places yet</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            {selectedCategory ? 'Nothing in this category nearby.' : 'Be the first to rate a place.'}
          </Text>
        </View>
      ) : userLocation ? (
        <DiscoverMap
          places={filteredPlaces}
          centerLat={userLocation.latitude}
          centerLng={userLocation.longitude}
          onPressPlace={(id) => router.push(`/place/${id}`)}
        />
      ) : null}

      {/* Place count */}
      {!loading && filteredPlaces.length > 0 && (
        <View style={[styles.countBadge, { backgroundColor: theme.background }]}>
          <Text style={[styles.countText, { color: theme.textTertiary }]}>
            {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'}
          </Text>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.xl,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    gap: Spacing.lg,
    paddingRight: Spacing.xl,
  },
  filterText: {
    fontFamily: 'Lora_500Medium',
    fontSize: 12,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: FontSize.lg,
  },
  emptyBody: {
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
    fontSize: FontSize.sm,
  },
  countBadge: {
    position: 'absolute',
    bottom: Spacing['3xl'] + Spacing['3xl'],
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    opacity: 0.85,
  },
  countText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 11,
  },
});
