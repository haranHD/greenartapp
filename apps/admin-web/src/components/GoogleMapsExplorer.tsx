import { useEffect, useRef, useState } from 'react';
import { ApiLandRecord } from '../services/api';

export interface GoogleMapsExplorerProps {
  targetLat: number;
  targetLng: number;
  selectedLocality: string;
  radiusMeters: number;
  records: ApiLandRecord[];
  onSelectLocation: (lat: number, lng: number) => void;
  apiKey?: string;
}

export const GoogleMapsExplorer = ({
  targetLat,
  targetLng,
  selectedLocality,
  radiusMeters,
  records,
  onSelectLocation,
  apiKey,
}: GoogleMapsExplorerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const recordMarkersRef = useRef<any[]>([]);

  const [mapType, setMapType] = useState<'roadmap' | 'hybrid' | 'satellite'>('roadmap');
  const [engineStatus, setEngineStatus] = useState<'loading' | 'google' | 'leaflet_fallback'>('loading');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const effectiveKey = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // 1. Script Loader with Leaflet Fallback
  useEffect(() => {
    if (!effectiveKey) {
      setEngineStatus('leaflet_fallback');
      return;
    }

    if ((window as any).google && (window as any).google.maps) {
      setEngineStatus('google');
      return;
    }

    const scriptId = 'google-maps-js-sdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(effectiveKey)}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if ((window as any).google && (window as any).google.maps) {
          setEngineStatus('google');
        } else {
          setEngineStatus('leaflet_fallback');
        }
      };

      script.onerror = () => {
        console.warn('Google Maps JS API failed to load; using resilient OpenStreetMap fallback.');
        setStatusMessage('Google Maps offline / key restricted; serving OpenStreetMap fallback.');
        setEngineStatus('leaflet_fallback');
      };

      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          clearInterval(checkInterval);
          setEngineStatus('google');
        }
      }, 200);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (!(window as any).google?.maps) {
          setEngineStatus('leaflet_fallback');
        }
      }, 5000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [effectiveKey]);

  // 2. Google Maps Initialization & Dynamic Updates
  useEffect(() => {
    if (engineStatus !== 'google' || !containerRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (!mapRef.current) {
      // Create initial Google Map instance
      const map = new google.maps.Map(containerRef.current, {
        center: { lat: targetLat, lng: targetLng },
        zoom: 15,
        mapTypeId: mapType,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false, // We provide clean top pills
        streetViewControl: false,
        fullscreenControl: true,
      });

      // Target Draggable Marker
      const marker = new google.maps.Marker({
        position: { lat: targetLat, lng: targetLng },
        map,
        draggable: true,
        title: `Target: ${selectedLocality}`,
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#065F46',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      });

      // 1,000m Buffer Circle
      const circle = new google.maps.Circle({
        map,
        center: { lat: targetLat, lng: targetLng },
        radius: radiusMeters,
        fillColor: '#065F46',
        fillOpacity: 0.12,
        strokeColor: '#059669',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });

      // Events
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

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    } else {
      // Sync map center & marker
      const pos = { lat: targetLat, lng: targetLng };
      markerRef.current.setPosition(pos);
      circleRef.current.setCenter(pos);
      circleRef.current.setRadius(radiusMeters);
      mapRef.current.setMapTypeId(mapType);
    }

    // Render Comparable Records Markers
    recordMarkersRef.current.forEach((m) => m.setMap(null));
    recordMarkersRef.current = [];

    const infoWindow = new google.maps.InfoWindow();

    records.forEach((r) => {
      let markerColor = '#16a34a'; // VerifiedTransaction
      if (r.sourceCategory === 'GovernmentGuideline') markerColor = '#2563eb';
      else if (r.sourceCategory === 'AdvertisedAskingPrice') markerColor = '#ea580c';
      else if (r.sourceCategory === 'ClientResearch') markerColor = '#7e22ce';

      const recMarker = new google.maps.Marker({
        position: { lat: r.latitude, lng: r.longitude },
        map: mapRef.current,
        title: `${r.locality} (${r.sourceCategory})`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: markerColor,
          fillOpacity: 0.9,
          strokeColor: '#FFFFFF',
          strokeWeight: 1.5,
        },
      });

      recMarker.addListener('click', () => {
        const content = `
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a; padding: 4px;">
            <div style="font-weight: 800; color: #065F46; font-size: 13px;">${r.locality}</div>
            <div style="color: #64748b; font-size: 11px;">Usage: ${r.landUsage} • Survey #${r.surveyNumber || 'N/A'}</div>
            <div style="font-weight: 700; margin-top: 4px;">Rate: ₹${(r.normalizedRatePerCent / 100000).toFixed(2)} L/cent</div>
            <div style="font-size: 10px; color: #475569;">Source: ${r.sourceCategory} • Status: ${r.verificationStatus}</div>
          </div>
        `;
        infoWindow.setContent(content);
        infoWindow.open(mapRef.current, recMarker);
      });

      recordMarkersRef.current.push(recMarker);
    });
  }, [engineStatus, targetLat, targetLng, radiusMeters, mapType, records, onSelectLocation]);

  // 3. Fallback Leaflet Renderer (if Google Maps JS is not available or blocked)
  useEffect(() => {
    if (engineStatus !== 'leaflet_fallback' || !containerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current || !mapRef.current.setView) {
      const map = L.map(containerRef.current).setView([targetLat, targetLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap & Greenart Properties',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: any) => {
        const lat = Math.round(e.latlng.lat * 10000) / 10000;
        const lng = Math.round(e.latlng.lng * 10000) / 10000;
        onSelectLocation(lat, lng);
      });

      mapRef.current = map;
    } else {
      mapRef.current.setView([targetLat, targetLng], 15);
      mapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          mapRef.current.removeLayer(layer);
        }
      });
    }

    const map = mapRef.current;

    // Target Pin
    const targetIcon = L.divIcon({
      className: 'target-pin-icon',
      html: `<div style="background:#065F46;color:#ffffff;border:2px solid #10B981;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;box-shadow:0 3px 8px rgba(0,0,0,0.4);">PIN</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([targetLat, targetLng], { icon: targetIcon }).addTo(map);

    // Circle
    L.circle([targetLat, targetLng], {
      radius: radiusMeters,
      color: '#059669',
      fillColor: '#059669',
      fillOpacity: 0.1,
      weight: 1.5,
    }).addTo(map);

    // Records
    records.forEach((r) => {
      let markerColor = '#16a34a';
      if (r.sourceCategory === 'GovernmentGuideline') markerColor = '#2563eb';
      else if (r.sourceCategory === 'AdvertisedAskingPrice') markerColor = '#ea580c';

      const dotIcon = L.divIcon({
        className: 'record-dot-icon',
        html: `<div style="background:${markerColor};border:1.5px solid #ffffff;border-radius:50%;width:12px;height:12px;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      L.marker([r.latitude, r.longitude], { icon: dotIcon })
        .addTo(map)
        .bindPopup(`<strong>${r.locality}</strong><br/>Rate: ₹${(r.normalizedRatePerCent / 100000).toFixed(2)}L/cent`);
    });
  }, [engineStatus, targetLat, targetLng, radiusMeters, records, onSelectLocation]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480 }}>
      {/* Map Control Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: 4,
          borderRadius: 6,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          border: '1px solid #E2E8F0',
        }}
      >
        <button
          onClick={() => setMapType('roadmap')}
          style={{
            background: mapType === 'roadmap' ? '#065F46' : 'transparent',
            color: mapType === 'roadmap' ? '#FFFFFF' : '#334155',
            border: 'none',
            padding: '5px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🗺️ Roadmap
        </button>

        <button
          onClick={() => setMapType('hybrid')}
          style={{
            background: mapType === 'hybrid' ? '#065F46' : 'transparent',
            color: mapType === 'hybrid' ? '#FFFFFF' : '#334155',
            border: 'none',
            padding: '5px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🛰️ Satellite Hybrid
        </button>
      </div>

      {/* Engine Status Banner */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.94)',
          padding: '4px 10px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          color: engineStatus === 'google' ? '#065F46' : '#92400E',
          border: `1px solid ${engineStatus === 'google' ? '#A7F3D0' : '#FDE68A'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: engineStatus === 'google' ? '#10B981' : '#F59E0B',
          }}
        />
        {engineStatus === 'google'
          ? 'Map Engine: Google Maps JavaScript API (Operational)'
          : engineStatus === 'loading'
          ? 'Connecting to Google Maps...'
          : statusMessage || 'Map Engine: OpenStreetMap / Leaflet (Resilient Fallback)'}
      </div>

      {/* Container Element */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 480,
          background: '#F1F5F9',
        }}
      />
    </div>
  );
};
