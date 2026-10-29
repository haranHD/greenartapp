// Centralized Typed API Client for Greenart Properties Admin Console

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://greenartapp-1.onrender.com/api/v1'
    : 'http://localhost:5039/api/v1');

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

export interface CsvRowDiagnostic {
  rowNumber: number;
  locality?: string;
  surveyNumber?: string;
  severity: 'Error' | 'Warning' | 'Info';
  field: string;
  message: string;
}

export interface ValidatedRecordPreview {
  rowNumber: number;
  locality: string;
  taluk?: string;
  streetOrLandmark?: string;
  surveyNumber?: string;
  latitude: number;
  longitude: number;
  landUsage: string;
  area: number;
  unit: string;
  price: number;
  normalizedRatePerCent: number;
  normalizedRatePerSqFt: number;
  sourceCategory: string;
  sourceReference?: string;
  observationDate: string;
  verificationStatus: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BatchImportSummaryResponse {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  timestampUtc: string;
  diagnostics: CsvRowDiagnostic[];
  previews: ValidatedRecordPreview[];
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
  governmentGuidelineReference?: GuidelineReferenceDto;
}

export type EstimateApiResponse = EstimateSuccessResponse | EstimateInsufficientDataResponse;

export interface DistrictCoverageDetail {
  district: string;
  recordCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  guidelineCount: number;
  status: 'PilotHub' | 'Moderate' | 'Sparse' | 'NoData' | string;
  latestObservationDate: string | null;
  activeLocalities: string[];
}

export interface StatewideCoverageSummary {
  totalRecords: number;
  totalVerified: number;
  totalUnverified: number;
  totalGuideline: number;
  activeDistrictsCount: number;
  totalTamilNaduDistricts: number;
  latestObservationDateUtc: string | null;
  districtBreakdown: DistrictCoverageDetail[];
}

export interface ImportBatchRecord {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  dryRun: boolean;
  triggeredBy: string;
  executedAtUtc: string;
  diagnosticSummary?: string;
}

export interface ProviderCoverage {
  regionName: string;
  coveredDistricts: string[];
  statewide: boolean;
  supportedLandUsages: string[];
}

export interface ProviderSummary {
  providerId: string;
  providerName: string;
  sourceCategory: string;
  permittedUsage: string;
  coverage: ProviderCoverage;
  lastUpdatedUtc: string;
  isLiveFeedAvailable: boolean;
  licenseTerms: string;
  dataIntegrityNote: string;
}

export interface DistrictMlStatus {
  district: string;
  totalRecords: number;
  verifiedTransactions: number;
  askingPrices: number;
  guidelineBenchmarks: number;
  clientResearch: number;
  densityStatus: string;
  isEligibleForMlTraining: boolean;
  requiredAdditionalRecords: number;
}

export interface MlTrainingFeatureSchema {
  featureName: string;
  dataType: string;
  description: string;
  isTarget: boolean;
  treatmentPolicy: string;
}

export interface MlReadinessAuditReport {
  auditTimestampUtc: string;
  minimumRequiredVerifiedPerDistrict: number;
  totalStatewideRecords: number;
  totalStatewideVerifiedTransactions: number;
  qualifiedDistrictsCount: number;
  districts: DistrictMlStatus[];
  featureSchema: MlTrainingFeatureSchema[];
  dataLeakageSafeguards: string[];
  validationBlockers: string[];
  productionReadinessVerdict: string;
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

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
        const hint = API_BASE_URL.includes('onrender.com')
          ? 'Cloud service may be waking up from sleep (Render free tier cold start ~45s). Please wait a moment and retry.'
          : 'Ensure ASP.NET Core backend is running on port 5039.';
        throw new Error(`Cannot reach API at ${API_BASE_URL}. ${hint}`);
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

  // Admin Authentication Key Management (Stored in SessionStorage; never hardcoded in bundle)
  getAdminKey(): string {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('greenart_admin_api_key');
      if (stored) return stored;
    }
    return (import.meta as any).env?.VITE_ADMIN_API_KEY || '';
  }

  setAdminKey(key: string): void {
    if (typeof sessionStorage !== 'undefined') {
      if (key && key.trim()) {
        sessionStorage.setItem('greenart_admin_api_key', key.trim());
      } else {
        sessionStorage.removeItem('greenart_admin_api_key');
      }
    }
  }

