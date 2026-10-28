import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

export interface NativeInteractiveMapProps {
  targetLat: number;
  targetLng: number;
  mapZoom: number;
  activeLocality: string;
  records: any[];
  onSelectLocation: (lat: number, lng: number) => void;
  style?: any;
  apiKey?: string;
}

export const NativeInteractiveMap: React.FC<NativeInteractiveMapProps> = ({
  targetLat,
  targetLng,
  mapZoom,
  activeLocality,
  records,
  onSelectLocation,
  style,
  apiKey,
}) => {
  const webViewRef = useRef<any>(null);
  const WebViewComponent: any = WebView;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isInternalUpdateRef = useRef(false);

  const effectiveKey = apiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Sync coordinates into the WebView without reloading the page
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (webViewRef.current && !isLoading && !hasError) {
      const js = `if (window.updatePosition) { window.updatePosition(${targetLat}, ${targetLng}, ${mapZoom}); } true;`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [targetLat, targetLng, mapZoom, isLoading, hasError]);

  // Sync records markers into the WebView
  useEffect(() => {
    if (webViewRef.current && !isLoading && !hasError) {
      const simplifiedRecords = records.map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        sourceCategory: r.sourceCategory,
      }));
      const js = `if (window.updateRecords) { window.updateRecords(${JSON.stringify(simplifiedRecords)}); } true;`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [records, isLoading, hasError]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && data.type === 'LOCATION_SELECTED') {
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);

        // Coordinate integrity check
        if (!isNaN(lat) && !isNaN(lng) && lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0) {
          isInternalUpdateRef.current = true;
          onSelectLocation(lat, lng);
        }
      }
    } catch (err) {
      console.warn('Native map message parsing error:', err);
    }
  };

  const simplifiedInitialRecords = records.map((r) => ({
    id: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    sourceCategory: r.sourceCategory,
  }));

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #f8fafc; font-family: -apple-system, Roboto, sans-serif; }
    #map { width: 100%; height: 100%; }
    .target-pin {
      background: #240046;
      color: #ffffff;
      border: 2px solid #D4AF37;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 10px;
      box-shadow: 0 2px 6px rgba(36,0,70,0.45);
    }
    .leaflet-control-attribution { font-size: 8px !important; }
    .mode-bar {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 6px;
      padding: 3px;
      display: flex;
      gap: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .mode-btn {
      border: none;
      background: transparent;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: #334155;
    }
    .mode-btn.active {
      background: #240046;
      color: #ffffff;
    }
  </style>
  ${effectiveKey ? `<script src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(effectiveKey)}&libraries=places,geometry"></script>` : ''}
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var isGoogleActive = false;
    var gMap, gMarker, gCircle, gRecordMarkers = [];
    var lMap, lMarker, lCircle, lRecordLayer;

    function postLocation(lat, lng) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'LOCATION_SELECTED',
          latitude: lat,
          longitude: lng
        }));
      }
    }

    // Try Google Maps first if script loaded
    if (window.google && window.google.maps) {
      try {
        isGoogleActive = true;
        var centerPos = { lat: ${targetLat}, lng: ${targetLng} };
        gMap = new google.maps.Map(document.getElementById('map'), {
          center: centerPos,
          zoom: ${mapZoom},
          mapTypeId: 'roadmap',
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: true,
          gestureHandling: 'cooperative'
        });

        gMarker = new google.maps.Marker({
          position: centerPos,
          map: gMap,
          draggable: true,
          title: "Target: ${activeLocality}",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#240046',
            fillOpacity: 1,
            strokeColor: '#D4AF37',
            strokeWeight: 3
          }
        });

        gCircle = new google.maps.Circle({
          map: gMap,
          center: centerPos,
          radius: 1000,
          fillColor: '#D4AF37',
          fillOpacity: 0.12,
          strokeColor: '#D4AF37',
          strokeOpacity: 0.85,
          strokeWeight: 2
        });

        gMarker.addListener('dragend', function(e) {
          var lat = Math.round(e.latLng.lat() * 10000) / 10000;
          var lng = Math.round(e.latLng.lng() * 10000) / 10000;
          gCircle.setCenter({ lat: lat, lng: lng });
          postLocation(lat, lng);
        });

        gMap.addListener('click', function(e) {
          var lat = Math.round(e.latLng.lat() * 10000) / 10000;
          var lng = Math.round(e.latLng.lng() * 10000) / 10000;
          gMarker.setPosition({ lat: lat, lng: lng });
          gCircle.setCenter({ lat: lat, lng: lng });
          postLocation(lat, lng);
        });

        window.updatePosition = function(lat, lng, zoom) {
          var p = { lat: lat, lng: lng };
          if (gMarker) gMarker.setPosition(p);
          if (gCircle) gCircle.setCenter(p);
          if (gMap) gMap.setCenter(p);
        };

        window.updateRecords = function(recs) {
          gRecordMarkers.forEach(function(m) { m.setMap(null); });
          gRecordMarkers = [];
          if (!recs) return;

          recs.forEach(function(r) {
            var dotColor = '#16a34a';
            if (r.sourceCategory === 'GovernmentGuideline') dotColor = '#2563eb';
            else if (r.sourceCategory === 'AdvertisedAskingPrice') dotColor = '#ea580c';

            var m = new google.maps.Marker({
              position: { lat: r.latitude, lng: r.longitude },
              map: gMap,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: dotColor,
                fillOpacity: 0.9,
                strokeColor: '#FFFFFF',
                strokeWeight: 1.5
              }
            });
            gRecordMarkers.push(m);
          });
        };

        window.updateRecords(${JSON.stringify(simplifiedInitialRecords)});
      } catch (err) {
        console.warn('Google Maps native init failed; falling back to Leaflet', err);
        isGoogleActive = false;
      }
    }

    // Leaflet Fallback
    if (!isGoogleActive && window.L) {
      lMap = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([${targetLat}, ${targetLng}], ${mapZoom});

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap & Greenart',
        maxZoom: 19
      }).addTo(lMap);

      var pinIcon = L.divIcon({
        className: 'target-pin-wrap',
        html: '<div class="target-pin">PIN</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      lMarker = L.marker([${targetLat}, ${targetLng}], { icon: pinIcon, draggable: true }).addTo(lMap);

      lMarker.on('dragend', function(e) {
        var pos = e.target.getLatLng();
        var lat = Math.round(pos.lat * 10000) / 10000;
        var lng = Math.round(pos.lng * 10000) / 10000;
        if (lCircle) lCircle.setLatLng([lat, lng]);
        postLocation(lat, lng);
      });

      lCircle = L.circle([${targetLat}, ${targetLng}], {
        radius: 1000,
        color: '#D4AF37',
        fillColor: '#D4AF37',
        fillOpacity: 0.12,
        weight: 2
      }).addTo(lMap);

      lRecordLayer = L.layerGroup().addTo(lMap);

      lMap.on('click', function(e) {
        var lat = Math.round(e.latlng.lat * 10000) / 10000;
        var lng = Math.round(e.latlng.lng * 10000) / 10000;
        window.updatePosition(lat, lng, lMap.getZoom());
        postLocation(lat, lng);
      });

      window.updatePosition = function(lat, lng, zoom) {
        if (lMarker) lMarker.setLatLng([lat, lng]);
        if (lCircle) lCircle.setLatLng([lat, lng]);
        if (lMap) lMap.setView([lat, lng], zoom || lMap.getZoom());
      };

      window.updateRecords = function(recs) {
        if (!lRecordLayer) return;
        lRecordLayer.clearLayers();
        if (!recs) return;

        recs.forEach(function(r) {
          var dotColor = '#16a34a';
          if (r.sourceCategory === 'GovernmentGuideline') dotColor = '#2563eb';
          else if (r.sourceCategory === 'AdvertisedAskingPrice') dotColor = '#ea580c';

          var icon = L.divIcon({
            className: 'rec-icon',
            html: '<div style="background:' + dotColor + ';border:1.5px solid #ffffff;border-radius:50%;width:10px;height:10px;box-shadow:0 1px 3px rgba(0,0,0,0.25);"></div>',
            iconSize: [10, 10],
            iconAnchor: [5, 5]
          });

          L.marker([r.latitude, r.longitude], { icon: icon }).addTo(lRecordLayer);
        });
      };

      window.updateRecords(${JSON.stringify(simplifiedInitialRecords)});
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, style]}>
      {hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load interactive map tiles.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryBtnText}>Retry Map</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebViewComponent
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          nestedScrollEnabled={true}
          overScrollMode="never"
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      )}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#240046" />
          <Text style={styles.loadingText}>Loading Map Engine...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 280,
    backgroundColor: '#FAF5FF',
    position: 'relative',
    overflow: 'hidden',
  },
  webview: {
    width: '100%',
    height: 280,
    backgroundColor: '#FAF5FF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 245, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    color: '#240046',
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#240046',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
