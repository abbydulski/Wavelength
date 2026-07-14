import { Platform, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MapPlace = {
  place_id: string;
  name: string;
  lat?: number;
  lng?: number;
  avg_rating: number;
  category: string;
};

type DiscoverMapProps = {
  places: MapPlace[];
  centerLat: number;
  centerLng: number;
  onPressPlace?: (placeId: string) => void;
};

export function DiscoverMap({ places, centerLat, centerLng, onPressPlace }: DiscoverMapProps) {
  const theme = useTheme();

  if (Platform.OS === 'web') {
    return <WebMap places={places} centerLat={centerLat} centerLng={centerLng} />;
  }

  // Native fallback — placeholder until react-native-maps is added
  return (
    <View style={[styles.fallback, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.fallbackText, { color: theme.textSecondary }]}>
        🗺️ {places.length} places nearby
      </Text>
    </View>
  );
}

function ratingColor(rating: number): string {
  if (rating <= 0) return '#E4E0D7';
  if (rating <= 1.5) return '#D4837A';
  if (rating <= 2.5) return '#D4A07A';
  if (rating <= 3.5) return '#C9B86C';
  if (rating <= 4.5) return '#8DB87A';
  return '#6AAF6A';
}

function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    food: '🍽️', coffee: '☕', drinks: '🍸', dessert: '🍰', outdoors: '🌿',
    shopping: '🛍️', culture: '🎨', nightlife: '🌙', wellness: '💆',
    gym: '💪', fitness: '💪', sports: '⚽', activities: '🎯', travel: '✈️',
  };
  return map[category?.toLowerCase()] || '📍';
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function WebMap({ places, centerLat, centerLng }: { places: MapPlace[]; centerLat: number; centerLng: number }) {
  const markersJs = places
    .filter((p) => p.lat && p.lng)
    .map((p) => {
      const color = ratingColor(p.avg_rating);
      const emoji = categoryEmoji(p.category);
      return `(function(){
        var icon = L.divIcon({
          className: 'wl-marker',
          html: '<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">${emoji}</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20]
        });
        var rating = ${p.avg_rating || 0};
        var dots = '';
        for (var i = 1; i <= 5; i++) {
          dots += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 2px;background:' + (i <= Math.round(rating) ? '${color}' : '#E4E0D7') + ';"></span>';
        }
        var ratingText = rating > 0 ? rating.toFixed(1) : 'New';
        L.marker([${p.lat}, ${p.lng}], {icon: icon}).addTo(map)
          .bindPopup('<div style="font-family:Georgia,serif;text-align:center;padding:6px 4px;min-width:120px;"><b style="font-size:14px;color:#2C2C2A;">${escapeHtml(p.name)}</b><br><div style="margin:4px 0;">' + dots + '</div><span style="color:#6E6B63;font-size:11px;">${p.category || 'Place'} · ' + ratingText + '</span></div>', {className: 'wl-popup'});
      })();`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;}
  .wl-marker{background:none!important;border:none!important;}
  .wl-popup .leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.12);border:1px solid #E4E0D7;}
  .wl-popup .leaflet-popup-tip{border-top-color:#fff;}
  .leaflet-control-attribution{font-size:9px!important;opacity:0.6;}
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map', {zoomControl: false}).setView([${centerLat}, ${centerLng}], 9);
L.control.zoom({position: 'bottomright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  maxZoom: 19,
  subdomains: 'abcd'
}).addTo(map);

// 100-mile radius circle (160934 meters)
L.circle([${centerLat}, ${centerLng}], {
  radius: 160934,
  color: '#4A5E3B',
  weight: 1.5,
  opacity: 0.5,
  fillColor: '#4A5E3B',
  fillOpacity: 0.04,
  dashArray: '6, 6'
}).addTo(map);

// "You are here" marker
L.circleMarker([${centerLat}, ${centerLng}], {
  radius: 6,
  fillColor: '#4A5E3B',
  color: '#fff',
  weight: 2,
  fillOpacity: 1
}).addTo(map).bindPopup('<div style="font-family:Georgia,serif;text-align:center;font-size:13px;color:#2C2C2A;"><b>You are here</b><br><span style="color:#6E6B63;font-size:11px;">100-mile radius</span></div>');

${markersJs}
</script>
</body></html>`;

  return (
    <View style={styles.mapContainer}>
      <iframe
        srcDoc={html}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: BorderRadius.lg,
        }}
        title="Discover Map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 420,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  fallback: {
    height: 200,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  fallbackText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
});
