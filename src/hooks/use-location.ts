import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

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
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);
    try {
      // Ask only if we don't already have permission — avoids re-prompting.
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted' && perm.canAskAgain) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.status !== 'granted') {
        setPermissionDenied(true);
        setError(
          perm.canAskAgain
            ? 'Location permission is needed to show nearby recommendations.'
            : 'Location is off. Enable it for Wavelength in Settings to see nearby recommendations.'
        );
        setLocation(FALLBACK);
        setLoading(false);
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        setError('Location services are turned off. Turn them on to see nearby recommendations.');
        setLocation(FALLBACK);
        setLoading(false);
        return;
      }

      // Fast first fix from cache, then refine with a fresh reading.
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        setLoading(false);
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setError('Could not get your location. Showing a default area.');
      setLocation((prev) => prev ?? FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { location, loading, error, permissionDenied, refresh: requestLocation, openSettings };
}
