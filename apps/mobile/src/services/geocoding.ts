import { mobileApi } from './api';

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  name: string;
  formattedAddress?: string;
  district?: string;
  source: 'coords' | 'backend-proxy';
}

class GeocodingClient {
  public async geocodeAddress(query: string): Promise<ResolvedLocation | null> {
    const text = query.trim();
    if (!text) return null;
    const match = text.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98)
        return { latitude, longitude, name: 'Custom Coordinates', formattedAddress: text, source: 'coords' };
      return null;
    }
    // One provider path for typed addresses. Failures stay visible; no client-side
    // provider switching or hardcoded locality matches that could move the wrong pin.
    const result = await mobileApi.geocodeAddress(text);
    if (!result) return null;
    return { latitude: result.latitude, longitude: result.longitude, name: result.name,
      formattedAddress: result.formattedAddress, district: result.district, source: 'backend-proxy' };
  }
}
export const geocodingService = new GeocodingClient();
