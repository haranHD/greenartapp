// Centralized Typed API Client for Greenart Mobile Application

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

const getApiBaseUrl = (): string => {
  // Safe detection for Web, React Native, and Android emulator
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    return `http://${host}:5039/api/v1`;
  }
  return 'http://localhost:5039/api/v1';
};

class MobileApiClient {
  private baseUrl = getApiBaseUrl();

  async calculateEstimate(
    latitude: number,
    longitude: number,
    landUsage: number = 1,
    radiusMeters: number = 1000
  ): Promise<EstimateApiResponse> {
    const response = await fetch(`${this.baseUrl}/estimates/calculate`, {
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
    const response = await fetch(`${this.baseUrl}/reference/localities`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load localities: ${response.statusText}`);
    }
    return (await response.json()) as LocalityReference[];
  }
}

export const mobileApi = new MobileApiClient();

