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
}

export const NativeInteractiveMap: React.FC<NativeInteractiveMapProps> = ({
  targetLat,
  targetLng,
  mapZoom,
  activeLocality,
  records,
  onSelectLocation,
  style,
}) => {
  const webViewRef = useRef<any>(null);
  const WebViewComponent: any = WebView;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isInternalUpdateRef = useRef(false);

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
      border: 2px solid #d4af37;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 10px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .leaflet-control-attribution { font-size: 8px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map, marker, bufferCircle, recordLayer;

    function initMap() {
      try {
        map = L.map('map', {
          zoomControl: false,
          attributionControl: true
        }).setView([${targetLat}, ${targetLng}], ${mapZoom});

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap & Greenart',
          maxZoom: 19
        }).addTo(map);

        var pinIcon = L.divIcon({
          className: 'target-pin-wrap',
          html: '<div class="target-pin">PIN</div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        marker = L.marker([${targetLat}, ${targetLng}], { icon: pinIcon, draggable: true }).addTo(map);

        marker.on('dragend', function(e) {
          var pos = e.target.getLatLng();
          var lat = Math.round(pos.lat * 10000) / 10000;
          var lng = Math.round(pos.lng * 10000) / 10000;
          if (bufferCircle) bufferCircle.setLatLng([lat, lng]);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LOCATION_SELECTED',
              latitude: lat,
              longitude: lng
            }));
          }
        });

        bufferCircle = L.circle([${targetLat}, ${targetLng}], {
          radius: 1000,
          color: '#d4af37',
          fillColor: '#d4af37',
          fillOpacity: 0.12,
          weight: 2
        }).addTo(map);

        recordLayer = L.layerGroup().addTo(map);
        window.updateRecords(${JSON.stringify(simplifiedInitialRecords)});

        map.on('click', function(e) {
          var lat = Math.round(e.latlng.lat * 10000) / 10000;
          var lng = Math.round(e.latlng.lng * 10000) / 10000;
          window.updatePosition(lat, lng, map.getZoom());

          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LOCATION_SELECTED',
              latitude: lat,
              longitude: lng
            }));
          }
        });

        setTimeout(function() { map.invalidateSize(); }, 200);
      } catch (err) {
        console.error('Map init error:', err);
      }
    }

    window.updatePosition = function(lat, lng, zoom) {
      if (marker) marker.setLatLng([lat, lng]);
      if (bufferCircle) bufferCircle.setLatLng([lat, lng]);
      if (map) {
        map.setView([lat, lng], zoom || map.getZoom());
      }
    };

    window.updateRecords = function(recs) {
      if (!recordLayer) return;
      recordLayer.clearLayers();
      if (!recs || !recs.length) return;

      recs.forEach(function(r) {
        var dotColor = '#16a34a';
        if (r.sourceCategory === 'GovernmentGuideline') dotColor = '#2563eb';
        else if (r.sourceCategory === 'AdvertisedAskingPrice') dotColor = '#ea580c';
        else if (r.sourceCategory === 'ClientResearch') dotColor = '#7e22ce';

        var icon = L.divIcon({
          className: 'rec-icon',
          html: '<div style="background:' + dotColor + ';border:1.5px solid #ffffff;border-radius:50%;width:10px;height:10px;box-shadow:0 1px 3px rgba(0,0,0,0.25);"></div>',
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });

        L.marker([r.latitude, r.longitude], { icon: icon }).addTo(recordLayer);
      });
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initMap();
    } else {
      document.addEventListener('DOMContentLoaded', initMap);
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
          style={styles.webView}
          onMessage={handleMessage}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
        />
      )}

      {isLoading && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#240046" />
          <Text style={styles.loadingText}>Loading Map...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: '100%',
    backgroundColor: '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#240046',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#240046',
    borderRadius: 4,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
