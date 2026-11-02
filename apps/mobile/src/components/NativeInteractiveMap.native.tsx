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
  userLocation?: { latitude: number; longitude: number } | null;
  height?: number;
}

const DEFAULT_GOOGLE_MAPS_KEY = 'AIzaSyB8mXEv9un7VEaew89x8VFO5qDAdK1CrW4';

export const NativeInteractiveMap: React.FC<NativeInteractiveMapProps> = ({
  targetLat,
  targetLng,
  mapZoom,
  activeLocality,
  records,
  onSelectLocation,
  style,
  apiKey,
  userLocation,
  height = 420,
}) => {
  const webViewRef = useRef<any>(null);
  const WebViewComponent: any = WebView;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isMapInteractive, setIsMapInteractive] = useState(true);
  const isInternalUpdateRef = useRef(false);

  const effectiveKey = apiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || DEFAULT_GOOGLE_MAPS_KEY;
  const mapHeight = style?.height || height || 420;

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
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    #map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }

    /* Top Left: Engine Indicator Pill */
    .engine-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(212, 175, 55, 0.4);
      border-radius: 20px;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      font-size: 11px;
      font-weight: 700;
      color: #240046;
      pointer-events: none;
    }
    .engine-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
    }

    /* Top Right: Map Type Toggle Bar */
    .mode-bar {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(212, 175, 55, 0.35);
      border-radius: 20px;
      padding: 3px;
      display: flex;
      gap: 3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.14);
    }
    .mode-btn {
      border: none;
      background: transparent;
      padding: 5px 10px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .mode-btn.active {
      background: #240046;
      color: #FFFFFF;
      box-shadow: 0 1px 3px rgba(36, 0, 70, 0.3);
    }

    /* Luxury Pin for Leaflet Fallback */
    .target-pin-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .luxury-target-pin {
      position: relative;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-ring-pulse {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(212, 175, 55, 0.35);
      animation: pulseAura 2s infinite ease-out;
    }
    .pin-core-disc {
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #240046;
      border: 2.5px solid #D4AF37;
      box-shadow: 0 2px 6px rgba(36, 0, 70, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-inner-white {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #FFFFFF;
    }
    @keyframes pulseAura {
      0% { transform: scale(0.85); opacity: 0.8; }
      50% { transform: scale(1.25); opacity: 0.25; }
      100% { transform: scale(0.85); opacity: 0.8; }
    }

    .leaflet-control-attribution {
      font-size: 8px !important;
      background: rgba(255,255,255,0.75) !important;
      padding: 1px 5px !important;
    }
  </style>

  ${effectiveKey ? `<script src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(effectiveKey)}&libraries=places,geometry"></script>` : ''}
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</head>
<body>
  <div id="map"></div>

  <!-- Top-Left Engine Indicator -->
  <div id="engine-badge" class="engine-badge">
    <span class="engine-dot" id="engine-dot"></span>
    <span id="engine-text">Google Maps</span>
  </div>

  <!-- Top-Right Mode Bar -->
  <div class="mode-bar">
    <button id="btn-road" class="mode-btn active" onclick="switchMapType('roadmap')">Road</button>
    <button id="btn-hybrid" class="mode-btn" onclick="switchMapType('hybrid')">Hybrid</button>
    <button id="btn-sat" class="mode-btn" onclick="switchMapType('satellite')">Satellite</button>
  </div>

  <script>
    var isGoogleActive = false;
    var gMap, gMarker, gCircle, gRecordMarkers = [];
    var lMap, lMarker, lCircle, lRecordLayer, lStreetLayer, lSatLayer;
    var currentMapType = 'roadmap';

    function postLocation(lat, lng) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'LOCATION_SELECTED',
          latitude: lat,
          longitude: lng
        }));
      }
    }

    function updateModeButtons(type) {
      currentMapType = type;
      var buttons = document.querySelectorAll('.mode-btn');
      buttons.forEach(function(b) { b.classList.remove('active'); });
      var targetId = type === 'roadmap' ? 'btn-road' : type === 'hybrid' ? 'btn-hybrid' : 'btn-sat';
      var el = document.getElementById(targetId);
      if (el) el.classList.add('active');
    }

    function switchMapType(type) {
      updateModeButtons(type);
      if (isGoogleActive && gMap) {
        gMap.setMapTypeId(type);
      } else if (lMap) {
        if (type === 'roadmap') {
          if (lSatLayer && lMap.hasLayer(lSatLayer)) lMap.removeLayer(lSatLayer);
          if (lStreetLayer && !lMap.hasLayer(lStreetLayer)) lMap.addLayer(lStreetLayer);
        } else {
          if (lStreetLayer && lMap.hasLayer(lStreetLayer)) lMap.removeLayer(lStreetLayer);
          if (lSatLayer && !lMap.hasLayer(lSatLayer)) lMap.addLayer(lSatLayer);
        }
      }
    }

    function initGoogleMaps() {
      try {
        var centerPos = { lat: ${targetLat}, lng: ${targetLng} };
        gMap = new google.maps.Map(document.getElementById('map'), {
          center: centerPos,
          zoom: ${mapZoom},
          mapTypeId: 'roadmap',
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          gestureHandling: 'greedy'
        });

        isGoogleActive = true;
        document.getElementById('engine-text').innerText = 'Google Maps';
        document.getElementById('engine-dot').style.background = '#10B981';

        window.recenterMap = function() {
          var p = centerPos;
          if (gMarker && gMarker.getPosition) p = gMarker.getPosition();
          if (gMap) { gMap.panTo(p); gMap.setZoom(${mapZoom}); }
        };

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
            strokeWeight: 3.5
          }
        });

        gCircle = new google.maps.Circle({
          map: gMap,
          center: centerPos,
          radius: 1000,
          fillColor: '#D4AF37',
          fillOpacity: 0.14,
          strokeColor: '#D4AF37',
          strokeOpacity: 0.9,
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
        return true;
      } catch (err) {
        console.warn('Google Maps native init failed:', err);
        return false;
      }
    }

    function initLeaflet() {
      if (isGoogleActive || !window.L) return;

      var mapEl = document.getElementById('map');
      mapEl.innerHTML = '';

      document.getElementById('engine-text').innerText = 'High-Def Map';
      document.getElementById('engine-dot').style.background = '#3B82F6';

      lMap = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([${targetLat}, ${targetLng}], ${mapZoom});

      // CartoDB Voyager High-DPI Vector-Style Tiles
      lStreetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB & Greenart',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(lMap);

      // Esri Satellite World Imagery
      lSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri World Imagery & Greenart',
        maxZoom: 19
      });

      var pinIcon = L.divIcon({
        className: 'target-pin-wrap',
        html: '<div class="luxury-target-pin"><div class="pin-ring-pulse"></div><div class="pin-core-disc"><div class="pin-inner-white"></div></div></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
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
        fillOpacity: 0.14,
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

      window.recenterMap = function() {
        var p = [${targetLat}, ${targetLng}];
        if (lMarker && lMarker.getLatLng) p = lMarker.getLatLng();
        if (lMap) { lMap.setView(p, ${mapZoom}); }
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

    // Trap Google Maps authentication errors (RefererNotAllowedMapError, etc.)
    window.gm_authFailure = function() {
      console.warn('Google Maps authentication failed; switching smoothly to High-Def Map');
      isGoogleActive = false;
      initLeaflet();
    };

    // Initialize: Try Google Maps first, then fallback to Leaflet
    if (window.google && window.google.maps) {
      var success = initGoogleMaps();
      if (!success) {
        initLeaflet();
      }
    } else {
      initLeaflet();
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { height: mapHeight }, style]}>
      {hasError ? (
        <View style={[styles.errorContainer, { height: mapHeight }]}>
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
        <View
          style={[styles.webviewWrapper, { height: mapHeight }]}
          pointerEvents={isMapInteractive ? 'auto' : 'none'}
        >
          <WebViewComponent
            ref={webViewRef}
            originWhitelist={['*']}
            source={{
              html: htmlContent,
              baseUrl: 'https://greenartproperties.com',
            }}
            onMessage={handleMessage}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            style={[styles.webview, { height: mapHeight }]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            nestedScrollEnabled={true}
            overScrollMode="never"
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            androidHardwareAccelerationDisabled={false}
            mixedContentMode="always"
            allowFileAccess={true}
          />
        </View>
      )}

      {/* Floating Mode Pill: Tap to pan/zoom map vs scroll screen */}
      {!isLoading && !hasError && (
        <View style={styles.interactionBar} pointerEvents="box-none">
          <TouchableOpacity
            style={[
              styles.interactionBtn,
              isMapInteractive ? styles.interactionBtnActive : styles.interactionBtnInactive,
            ]}
            onPress={() => setIsMapInteractive(!isMapInteractive)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.interactionDot,
                { backgroundColor: isMapInteractive ? '#10B981' : '#D4AF37' },
              ]}
            />
            <Text
              style={[
                styles.interactionBtnText,
                isMapInteractive ? styles.interactionBtnTextActive : styles.interactionBtnTextInactive,
              ]}
            >
              {isMapInteractive ? '👆 Map Active' : '📜 Scroll Page'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Quick Recenter Button */}
      {!isLoading && !hasError && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() => {
            const js = `if (window.recenterMap) { window.recenterMap(); } true;`;
            webViewRef.current?.injectJavaScript(js);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.recenterBtnText}>🎯 Recenter Pin</Text>
        </TouchableOpacity>
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
    backgroundColor: '#FAF5FF',
    position: 'relative',
    overflow: 'hidden',
  },
  webviewWrapper: {
    width: '100%',
  },
  webview: {
    width: '100%',
    backgroundColor: '#FAF5FF',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 5,
  },
  recenterBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#240046',
  },
  interactionBar: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    zIndex: 20,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 4,
  },
  interactionBtnInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
  },
  interactionBtnActive: {
    backgroundColor: '#240046',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  interactionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  interactionBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  interactionBtnTextInactive: {
    color: '#240046',
  },
  interactionBtnTextActive: {
    color: '#FFFFFF',
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
