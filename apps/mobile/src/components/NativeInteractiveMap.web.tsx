import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const recordMarkersRef = useRef<any[]>([]);

  const [engine, setEngine] = useState<'loading' | 'google' | 'leaflet'>('loading');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const googleFailedRef = useRef(false);

  const effectiveKey = apiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || DEFAULT_GOOGLE_MAPS_KEY;
  const mapHeight = style?.height || height || 420;

  // -------------------------------------------------------------------------
  // 1. Script Loading & Engine Selection (Google Maps -> Leaflet Fallback)
  // -------------------------------------------------------------------------
  const loadLeafletScriptAndCss = useCallback(() => {
    // 1. Leaflet CSS
    if (!document.getElementById('greenart-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'greenart-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // 2. Leaflet JS
    if ((window as any).L) {
      setEngine('leaflet');
      return;
    }

    if (!document.getElementById('greenart-leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'greenart-leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setEngine('leaflet');
      };
      script.onerror = () => {
        console.warn('Leaflet script failed to load from primary CDN.');
        setEngine('leaflet');
      };
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(interval);
          setEngine('leaflet');
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 4000);
    }
  }, []);

  const fallbackToLeaflet = useCallback((reason: string) => {
    console.warn(`[Greenart Map Engine] ${reason} -> Fallback to OpenStreetMap/Leaflet`);
    googleFailedRef.current = true;
    loadLeafletScriptAndCss();
  }, [loadLeafletScriptAndCss]);

  useEffect(() => {
    // Trap global Google Maps authentication failure (e.g. RefererNotAllowedMapError, ApiNotActivatedMapError)
    const originalGmAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      fallbackToLeaflet('Google Maps gm_authFailure (key restriction or quota)');
      if (typeof originalGmAuthFailure === 'function') {
        originalGmAuthFailure();
      }
    };

    if (!effectiveKey) {
      fallbackToLeaflet('No Google Maps API Key provided');
      return;
    }

    if (googleFailedRef.current) {
      loadLeafletScriptAndCss();
      return;
    }

    // If Google Maps is already initialized on window
    if ((window as any).google?.maps) {
      setEngine('google');
      return;
    }

    // Inject Google Maps JS SDK
    const scriptId = 'google-maps-js-sdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(effectiveKey)}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if ((window as any).google?.maps) {
          setEngine('google');
        } else {
          fallbackToLeaflet('Google Maps SDK loaded but google.maps object not ready');
        }
      };

      script.onerror = () => {
        fallbackToLeaflet('Google Maps SDK network download failed');
      };

      document.head.appendChild(script);
    } else {
      const pollTimer = setInterval(() => {
        if ((window as any).google?.maps) {
          clearInterval(pollTimer);
          setEngine('google');
        }
      }, 150);

      const timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        if (!(window as any).google?.maps) {
          fallbackToLeaflet('Google Maps SDK load timed out after 3.5s');
        }
      }, 3500);

      return () => {
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
      };
    }
  }, [effectiveKey, fallbackToLeaflet, loadLeafletScriptAndCss]);

  // -------------------------------------------------------------------------
  // 2. Map Engine: GOOGLE MAPS
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (engine !== 'google' || !containerRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    try {
      const center = { lat: targetLat, lng: targetLng };

      if (!mapInstanceRef.current || !mapInstanceRef.current.setCenter) {
        // Clear container in case another engine left nodes
        containerRef.current.innerHTML = '';

        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: mapZoom,
          mapTypeId: mapType,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        // Target Center Marker (Royal Violet with Gold border)
        const marker = new google.maps.Marker({
          position: center,
          map,
          draggable: true,
          title: `Target: ${activeLocality}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#240046',
            fillOpacity: 1,
            strokeColor: '#D4AF37',
            strokeWeight: 3,
          },
        });

        // 1,000m Buffer Circle (Gold border & subtle wash)
        const circle = new google.maps.Circle({
          map,
          center,
          radius: 1000,
          fillColor: '#D4AF37',
          fillOpacity: 0.12,
          strokeColor: '#D4AF37',
          strokeOpacity: 0.85,
          strokeWeight: 2,
        });

        marker.addListener('dragend', (e: any) => {
          const lat = Math.round(e.latLng.lat() * 10000) / 10000;
          const lng = Math.round(e.latLng.lng() * 10000) / 10000;
          circle.setCenter({ lat, lng });
          onSelectLocation(lat, lng);
        });

        map.addListener('click', (e: any) => {
          const lat = Math.round(e.latLng.lat() * 10000) / 10000;
          const lng = Math.round(e.latLng.lng() * 10000) / 10000;
          marker.setPosition({ lat, lng });
          circle.setCenter({ lat, lng });
          onSelectLocation(lat, lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
      } else {
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.setZoom(mapZoom);
        mapInstanceRef.current.setMapTypeId(mapType);
        if (markerRef.current) markerRef.current.setPosition(center);
        if (circleRef.current) circleRef.current.setCenter(center);
      }

      // Sync Comparable Markers
      if (recordMarkersRef.current.length > 0) {
        recordMarkersRef.current.forEach((m) => m.setMap(null));
        recordMarkersRef.current = [];
      }

      records.forEach((r) => {
        const dotColor =
          r.sourceCategory === 'VerifiedTransaction'
            ? '#D4AF37'
            : r.sourceCategory === 'GovernmentGuideline'
              ? '#7C3AED'
              : '#F59E0B';

        const recMarker = new google.maps.Marker({
          position: { lat: r.latitude, lng: r.longitude },
          map: mapInstanceRef.current,
          title: `${r.locality} (₹${(r.normalizedRatePerCent / 100000).toFixed(2)}L/cent)`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: dotColor,
            fillOpacity: 0.9,
            strokeColor: '#FFFFFF',
            strokeWeight: 1.5,
          },
        });
        recordMarkersRef.current.push(recMarker);
      });
    } catch (err) {
      console.error('Google Maps initialization error; falling back to Leaflet:', err);
      fallbackToLeaflet('Google Maps construction error');
    }
  }, [engine, targetLat, targetLng, mapZoom, mapType, activeLocality, records, onSelectLocation, fallbackToLeaflet]);

  // -------------------------------------------------------------------------
  // 3. Map Engine: LEAFLET / OPENSTREETMAP (Resilient Offline & Key Fallback)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (engine !== 'leaflet' || !containerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    try {
      const createPinIcon = () =>
        L.divIcon({
          className: 'custom-pin',
          html: '<div style="background-color:#240046;width:24px;height:24px;border-radius:12px;border:3px solid #D4AF37;box-shadow:0 3px 8px rgba(36,0,70,0.5);display:flex;align-items:center;justify-content:center;cursor:grab;"><div style="background-color:#ffffff;width:6px;height:6px;border-radius:3px;"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

      if (!mapInstanceRef.current || !mapInstanceRef.current.setView || !containerRef.current.querySelector('.leaflet-pane')) {
        containerRef.current.innerHTML = '';
        if ((containerRef.current as any)._leaflet_id) {
          delete (containerRef.current as any)._leaflet_id;
        }

        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([targetLat, targetLng], mapZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([targetLat, targetLng], {
          icon: createPinIcon(),
          draggable: true,
        }).addTo(map);

        marker.bindTooltip(`Target: ${activeLocality}`, { direction: 'top', offset: [0, -12] });

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          const lat = Math.round(pos.lat * 10000) / 10000;
          const lng = Math.round(pos.lng * 10000) / 10000;
          if (circleRef.current) circleRef.current.setLatLng([lat, lng]);
          onSelectLocation(lat, lng);
        });

        const circle = L.circle([targetLat, targetLng], {
          radius: 1000,
          color: '#D4AF37',
          weight: 2,
          fillColor: '#D4AF37',
          fillOpacity: 0.12,
        }).addTo(map);

        map.on('click', (e: any) => {
          const lat = Math.round(e.latlng.lat * 10000) / 10000;
          const lng = Math.round(e.latlng.lng * 10000) / 10000;
          marker.setLatLng([lat, lng]);
          circle.setLatLng([lat, lng]);
          onSelectLocation(lat, lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;

        // Invalidate size in multiple intervals to ensure tiles render immediately
        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // ignore
          }
        }, 100);

        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // ignore
          }
        }, 400);
      } else {
        mapInstanceRef.current.setView([targetLat, targetLng], mapZoom);
        if (markerRef.current) markerRef.current.setLatLng([targetLat, targetLng]);
        if (circleRef.current) circleRef.current.setLatLng([targetLat, targetLng]);
      }

      // Sync Comparable Layer
      if (recordMarkersRef.current.length > 0) {
        recordMarkersRef.current.forEach((layer) => {
          try {
            mapInstanceRef.current.removeLayer(layer);
          } catch {
            // ignore
          }
        });
        recordMarkersRef.current = [];
      }

      records.forEach((r) => {
        const dotColor =
          r.sourceCategory === 'VerifiedTransaction'
            ? '#D4AF37'
            : r.sourceCategory === 'GovernmentGuideline'
              ? '#7C3AED'
              : '#F59E0B';

        const recMarker = L.circleMarker([r.latitude, r.longitude], {
          radius: 5,
          color: '#FFFFFF',
          fillColor: dotColor,
          fillOpacity: 0.9,
          weight: 1.5,
        }).addTo(mapInstanceRef.current);

        const typeLabel =
          r.sourceCategory === 'VerifiedTransaction'
            ? 'Verified Deed'
            : r.sourceCategory === 'GovernmentGuideline'
              ? 'TN Guideline'
              : 'Asking Price';

        recMarker.bindTooltip(`${typeLabel}: ₹${(r.normalizedRatePerCent / 100000).toFixed(2)}L/cent`, {
          direction: 'top',
          offset: [0, -5],
        });

        recordMarkersRef.current.push(recMarker);
      });
    } catch (err) {
      console.error('Leaflet initialization error:', err);
    }
  }, [engine, targetLat, targetLng, mapZoom, activeLocality, records, onSelectLocation]);

  // -------------------------------------------------------------------------
  // 4. Cleanup on Unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          if (mapInstanceRef.current.remove) {
            mapInstanceRef.current.remove();
          }
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const toggleEngine = () => {
    if (engine === 'google') {
      fallbackToLeaflet('User switched to OpenStreetMap');
    } else {
      googleFailedRef.current = false;
      setEngine('google');
    }
  };

  return (
    <View style={[styles.canvasWrapper, { height: mapHeight }, style]}>
      {/* Native Web DOM Container with forced pixel height */}
      <div
        id="greenart-mobile-map-canvas"
        ref={containerRef}
        style={{
          width: '100%',
          height: `${mapHeight}px`,
          minHeight: `${mapHeight}px`,
          backgroundColor: '#FAF5FF',
          position: 'relative',
          overflow: 'hidden',
        }}
      />

      {/* Loading Overlay */}
      {engine === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#240046" />
          <Text style={styles.loadingText}>Initializing Map Engine...</Text>
        </View>
      )}

      {/* Engine Status & Layer Controls */}
      <View style={styles.topControlOverlay}>
        <TouchableOpacity
          style={styles.engineBadge}
          onPress={toggleEngine}
          activeOpacity={0.8}
          accessibilityLabel="Switch Map Engine"
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: engine === 'google' ? '#D4AF37' : '#7C3AED' },
            ]}
          />
          <Text style={styles.engineBadgeText}>
            {engine === 'google'
              ? 'Google Maps'
              : engine === 'leaflet'
                ? 'OpenStreetMap'
                : 'Connecting...'}
          </Text>
          <Text style={styles.engineSwitchHint}>⇄</Text>
        </TouchableOpacity>

        {engine === 'google' && (
          <View style={styles.typeSwitcher}>
            <TouchableOpacity onPress={() => setMapType('roadmap')}>
              <Text
                style={[styles.typeBtn, mapType === 'roadmap' && styles.typeBtnActive]}
              >
                Road
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMapType('hybrid')}>
              <Text
                style={[styles.typeBtn, mapType === 'hybrid' && styles.typeBtnActive]}
              >
                Hybrid
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  canvasWrapper: {
    height: 280,
    width: '100%',
    backgroundColor: '#FAF5FF',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 245, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#240046',
  },
  topControlOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  engineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#240046',
  },
  engineSwitchHint: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D4AF37',
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 2,
    gap: 2,
    shadowColor: '#240046',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  typeBtn: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: '#240046',
    color: '#FFFFFF',
  },
});
