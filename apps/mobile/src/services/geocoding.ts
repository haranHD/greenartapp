import { Platform } from 'react-native';
import { mobileApi } from './api';

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  name: string;
  formattedAddress?: string;
  source: 'coords' | 'google-client' | 'backend-proxy' | 'nominatim' | 'pilot-fallback';
}

/**
 * Universal multi-tier address and coordinate geocoding service.
 * Translates any user-entered text (street address, door number, locality name, or raw lat/lng)
 * into high-precision geographic coordinates and places the map pin directly.
 */
class GeocodingClient {
  /**
   * Geocodes an address or locality query into coordinates.
   */
  public async geocodeAddress(query: string): Promise<ResolvedLocation | null> {
    if (!query || !query.trim()) return null;
    const cleanQuery = query.trim();

    // Tier 1: Check if input is direct numeric coordinates (e.g., "11.0012, 77.0874" or "11.0012 77.0874")
    const coords = this.parseCoordinates(cleanQuery);
    if (coords) {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        name: `Pin (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        formattedAddress: `Coordinates: ${coords.latitude}, ${coords.longitude}`,
        source: 'coords',
      };
    }

    // Tier 2: Direct In-Browser Google Maps Geocoder (if Google Maps SDK is loaded on Web)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
      try {
        const googleRes = await this.geocodeViaGoogleJs(cleanQuery);
        if (googleRes) return googleRes;
      } catch (err) {
        console.warn('[Geocoding] Google JS Geocoder error; trying backend proxy:', err);
      }
    }

    // Tier 3: Greenart Backend Geocoding Proxy (Google Places Text Search New API)
    try {
      const backendRes = await mobileApi.geocodeAddress(cleanQuery);
      if (backendRes && backendRes.latitude && backendRes.longitude) {
        return {
          latitude: backendRes.latitude,
          longitude: backendRes.longitude,
          name: backendRes.name || backendRes.locality || cleanQuery,
          formattedAddress: backendRes.formattedAddress || backendRes.name,
          source: 'backend-proxy',
        };
      }
    } catch (err) {
      console.warn('[Geocoding] Backend geocode failed; trying Nominatim fallback:', err);
    }

    // Tier 4: OpenStreetMap Nominatim Search (High-precision Indian street & village data fallback)
    try {
      const nominatimRes = await this.geocodeViaNominatim(cleanQuery);
      if (nominatimRes) return nominatimRes;
    } catch (err) {
      console.warn('[Geocoding] Nominatim geocode error:', err);
    }

    // Tier 5: Local Reference Localities Substring Match
    const pilotMatch = this.matchPilotLocalities(cleanQuery);
    if (pilotMatch) return pilotMatch;

    return null;
  }

  /**
   * Parses raw numeric coordinates if formatted as "lat, lng" or "lat lng".
   */
  private parseCoordinates(input: string): { latitude: number; longitude: number } | null {
    const match = input.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    if (!isNaN(lat) && !isNaN(lng) && lat >= 6.0 && lat <= 38.0 && lng >= 68.0 && lng <= 98.0) {
      return { latitude: Math.round(lat * 10000) / 10000, longitude: Math.round(lng * 10000) / 10000 };
    }
    return null;
  }

  /**
   * Geocodes using the loaded Google Maps JavaScript Geocoder instance.
   */
  private geocodeViaGoogleJs(address: string): Promise<ResolvedLocation | null> {
    return new Promise((resolve) => {
      try {
        const google = (window as any).google;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          {
            address,
            componentRestrictions: { country: 'IN' },
          },
          (results: any[], status: string) => {
            if (status === 'OK' && results && results.length > 0) {
              const best = results[0];
              const lat = best.geometry.location.lat();
              const lng = best.geometry.location.lng();
              const name = best.formatted_address || address;

              resolve({
                latitude: Math.round(lat * 10000) / 10000,
                longitude: Math.round(lng * 10000) / 10000,
                name: best.address_components?.[0]?.long_name || name,
                formattedAddress: best.formatted_address,
                source: 'google-client',
              });
            } else {
              resolve(null);
            }
          }
        );
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Geocodes using OpenStreetMap Nominatim with intelligent address cleaning.
   */
  private async geocodeViaNominatim(address: string): Promise<ResolvedLocation | null> {
    const queriesToTry = [address];

    // If query has door numbers or slashes like "1/481/36, Vinayaga nagar...", strip the door number prefix
    const strippedDoorNo = address.replace(/^[\d\/\-\w]+\s*,\s*/i, '').trim();
    if (strippedDoorNo && strippedDoorNo !== address) {
      queriesToTry.push(strippedDoorNo);
    }

    // Try with "Tamil Nadu, India" appended if not already present
    if (!address.toLowerCase().includes('tamil nadu')) {
      queriesToTry.push(`${strippedDoorNo || address}, Tamil Nadu, India`);
    }

    for (const q of queriesToTry) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=1`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'GreenartProperties/1.0',
          },
        });
        if (!res.ok) continue;

        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              latitude: Math.round(lat * 10000) / 10000,
              longitude: Math.round(lng * 10000) / 10000,
              name: item.name || item.display_name.split(',')[0],
              formattedAddress: item.display_name,
              source: 'nominatim',
            };
          }
        }
      } catch {
        // Continue to next query candidate
      }
    }
    return null;
  }

  /**
   * Fast fallback against known pilot hubs if network is offline.
   */
  private matchPilotLocalities(text: string): ResolvedLocation | null {
    const lower = text.toLowerCase();
    const pilotLocalities = [
      { name: 'Kannampalayam', lat: 11.0012, lng: 77.0874 },
      { name: 'Sulur', lat: 11.0264, lng: 77.1275 },
      { name: 'Saravanampatti', lat: 11.0805, lng: 76.9976 },
      { name: 'Kurumbapalayam', lat: 11.0912, lng: 77.0345 },
      { name: 'Peelamedu', lat: 11.0245, lng: 77.0089 },
      { name: 'Gandhipuram', lat: 11.0168, lng: 76.9676 },
      { name: 'Pollachi', lat: 10.6609, lng: 77.0089 },
    ];

    for (const p of pilotLocalities) {
      if (lower.includes(p.name.toLowerCase())) {
        return {
          latitude: p.lat,
          longitude: p.lng,
          name: p.name,
          formattedAddress: `${p.name}, Coimbatore, Tamil Nadu`,
          source: 'pilot-fallback',
        };
      }
    }
    return null;
  }
}

export const geocodingService = new GeocodingClient();

