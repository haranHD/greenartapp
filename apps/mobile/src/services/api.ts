// Centralized Typed API Client for Greenart Mobile Application
import { Platform } from 'react-native';

export interface PriceRangeDto {
  minRate: number;
  percentile25: number;
  medianRate: number;
  percentile75: number;
  maxRate: number;
  unit: string;
}

export interface SourceCategoryBreakdownDto {
  category: string;
  count: number;
}

export interface GuidelineReferenceDto {
  guidelineRatePerCent: number;
  guidelineRatePerSqFt: number;
  locality: string;
  surveyNumber?: string;
  legalNotice: string;
}

export interface EstimateSuccessResponse {
  status: 'Success';
  targetCoordinates: { latitude: number; longitude: number };
  searchRadiusMeters: number;
  comparableRecordCount: number;
  confidence: 'High' | 'Moderate' | 'Low';
  priceRangePerCent: PriceRangeDto;
  priceRangePerSqFt: PriceRangeDto;
  earliestRecordDate: string;
  latestRecordDate: string;
  sourceBreakdown: SourceCategoryBreakdownDto[];
  governmentGuidelineReference?: GuidelineReferenceDto;
  disclaimer: string;
}

export interface EstimateInsufficientDataResponse {
  status: 'InsufficientData';
  targetCoordinates: { latitude: number; longitude: number };
  searchRadiusMeters: number;
  comparableRecordsFound: number;
  minimumRequiredRecords: number;
  message: string;
  recommendations: string[];
  governmentGuidelineReference?: GuidelineReferenceDto;
}

export type EstimateApiResponse = EstimateSuccessResponse | EstimateInsufficientDataResponse;

export interface LocalityReference {
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  guidelineRatePerCent: number;
  guidelineRatePerSqFt: number;
  recordCount: number;
}

export interface LocalitySuggestionDto {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
}

export interface LocalityDetailsDto {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locality: string;
  district: string;
  state: string;
  country: string;
}

export interface LandRecordDto {
  id: string;
  country: string;
  state: string;
  district: string;
  taluk?: string;
  locality: string;
  streetOrLandmark?: string;
  surveyNumber?: string;
  latitude: number;
  longitude: number;
  landUsage: string;
  originalArea: number;
  originalUnit: string;
  originalPrice: number;
  normalizedRatePerCent: number;
  normalizedRatePerSqFt: number;
  sourceCategory: string;
  sourceReference?: string;
  observationDate: string;
  verificationStatus: string;
  isSynthetic: boolean;
  notes?: string;
}

export interface NearbyLandRecordDto extends LandRecordDto {
  distanceMeters: number;
}

export interface HealthStatusResponse {
  status: string;
  database?: {
    connected: boolean;
    postgisVersion?: string;
  };
}

const getApiBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Safe detection for Web browser
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    if (host.includes('vercel.app')) {
      return 'https://greenartapp-1.onrender.com/api/v1';
    }
    return `http://${host}:5039/api/v1`;
  }
  // Android Emulator networking
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5039/api/v1';
  }
  return 'http://localhost:5039/api/v1';
};

class MobileApiClient {
  private baseUrl = getApiBaseUrl();

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs?: number): Promise<Response> {
    const isRender = this.baseUrl.includes('onrender.com');
    const effectiveTimeout = timeoutMs ?? (isRender ? 35000 : 10000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(isRender
          ? 'Cloud service is waking up from free-tier sleep (takes ~45s). Please retry.'
          : 'Request timed out. Please check backend connection on port 5039.');
      }
      throw err;
    }
  }

  async getHealth(): Promise<HealthStatusResponse> {
    try {
      const isRender = this.baseUrl.includes('onrender.com');
      const response = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        headers: { Accept: 'application/json' },
      }, isRender ? 30000 : 4000);
      if (!response.ok) return { status: 'Degraded' };
      return (await response.json()) as HealthStatusResponse;
    } catch {
      return { status: 'Offline' };
    }
  }

  async calculateEstimate(
    latitude: number,
    longitude: number,
    landUsage: number = 1,
    radiusMeters: number = 1000
  ): Promise<EstimateApiResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/estimates/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        latitude,
        longitude,
        landUsage,
        radiusMeters,
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) errorMsg = errJson.error;
        else if (errJson && errJson.message) errorMsg = errJson.message;
      } catch {
        // Not JSON
      }
      throw new Error(errorMsg);
    }

    return (await response.json()) as EstimateApiResponse;
  }

  async getLocalities(): Promise<LocalityReference[]> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/reference/localities`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load localities: ${response.statusText}`);
    }
    return (await response.json()) as LocalityReference[];
  }

  async getLandRecords(params?: {
    locality?: string;
    landUsage?: number;
    sourceCategory?: number;
    district?: string;
  }): Promise<LandRecordDto[]> {
    const query = new URLSearchParams();
    if (params?.locality) query.append('locality', params.locality);
    if (params?.landUsage !== undefined) query.append('landUsage', params.landUsage.toString());
    if (params?.sourceCategory !== undefined) query.append('sourceCategory', params.sourceCategory.toString());
    if (params?.district) query.append('district', params.district);

    const url = `${this.baseUrl}/land-records${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await this.fetchWithTimeout(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load land records: ${response.statusText}`);
    }
    return (await response.json()) as LandRecordDto[];
  }

  async getNearbyLandRecords(
    latitude: number,
    longitude: number,
    radiusMeters: number = 1000,
    landUsage?: number
  ): Promise<NearbyLandRecordDto[]> {
    const query = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radiusMeters: radiusMeters.toString(),
    });
    if (landUsage !== undefined) {
      query.append('landUsage', landUsage.toString());
    }

    const url = `${this.baseUrl}/land-records/nearby?${query.toString()}`;
    const response = await this.fetchWithTimeout(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) errorMsg = errJson.error;
        else if (errJson && errJson.message) errorMsg = errJson.message;
      } catch {
        // Not JSON
      }
      throw new Error(errorMsg);
    }

    return (await response.json()) as NearbyLandRecordDto[];
  }

  async searchLocalities(query: string): Promise<LocalitySuggestionDto[]> {
    if (!query || query.trim().length < 2) return [];
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/localities/search?q=${encodeURIComponent(query.trim())}`,
        { headers: { Accept: 'application/json' } },
        10000
      );
      if (!response.ok) {
        console.warn(`[searchLocalities] API returned HTTP ${response.status}: ${response.statusText}`);
        return [];
      }
      return (await response.json()) as LocalitySuggestionDto[];
    } catch (err: any) {
      console.warn('[searchLocalities] Request failed:', err?.message || err);
      return [];
    }
  }

  async getLocalityDetails(placeId: string): Promise<LocalityDetailsDto | null> {
    if (!placeId) return null;
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/localities/details?placeId=${encodeURIComponent(placeId.trim())}`,
        { headers: { Accept: 'application/json' } },
        10000
      );
      if (!response.ok) {
        console.warn(`[getLocalityDetails] API returned HTTP ${response.status}: ${response.statusText}`);
        return null;
      }
      return (await response.json()) as LocalityDetailsDto;
    } catch (err: any) {
      console.warn('[getLocalityDetails] Request failed:', err?.message || err);
      return null;
    }
  }
}

export const mobileApi = new MobileApiClient();


