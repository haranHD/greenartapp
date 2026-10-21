// Centralized Typed API Client for Greenart Properties Admin Console

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5039/api/v1';

export interface HealthCheckResponse {
  status: string;
  application: string;
  environment: string;
  version: string;
  database: {
    connected: boolean;
    postgisEnabled: boolean;
    postgisVersion: string;
    engine: string;
  };
  timestampUtc: string;
}

export interface LocalityReference {
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  guidelineRatePerCent: number;
  guidelineRatePerSqFt: number;
  recordCount: number;
}

export interface ApiLandRecord {
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

export interface CreateLandRecordPayload {
  locality: string;
  taluk?: string;
  streetOrLandmark?: string;
  surveyNumber?: string;
  latitude: number;
  longitude: number;
  landUsage: number;
  area: number;
  unit: number;
  price: number;
  sourceCategory: number;
  sourceReference?: string;
  observationDate?: string;
  notes?: string;
}

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
  confidence: string;
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

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson && errorJson.error) {
            errorMessage = errorJson.error;
          } else if (errorJson && errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch {
          // Response body was not JSON
        }
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(`Cannot reach API at ${API_BASE_URL}. Ensure ASP.NET Core backend is running on port 5039.`);
      }
      throw err;
    }
  }

  // 1. System Health
  async getHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/health');
  }

  // 2. Reference Localities (dynamic aggregates from PostgreSQL)
  async getReferenceLocalities(): Promise<LocalityReference[]> {
    return this.request<LocalityReference[]>('/reference/localities');
  }

  // 3. List Land Records (with optional filters)
  async getLandRecords(locality?: string, landUsage?: number, sourceCategory?: number): Promise<ApiLandRecord[]> {
    const params = new URLSearchParams();
    if (locality && locality !== 'All') params.append('locality', locality);
    if (landUsage && landUsage > 0) params.append('landUsage', landUsage.toString());
    if (sourceCategory && sourceCategory > 0) params.append('sourceCategory', sourceCategory.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<ApiLandRecord[]>(`/land-records${queryString}`);
  }

  // 4. Get Land Record by ID
  async getLandRecordById(id: string): Promise<ApiLandRecord> {
    return this.request<ApiLandRecord>(`/land-records/${id}`);
  }

  // 5. Calculate Indicative Market Estimate (PostGIS 1,000m spatial query)
  async calculateEstimate(
    latitude: number,
    longitude: number,
    landUsage: number = 1,
    radiusMeters: number = 1000
  ): Promise<EstimateApiResponse> {
    return this.request<EstimateApiResponse>('/estimates/calculate', {
      method: 'POST',
      body: JSON.stringify({
        latitude,
        longitude,
        landUsage,
        radiusMeters,
      }),
    });
  }

  // 6. Create and Persist New Land Record
  async createLandRecord(payload: CreateLandRecordPayload): Promise<ApiLandRecord> {
    return this.request<ApiLandRecord>('/land-records', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 7. Update Verification Status (Audit & Moderation)
  async updateVerificationStatus(
    id: string,
    status: number, // 2 = Verified, 3 = Rejected, 4 = Archived
    auditNote?: string
  ): Promise<ApiLandRecord> {
    return this.request<ApiLandRecord>(`/land-records/${id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ status, auditNote }),
    });
  }
}

export const api = new ApiClient();

