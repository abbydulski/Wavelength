import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Only import react-native-maps on native
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
}

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
    <NativeMap places={places} centerLat={centerLat} centerLng={centerLng} onPressPlace={onPressPlace} />
  );
}

function NativeMap({ places, centerLat, centerLng, onPressPlace }: DiscoverMapProps) {
  const theme = useTheme();
  const validPlaces = places.filter((p) => p.lat && p.lng);

  if (!MapView) return null;

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.mapContainer}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: 2.5,
          longitudeDelta: 2.5,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* 100-mile radius */}
        <Circle
          center={{ latitude: centerLat, longitude: centerLng }}
          radius={160934}
          strokeColor="rgba(155,155,155,0.4)"
          strokeWidth={0.75}
          fillColor="rgba(155,155,155,0.03)"
          lineDashPattern={[4, 6]}
        />
        {validPlaces.map((p) => (
          <Marker
            key={p.place_id}
            coordinate={{ latitude: p.lat!, longitude: p.lng! }}
            onPress={() => onPressPlace?.(p.place_id)}
          >
            <View style={[styles.dotMarker, { backgroundColor: ratingColor(p.avg_rating) }]} />
          </Marker>
        ))}
      </MapView>
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

// 100-mile radius
L.circle([${centerLat}, ${centerLng}], {
  radius: 160934,
  color: '#9B9B9B',
  weight: 0.75,
  opacity: 0.4,
  fillColor: '#9B9B9B',
  fillOpacity: 0.03,
  dashArray: '4, 6'
}).addTo(map);

// You are here
L.circleMarker([${centerLat}, ${centerLng}], {
  radius: 5,
  fillColor: '#2C2C2A',
  color: '#fff',
  weight: 2,
  fillOpacity: 1
}).addTo(map).bindPopup('<div style="font-family:Georgia,serif;text-align:center;font-size:12px;color:#2C2C2A;padding:2px;">You are here</div>', {className: 'wl-popup', closeButton: false});

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
  dotMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
