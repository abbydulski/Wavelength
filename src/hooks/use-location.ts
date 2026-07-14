import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

type UserLocation = {
  latitude: number;
  longitude: number;
};

// Fallback when location is unavailable (San Francisco)
const FALLBACK: UserLocation = { latitude: 37.7749, longitude: -122.4194 };

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setLocation(FALLBACK);
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (err) {
      setError('Could not get location');
      setLocation(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { location, loading, error, refresh: requestLocation };
}
