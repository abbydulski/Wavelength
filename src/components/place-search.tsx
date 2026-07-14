import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';

import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PlaceResult = {
  placeId: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
};

type PlaceSearchProps = {
  onSelect: (place: PlaceResult) => void;
  selectedPlace: PlaceResult | null;
  onClear: () => void;
};

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

async function fetchPlaceDetails(place: PlaceResult): Promise<PlaceResult> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${place.placeId}?fields=location`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        },
      }
    );
    const data = await res.json();
    if (data.location) {
      return { ...place, lat: data.location.latitude, lng: data.location.longitude };
    }
  } catch {
    // Fall back to place without coords
  }
  return place;
}

export function PlaceSearch({ onSelect, selectedPlace, onClear }: PlaceSearchProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.length < 3) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(
            'https://places.googleapis.com/v1/places:autocomplete',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
              },
              body: JSON.stringify({
                input: text,
                includedPrimaryTypes: ['establishment'],
              }),
            }
          );
          const data = await res.json();
          if (data.suggestions) {
            setResults(
              data.suggestions
                .filter((s: any) => s.placePrediction)
                .map((s: any) => ({
                  placeId: s.placePrediction.placeId,
                  name: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text?.text ?? '',
                  address: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
                }))
            );
          }
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 400);
    },
    []
  );

  if (selectedPlace) {
    return (
      <View style={[styles.selectedContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.selectedInfo}>
          <Text style={[styles.selectedName, { color: theme.text }]}>{selectedPlace.name}</Text>
          <Text style={[styles.selectedAddress, { color: theme.textSecondary }]}>{selectedPlace.address}</Text>
        </View>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={[styles.clearButton, { color: theme.destructive }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Search for a place..."
          placeholderTextColor={theme.textTertiary}
          value={query}
          onChangeText={search}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={theme.accent} />}
      </View>
      {results.length > 0 && (
        <View style={[styles.resultsList, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {results.map((item) => (
            <Pressable
              key={item.placeId}
              style={({ pressed }) => [styles.resultItem, pressed && { backgroundColor: theme.backgroundElement }]}
              onPress={() => {
                // Fetch place details to get coordinates
              fetchPlaceDetails(item).then((enriched) => {
                onSelect(enriched);
              });
                setQuery('');
                setResults([]);
              }}>
              <Text style={[styles.resultName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.resultAddress, { color: theme.textSecondary }]}>{item.address}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  input: { flex: 1, fontSize: FontSize.base },
  resultsList: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
    maxHeight: 240,
    overflow: 'hidden',
  },
  resultItem: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  resultName: { fontSize: FontSize.base, fontFamily: 'Lora_500Medium' },
  resultAddress: { fontSize: FontSize.sm, marginTop: 2 },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  selectedInfo: { flex: 1 },
  selectedName: { fontFamily: 'Lora_500Medium', fontSize: FontSize.base },
  selectedAddress: { fontSize: FontSize.sm, marginTop: 2 },
  clearButton: { fontSize: FontSize.sm, fontFamily: 'Lora_600SemiBold' },
});