  // 6. Create and Persist New Land Record
  async createLandRecord(payload: CreateLandRecordPayload): Promise<ApiLandRecord> {
    const key = this.getAdminKey();
    return this.request<ApiLandRecord>('/land-records', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: key ? { 'X-Admin-Key': key } : {},
    });
  }

  // 7. Update Verification Status (Audit & Moderation)
  async updateVerificationStatus(
    id: string,
    status: number, // 1 = PendingReview, 2 = Verified, 3 = Rejected, 4 = Archived
    auditNote?: string
  ): Promise<ApiLandRecord> {
    const key = this.getAdminKey();
    return this.request<ApiLandRecord>(`/land-records/${id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ status, auditNote }),
      headers: key ? { 'X-Admin-Key': key } : {},
    });
  }

  // 8. Bulk CSV Land Records Import (Supports dryRun preview & skipDuplicates)
  async importCsv(
    file: File,
    dryRun: boolean = false,
    skipDuplicates: boolean = true,
    adminKey?: string
  ): Promise<BatchImportSummaryResponse> {
    const key = adminKey || this.getAdminKey();
    const formData = new FormData();
    formData.append('file', file);

    const query = new URLSearchParams({
      dryRun: dryRun ? 'true' : 'false',
      skipDuplicates: skipDuplicates ? 'true' : 'false',
    });

    return this.request<BatchImportSummaryResponse>(`/land-records/import/csv?${query.toString()}`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Admin-Key': key,
      },
    });
  }

  // 9. Download CSV Import Template
  async downloadCsvTemplate(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/land-records/import/csv-template`);
      if (response.ok) {
        const blob = await response.blob();
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'greenart_land_records_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Fallback to client-side standard template
    }

    const headers = 'locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate,district,state,country,notes';
    const sampleRows = [
      'Kannampalayam,Sulur,Trichy Road Branch,SF 142/2A,11.0015,77.0878,Residential,3.5,Cent,3675000,VerifiedTransaction,SRO Sulur Doc 3412/2023,2023-11-14,Coimbatore,Tamil Nadu,India,"Registered sale deed; rectangular plot facing 30ft road"',
      'Sulur,Sulur,Airport Road Bypass,SF 88/1,11.0260,77.1280,Commercial,2400,SqFt,4800000,AdvertisedAskingPrice,Local Broker Listing #SLR-22,2024-03-01,Coimbatore,Tamil Nadu,India,"Commercial frontage plot asking rate"',
      'Saravanampatti,Annur,Sathy Road Junction,SF 210/3,11.0820,76.9985,Residential,1.0,Acre,120000000,ClientResearch,Surveyor Field Valuation Sheet #12,2024-01-15,Coimbatore,Tamil Nadu,India,"One acre parcel assessed by field surveyor"'
    ];

    const csvContent = [headers, ...sampleRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'greenart_land_records_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 10. Statewide Coverage Summary
  async getCoverageSummary(): Promise<StatewideCoverageSummary> {
    return this.request<StatewideCoverageSummary>('/coverage/summary');
  }

  // 11. Batch Import Audit History
  async getImportHistory(limit: number = 20): Promise<ImportBatchRecord[]> {
    return this.request<ImportBatchRecord[]>(`/land-records/import/history?limit=${limit}`);
  }

  // 12. External Land Price Data Providers
  async getProviders(): Promise<ProviderSummary[]> {
    return this.request<ProviderSummary[]>('/providers');
  }

  // 13. ML Production Readiness Audit
  async getMlReadiness(): Promise<MlReadinessAuditReport> {
    return this.request<MlReadinessAuditReport>('/ml/readiness');
  }

  // 14. Registered User Accounts
  async getUsers(search?: string): Promise<AdminUserRecord[]> {
    const adminKey = this.getAdminKey();
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<AdminUserRecord[]>(`/admin/users${query}`, {
      headers: adminKey ? { 'X-Admin-Key': adminKey } : {},
    });
  }
}

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  role: 'Customer' | 'Reviewer' | 'Administrator';
  accountStatus: 'Active' | 'Suspended' | 'Deactivated';
  isEmailVerified: boolean;
  isSellerVerified: boolean;
  sellerType: 'IndividualOwner' | 'Promoter' | 'LicensedAgent';
  createdAtUtc: string;
  lastLoginAtUtc?: string;
  hasPassword: boolean;
  hasGoogleAuth: boolean;
}

export const api = new ApiClient();

