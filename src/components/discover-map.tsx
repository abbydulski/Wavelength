import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing } from '@/constants/theme';
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
    return <WebMap places={places} centerLat={centerLat} centerLng={centerLng} onPressPlace={onPressPlace} />;
  }

  return (
    <View style={[styles.fallback, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.fallbackText, { color: theme.textSecondary }]}>
        {places.length} places nearby
      </Text>
    </View>
  );
}

function ratingColor(rating: number): string {
  if (rating <= 0) return '#B0ADA6';
  if (rating <= 1.5) return '#C4837A';
  if (rating <= 2.5) return '#C4A07A';
  if (rating <= 3.5) return '#B9A86C';
  if (rating <= 4.5) return '#7DA87A';
  return '#5A9F5A';
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function WebMap({ places, centerLat, centerLng, onPressPlace }: { places: MapPlace[]; centerLat: number; centerLng: number; onPressPlace?: (placeId: string) => void }) {
  const markersJs = places
    .filter((p) => p.lat && p.lng)
    .map((p) => {
      const color = ratingColor(p.avg_rating);
      const size = 10;
      return `(function(){
        var icon = L.divIcon({
          className: 'wl-marker',
          html: '<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);cursor:pointer;"></div>',
          iconSize: [${size}, ${size}],
          iconAnchor: [${size / 2}, ${size / 2}],
          popupAnchor: [0, -${size / 2 + 2}]
        });
        var rating = ${p.avg_rating || 0};
        var ratingText = rating > 0 ? rating.toFixed(1) : '';
        var ratingLine = ratingText ? '<span style="color:${color};font-size:12px;font-style:italic;">' + ratingText + '</span><br>' : '';
        L.marker([${p.lat}, ${p.lng}], {icon: icon}).addTo(map)
          .bindPopup('<div style="font-family:Georgia,Lora,serif;text-align:left;padding:4px 2px;min-width:100px;cursor:pointer;" onclick="window.parent.postMessage({type:\\'wl-place-tap\\',placeId:\\'${p.place_id}\\'},\\'*\\')"><div style="font-size:13px;font-weight:600;color:#2C2C2A;line-height:1.3;margin-bottom:3px;">${escapeHtml(p.name)}</div>' + ratingLine + '<span style="font-size:10px;letter-spacing:0.5px;color:#9B9B9B;text-transform:uppercase;">${p.category || ''}</span></div>', {className: 'wl-popup', closeButton: false});
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
  .wl-popup .leaflet-popup-content-wrapper{border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);border:none;padding:2px;}
  .wl-popup .leaflet-popup-tip{border-top-color:#fff;}
  .leaflet-popup-content{margin:8px 10px;}
  .leaflet-control-attribution{font-size:9px!important;opacity:0.4;}
  .leaflet-control-zoom a{width:28px!important;height:28px!important;line-height:28px!important;font-size:14px!important;color:#6B6B6B!important;border-color:#E4E0D7!important;}
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map', {zoomControl: false}).setView([${centerLat}, ${centerLng}], 10);
L.control.zoom({position: 'bottomright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  maxZoom: 19,
  subdomains: 'abcd'
}).addTo(map);

// You are here — subtle pulse dot
L.circleMarker([${centerLat}, ${centerLng}], {
  radius: 4,
  fillColor: '#2C2C2A',
  color: '#fff',
  weight: 1.5,
  fillOpacity: 0.9
}).addTo(map);

${markersJs}
</script>
</body></html>`;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'wl-place-tap' && e.data.placeId && onPressPlace) {
        onPressPlace(e.data.placeId);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPressPlace]);

  return (
    <View style={styles.mapContainer}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title="Discover Map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  fallbackText: {
    fontSize: FontSize.base,
    fontFamily: 'Lora_400Regular_Italic',
    fontStyle: 'italic',
  },
});
