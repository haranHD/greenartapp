export interface BrokerPriceRange {
  researchId: string; locality: string; district: string; landUsage: string; roadAccess: string;
  coverageRadiusMeters: number; lowPerCent: number; highPerCent: number; lowPerSqFt: number;
  highPerSqFt: number; observationCount: number; reviewedAtUtc: string; validUntilUtc: string;
  label: string; notice: string;
}

export interface MarketPriceRange extends Omit<BrokerPriceRange, 'reviewedAtUtc'> {
  basis: 'AiSuggested' | 'BrokerReviewed';
  reviewedAtUtc: string | null; generatedAtUtc: string | null; providers: string[];
  sourceCount?: number; evidenceUrl?: string | null; reviewStatus?: string; groundingStatus?: string; typicalPerCent?: number | null;
}

export interface PublicResearchEvidence {
  researchId: string; locality: string; district: string; researchStatus: string; reviewStatus: string; groundingStatus: string;
  sourceCategory: string; searchAttributionHtml: string; limitations: string[];
  evidence: { id: string; sourceName: string; sourceUrl: string; sourceCategory: string; verificationStatus: string;
    observationDate: string | null; retrievedAtUtc: string; locationDescription: string; distanceMeters: number | null;
    originalArea: number; originalAreaUnit: string; originalAskingPrice: number; ratePerCent: number | null; ratePerSqFt: number | null }[];
}
function validateMarketPriceRange(range: MarketPriceRange | null): void {
  if (range?.basis === 'AiSuggested' && (range.groundingStatus !== 'AuthorizedSourcesRetrieved' || range.reviewStatus !== 'PassedEvidenceReview' || (range.sourceCount ?? 0) < 3))
    throw new ApiUnavailableError('Saved AI output has insufficient grounded evidence. Use the updated research workflow.');
  if (range != null && (!['AiSuggested', 'BrokerReviewed'].includes(range.basis) ||
      !Number.isFinite(range.lowPerCent) || !Number.isFinite(range.highPerCent) || range.lowPerCent <= 0 || range.highPerCent < range.lowPerCent ||
      !Number.isFinite(range.lowPerSqFt) || !Number.isFinite(range.highPerSqFt) || range.lowPerSqFt <= 0 || range.highPerSqFt < range.lowPerSqFt)) {
    throw new ApiUnavailableError('The saved price range could not be validated.');
  }
}

// Centralized Typed API Client for Greenart Mobile Application
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

import type { MarketplaceListing } from '@greenart/shared-types';

type LegacyListingResponse = Omit<MarketplaceListing,
  'coordinates' | 'createdAt' | 'updatedAt' | 'images' | 'documentsAvailable'> & {
  latitude: number;
  longitude: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  images?: MarketplaceListing['images'] | null;
  documentsAvailable?: MarketplaceListing['documentsAvailable'] | null;
};

type CreateMarketplaceListingRequest = Pick<MarketplaceListing,
  'title' | 'description' | 'locality' | 'district' | 'state' | 'taluk' | 'streetAddress' |
  'surveyNumber' | 'landUsage' | 'extentCent' | 'askingPriceTotal'> & MarketplaceListing['coordinates'];

function toMarketplaceListing(response: LegacyListingResponse): MarketplaceListing {
  const { latitude, longitude, createdAtUtc, updatedAtUtc, images, documentsAvailable, ...listing } = response;
  return {
    ...listing,
    coordinates: { latitude, longitude },
    createdAt: createdAtUtc,
    updatedAt: updatedAtUtc,
    images: Array.isArray(images) ? images : [],
    documentsAvailable: Array.isArray(documentsAvailable) ? documentsAvailable : [],
  };
}

export class ApiUnavailableError extends Error {
  constructor(message: string = 'Could not reach the server. Please try again.') {
    super(message);
    this.name = 'ApiUnavailableError';
    Object.setPrototypeOf(this, ApiUnavailableError.prototype);
  }
}

export class ApiValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'ApiValidationError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiValidationError.prototype);
  }
}

export class LocalityApiError extends Error {
  constructor(message: string, public readonly code: string = 'geocoding_unavailable') {
    super(message);
    this.name = 'LocalityApiError';
  }
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
  sectionLabel?: string;
}

export interface AskingPriceReferenceDto {
  listingCount: number;
  medianRatePerSqFt: number;
  medianRatePerCent: number;
  minRatePerSqFt: number;
  maxRatePerSqFt: number;
  notice: string;
  sectionLabel?: string;
}

export interface TotalValuationDto {
  totalEstimatedPrice: number;
  totalPriceMin: number;
  totalPriceMax: number;
  areaValue: number;
  areaUnit: string;
  equivalentSqFt: number;
  equivalentCents: number;
  totalGuidelinePrice?: number;
}

export interface ValuationFactorBreakdownDto {
  baseLocalityRatePerCent: number;
  roadFrontageAdjustmentPerCent: number;
  amenitiesAdjustmentPerCent: number;
  roadFrontageType: string;
  surroundingAmenitiesType: string;
  roadAdjustmentReason: string;
  amenityAdjustmentReason: string;
}

export interface AiLandPriceIntelligenceResponse {
  status: 'Success' | 'Fallback';
  targetCoordinates: { latitude: number; longitude: number };
  locality: string;
  district: string;
  landUsage: string;
  estimatedCurrentPricePerCent: number;
  estimatedCurrentPricePerSqFt: number;
  priceRangeSummary: string;
  marketSentiment: string;
  growthDrivers: string[];
  negotiationTips: string[];
  dueDiligenceChecklist: string[];
  governmentGuidelineReference?: GuidelineReferenceDto;
  guidelineLookupStatus?: string | null;
  guidelineLookupMessage?: string | null;
  totalValuation?: TotalValuationDto;
  model: string;
  generatedAtUtc: string;
  factorBreakdown?: ValuationFactorBreakdownDto;
  sectionLabel?: string;
}

export interface SourceCitationDto {
  title: string;
  url: string;
  portal: string;
}

export interface LiveMarketCompsDto {
  minPricePerCentLakhs: number;
  maxPricePerCentLakhs: number;
  pricePerSqFtRange: string;
  comparableListingsCount: number;
  keyLandmarksUsed: string[];
  sourceSummary: string;
  sourcePortals: string[];
  resolvedLocality: string;
  citations?: SourceCitationDto[];
  microMarketTier?: string;
  minPricePerSqFt?: number;
  maxPricePerSqFt?: number;
  pricePerAcreLakhs?: number | null;
  confidenceLevel?: string;
  valuationRationale?: string;
  isLiveSearchGrounded?: boolean;
}

export interface EstimateSuccessResponse {
  status: 'Success';
  targetCoordinates: { latitude: number; longitude: number };
  searchRadiusMeters: number;
  comparableRecordCount: number;
  confidence: 'High' | 'Moderate' | 'Low' | string;
  priceRangePerCent: PriceRangeDto;
  priceRangePerSqFt: PriceRangeDto;
  earliestRecordDate: string;
  latestRecordDate: string;
  sourceBreakdown: SourceCategoryBreakdownDto[];
  governmentGuidelineReference?: GuidelineReferenceDto;
  guidelineLookupStatus?: string | null;
  guidelineLookupMessage?: string | null;
  disclaimer: string;
  askingPriceReference?: AskingPriceReferenceDto;
  totalValuation?: TotalValuationDto;
  calculationExplanation?: string;
  factorBreakdown?: ValuationFactorBreakdownDto;
  sectionLabel?: string;
  liveMarketComps?: LiveMarketCompsDto;
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
  guidelineLookupStatus?: string | null;
  guidelineLookupMessage?: string | null;
  askingPriceReference?: AskingPriceReferenceDto;
  totalGuidelineValuation?: number;
  factorBreakdown?: ValuationFactorBreakdownDto;
  sectionLabel?: string;
  liveMarketComps?: LiveMarketCompsDto;
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

export const DEFAULT_FALLBACK_LAND_RECORDS: LandRecordDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Sulur',
    locality: 'Kannampalayam',
    streetOrLandmark: 'Trichy Road Branch',
    surveyNumber: 'SF 142/2A',
    latitude: 11.0015,
    longitude: 77.0878,
    landUsage: 'Residential',
    originalArea: 3.5,
    originalUnit: 'Cent',
    originalPrice: 3675000,
    normalizedRatePerCent: 1050000,
    normalizedRatePerSqFt: 2410,
    sourceCategory: 'VerifiedTransaction',
    sourceReference: 'SRO Sulur Doc 3412/2023',
    observationDate: '2023-11-14T00:00:00Z',
    verificationStatus: 'Verified',
    isSynthetic: false,
    notes: 'Registered sale deed; rectangular plot facing 30ft panchayat road.',
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Sulur',
    locality: 'Kannampalayam',
    streetOrLandmark: 'Green Enclave Layout',
    surveyNumber: 'SF 144/1',
    latitude: 11.0021,
    longitude: 77.0869,
    landUsage: 'Residential',
    originalArea: 4.0,
    originalUnit: 'Cent',
    originalPrice: 4400000,
    normalizedRatePerCent: 1100000,
    normalizedRatePerSqFt: 2525,
    sourceCategory: 'VerifiedTransaction',
    sourceReference: 'SRO Sulur Doc 1089/2024',
    observationDate: '2024-02-20T00:00:00Z',
    verificationStatus: 'Verified',
    isSynthetic: false,
    notes: 'Verified transaction; DTCP approved layout.',
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Sulur',
    locality: 'Kannampalayam',
    streetOrLandmark: 'SF 143 Adjacent',
    surveyNumber: 'SF 143',
    latitude: 11.0008,
    longitude: 77.0881,
    landUsage: 'Residential',
    originalArea: 5.2,
    originalUnit: 'Cent',
    originalPrice: 5096000,
    normalizedRatePerCent: 980000,
    normalizedRatePerSqFt: 2250,
    sourceCategory: 'AdvertisedAskingPrice',
    sourceReference: 'Local Broker Listing #KP-94',
    observationDate: '2024-04-10T00:00:00Z',
    verificationStatus: 'Unverified',
    isSynthetic: false,
    notes: 'Asking rate in local classifieds; negotiation margin expected.',
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Sulur',
    locality: 'Kannampalayam',
    streetOrLandmark: 'TNREGINET Guideline Street 14',
    surveyNumber: 'SF 142 to 148',
    latitude: 11.0012,
    longitude: 77.0874,
    landUsage: 'Residential',
    originalArea: 1.0,
    originalUnit: 'Cent',
    originalPrice: 650000,
    normalizedRatePerCent: 650000,
    normalizedRatePerSqFt: 1492.20,
    sourceCategory: 'GovernmentGuideline',
    sourceReference: 'TNREGINET 2024 Revaluation',
    observationDate: '2024-07-01T00:00:00Z',
    verificationStatus: 'Verified',
    isSynthetic: false,
    notes: 'Official government guideline valuation benchmark.',
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Sulur',
    locality: 'Kannampalayam',
    streetOrLandmark: 'Manoj Nagar Extension',
    surveyNumber: 'SF 149/3',
    latitude: 11.0035,
    longitude: 77.0855,
    landUsage: 'Residential',
    originalArea: 3.0,
    originalUnit: 'Cent',
    originalPrice: 3240000,
    normalizedRatePerCent: 1080000,
    normalizedRatePerSqFt: 2479,
    sourceCategory: 'InternalSurveyorObservation',
    sourceReference: 'Field Assessment #TN-CBE-2024-012',
    observationDate: '2024-05-18T00:00:00Z',
    verificationStatus: 'Verified',
    isSynthetic: false,
    notes: 'Verified field surveyor assessment.',
  },
  {
    id: '11111111-1111-1111-1111-111111111201',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Sulur',
    locality: 'Sulur',
    streetOrLandmark: 'Sulur Air Force Station Road',
    surveyNumber: 'SF 210/1',
    latitude: 11.0280,
    longitude: 77.1260,
    landUsage: 'Residential',
    originalArea: 4.5,
    originalUnit: 'Cent',
    originalPrice: 3600000,
    normalizedRatePerCent: 800000,
    normalizedRatePerSqFt: 1836.55,
    sourceCategory: 'VerifiedTransaction',
    sourceReference: 'SRO Sulur Doc 4501/2023',
    observationDate: '2023-12-05T00:00:00Z',
    verificationStatus: 'Verified',
    isSynthetic: false,
  },
  {
    id: '11111111-1111-1111-1111-111111111301',
    country: 'India',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    taluk: 'Coimbatore North',
    locality: 'Saravanampatti',
    streetOrLandmark: 'Sathy Road / IT Park Road',
    surveyNumber: 'SF 318/2',
    latitude: 11.0820,
    longitude: 76.9980,
    landUsage: 'Residential',
    originalArea: 5.0,
    originalUnit: 'Cent',
    originalPrice: 6000000,
    normalizedRatePerCent: 1200000,
    normalizedRatePerSqFt: 2754.82,
    sourceCategory: 'VerifiedTransaction',
    sourceReference: 'SRO Gandhipuram Doc 8820/2023',
    observationDate: '2023-10-18T00:00:00Z',
    verificationStatus: 'Verified',
    isSynthetic: false,
  },
];

const getApiBaseUrl = (): string => {
  const envUrl = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ? process.env.EXPO_PUBLIC_API_URL : '';

  // 1. Web browser runtime: use window.location
  if (Platform.OS === 'web') {
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      const host = window.location.hostname;
      if (host.includes('vercel.app')) {
        return 'https://greenartapp-1.onrender.com/api/v1';
      }
      return `http://${host}:5039/api/v1`;
    }
    return envUrl || 'http://localhost:5039/api/v1';
  }

  // 2. Native runtime (Physical Device in Expo Go or Emulator):
  // If explicitly configured with a non-localhost remote URL (Render, AWS, domain), use it
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('10.0.2.2')) {
    return envUrl;
  }

  // 3. Physical phone in Expo Go: auto-detect host computer IP from Metro bundle URL or Expo Constants
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any)?.manifest?.debuggerHost ||
      (Constants as any)?.linkingUri;

    if (hostUri && typeof hostUri === 'string') {
      const match = hostUri.match(/(?:exp:\/\/|https?:\/\/)?([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        const detectedUrl = `http://${match[1]}:5039/api/v1`;
        return detectedUrl;
      }
    }
  } catch {
    // Continue
  }

  try {
    const scriptURL = (NativeModules as any)?.SourceCode?.scriptURL;
    if (typeof scriptURL === 'string') {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        const detectedUrl = `http://${match[1]}:5039/api/v1`;
        return detectedUrl;
      }
    }
  } catch {
    // Fall back to emulator/default
  }

  // 4. Android runtime (Emulator vs Physical Device):
  if (Platform.OS === 'android') {
    const isEmulator = (Platform.constants as any)?.Brand === 'google' ||
      ((Platform.constants as any)?.Model && String((Platform.constants as any)?.Model).toLowerCase().includes('emulator')) ||
      ((Platform.constants as any)?.Model && String((Platform.constants as any)?.Model).toLowerCase().includes('sdk'));

    if (isEmulator) {
      return 'http://10.0.2.2:5039/api/v1';
    }
    // Physical Android device in Expo Go (cellular 4G or external WiFi): connect to live cloud backend
    return 'https://greenartapp-1.onrender.com/api/v1';
  }

  return envUrl || 'https://greenartapp-1.onrender.com/api/v1';
};

class MobileApiClient {
  private activeBaseUrl: string | null = null;

  public getBaseUrl(): string {
    if (this.activeBaseUrl) return this.activeBaseUrl;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem('greenart_custom_api_url');
      if (saved) {
        this.activeBaseUrl = saved;
        return saved;
      }
    }
    this.activeBaseUrl = getApiBaseUrl();
    return this.activeBaseUrl;
  }

  public setBaseUrl(url: string): void {
    let clean = url.trim();
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    if (!clean.endsWith('/api/v1') && !clean.includes('/api/')) {
      clean = `${clean}/api/v1`;
    }
    this.activeBaseUrl = clean;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      try { window.sessionStorage.setItem('greenart_custom_api_url', clean); } catch { }
    }
  }

  public async testUrl(url: string): Promise<{ success: boolean; message: string }> {
    let clean = url.trim();
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    if (!clean.endsWith('/api/v1') && !clean.includes('/api/')) {
      clean = `${clean}/api/v1`;
    }
    const startTime = Date.now();
    try {
      const resp = await this.doFetch(`${clean}/health`, { headers: { Accept: 'application/json' } }, 6000);
      const elapsed = Date.now() - startTime;
      if (resp.ok || resp.status === 200 || resp.status === 503) {
        return { success: true, message: `Connected! Response received in ${elapsed}ms.` };
      }
      return { success: false, message: `Server replied with HTTP ${resp.status}.` };
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err?.message || 'Host unreachable'}` };
    }
  }

  private async doFetch(url: string, options: RequestInit = {}, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const callerSignal = options.signal;
    const abort = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    callerSignal?.addEventListener('abort', abort, { once: true });
    const timeoutId = setTimeout(abort, timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener('abort', abort);
    }
  }

  private async fetchWithTimeout(urlPathOrFull: string, options: RequestInit = {}, timeoutMs?: number): Promise<Response> {
    const primaryBase = this.getBaseUrl();
    const isFullUrl = urlPathOrFull.startsWith('http');
    const primaryUrl = isFullUrl
      ? urlPathOrFull
      : `${primaryBase}${urlPathOrFull.startsWith('/') ? '' : '/'}${urlPathOrFull}`;
    const effectiveTimeout = timeoutMs ?? (primaryBase.includes('onrender.com') ? 35000 : 5000);

    try {
      return await this.doFetch(primaryUrl, options, effectiveTimeout);
    } catch (primaryErr: any) {
      // Keep requests on the configured environment. An uncertain OTP send must
      // never be replayed against another backend or replace the active API URL.
      const isNetFailed = primaryErr?.message?.includes('Network request failed') ||
        primaryErr?.message?.includes('Failed to fetch') ||
        primaryErr?.name === 'TypeError';

      if (isNetFailed) {
        throw new Error(`Cannot reach API at ${primaryBase}. Check that backend is running and phone is on the same network.`);
      }

      throw primaryErr;
    }
  }

  async getHealth(): Promise<HealthStatusResponse> {
    try {
      const response = await this.fetchWithTimeout(`/health`, {
        headers: { Accept: 'application/json' },
      }, 3500);
      if (!response.ok) return { status: 'Degraded' };
      return (await response.json()) as HealthStatusResponse;
    } catch {
      return { status: 'Offline' };
    }
  }

  async generatePriceResearch(input: { requestId: string; locality: string; district: string; latitude: number; longitude: number; landUsage: number; roadAccess: string; area?: number; areaUnit?: string; taluk?: string }, accessToken: string): Promise<{ range: MarketPriceRange | null; status: string; cached: boolean; message: string }> {
    const response = await this.fetchWithTimeout('/pricing/research', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input),
    }, 130000);
    if (!response.ok) {
      let message = response.status === 401 ? 'Your session has expired. Sign in again to generate an AI suggestion.' : 'Could not complete AI research. Refresh saved pricing before trying again.';
      try { const body = await response.json(); message = body.error || message; } catch { }
      throw new ApiUnavailableError(message);
    }
    const result = await response.json();
    validateMarketPriceRange(result.range);
    return result;
  }

  async getResearchEvidence(id: string, signal?: AbortSignal): Promise<PublicResearchEvidence> {
    const response = await this.fetchWithTimeout(`/pricing/research/${encodeURIComponent(id)}/evidence`, { signal, headers: { Accept: 'application/json' } }, 10000);
    if (!response.ok) throw new ApiUnavailableError('Supporting evidence is unavailable.');
    return await response.json();
  }

  async getMarketPriceRange(latitude: number, longitude: number, landUsage: number, roadAccess: string, signal?: AbortSignal, area?: number, areaUnit?: string): Promise<{ range: MarketPriceRange | null }> {
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), landUsage: String(landUsage), roadAccess });
    if (area != null && Number.isFinite(area) && area > 0) { query.set('area', String(area)); query.set('areaUnit', areaUnit || 'Cent'); }
    const response = await this.fetchWithTimeout(`/pricing/market-range?${query}`, { signal, headers: { Accept: 'application/json' } }, 10000);
    if (response.status === 404) throw new ApiUnavailableError('Pricing requires the updated backend. Restart the backend, then retry pricing.');
    if (!response.ok) throw new ApiUnavailableError('Price research is temporarily unavailable.');
    const result = await response.json();
    validateMarketPriceRange(result.range);
    return result;
  }

  async getBrokerPriceRange(latitude: number, longitude: number, landUsage: number, roadAccess: string, signal?: AbortSignal): Promise<{ range: BrokerPriceRange | null }> {
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), landUsage: String(landUsage), roadAccess });
    const response = await this.fetchWithTimeout(`/pricing/broker-range?${query}`, { signal, headers: { Accept: 'application/json' } }, 10000);
    if (!response.ok) throw new ApiUnavailableError('Broker-reviewed pricing is temporarily unavailable.');
    return await response.json();
  }

  async calculateEstimate(
    latitude: number,
    longitude: number,
    landUsage: number = 1,
    radiusMeters: number = 1000,
    localityName?: string,
    districtName?: string,
    roadFrontage?: string,
    surroundingAmenities?: string, targetArea?: number, targetAreaUnit?: number
  ): Promise<EstimateApiResponse> {
    let response: Response;
    try {
      response = await this.fetchWithTimeout(`/estimates/calculate`, {
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
          locality: localityName,
          district: districtName,
          roadFrontage,
          surroundingAmenities,
          targetArea, targetAreaUnit,
        }),
      }, 45000);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new ApiUnavailableError('Valuation took too long. Please retry the calculation.');
      }
      throw new ApiUnavailableError('Could not reach the server. Please try again.');
    }

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) errorMsg = errJson.error;
        else if (errJson && errJson.message) errorMsg = errJson.message;
      } catch {
        // Not JSON
      }
      if (response.status === 400) {
        throw new ApiValidationError(errorMsg, 400);
      }
      throw new ApiUnavailableError('The valuation service returned an error. Please retry shortly.');
    }

    return (await response.json()) as EstimateApiResponse;
  }

  async getAiLandIntelligence(
    latitude: number,
    longitude: number,
    landUsage: number = 1,
    targetArea?: number,
    targetAreaUnit?: number,
    locality?: string,
    district?: string,
    roadFrontage?: string,
    surroundingAmenities?: string
  ): Promise<AiLandPriceIntelligenceResponse> {
    let response: Response;
    try {
      response = await this.fetchWithTimeout(`/estimates/ai-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
          landUsage,
          targetArea,
          targetAreaUnit,
          locality,
          district,
          roadFrontage,
          surroundingAmenities,
        }),
      });
    } catch {
      throw new ApiUnavailableError('Could not reach the server. Please try again.');
    }

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) errorMsg = errJson.error;
        else if (errJson && errJson.message) errorMsg = errJson.message;
      } catch { }
      if (response.status === 400) {
        throw new ApiValidationError(errorMsg, 400);
      }
      throw new ApiUnavailableError('Could not reach the server. Please try again.');
    }

    return (await response.json()) as AiLandPriceIntelligenceResponse;
  }

  async getLocalities(): Promise<LocalityReference[]> {
    try {
      const response = await this.fetchWithTimeout(`/reference/localities`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load localities: ${response.statusText}`);
      }
      const data = (await response.json()) as LocalityReference[];
      return Array.isArray(data) ? data : [];
    } catch {
      // An unavailable reference source must not invent counts or guideline prices.
      return [];
    }
  }

  async getLandRecords(params?: {
    locality?: string;
    landUsage?: number;
    sourceCategory?: number;
    district?: string;
  }): Promise<LandRecordDto[]> {
    try {
      const query = new URLSearchParams();
      if (params?.locality) query.append('locality', params.locality);
      if (params?.landUsage !== undefined) query.append('landUsage', params.landUsage.toString());
      if (params?.sourceCategory !== undefined) query.append('sourceCategory', params.sourceCategory.toString());
      if (params?.district) query.append('district', params.district);

      const path = `/land-records${query.toString() ? `?${query.toString()}` : ''}`;
      const response = await this.fetchWithTimeout(path, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load land records: ${response.statusText}`);
      }
      const data = (await response.json()) as LandRecordDto[];
      if (Array.isArray(data)) return data;
      return [];
    } catch {
      // Do not return fallback records as verified evidence
      return [];
    }
  }

  async getNearbyLandRecords(
    latitude: number,
    longitude: number,
    radiusMeters: number = 1000,
    landUsage?: number
  ): Promise<NearbyLandRecordDto[]> {
    try {
      const query = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radiusMeters: radiusMeters.toString(),
      });
      if (landUsage !== undefined) {
        query.append('landUsage', landUsage.toString());
      }

      const response = await this.fetchWithTimeout(`/land-records/nearby?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as NearbyLandRecordDto[];
    } catch {
      // Do not return fallback records as verified nearby evidence
      return [];
    }
  }

  private async requestLocality(path: string, signal?: AbortSignal): Promise<Response> {
    try {
      // Keep searches and details on the configured backend; do not switch environments.
      const response = await this.doFetch(`${this.getBaseUrl()}${path}`, { signal, headers: { Accept: 'application/json' } }, 12000);
      if (response.status === 404 && !path.startsWith('/localities/search')) return response;
      if (!response.ok) {
        let payload: any = null;
        try { payload = await response.json(); } catch { }
        throw new LocalityApiError(payload?.error || payload?.message || 'Location search is temporarily unavailable. Please try again or choose on the map.', payload?.code);
      }
      return response;
    } catch (error: any) {
      if (signal?.aborted) { const cancelled = new Error('Request cancelled'); cancelled.name = 'AbortError'; throw cancelled; }
      if (error instanceof LocalityApiError) throw error;
      throw new LocalityApiError(error?.name === 'AbortError'
        ? 'Location search timed out. Please try again or choose on the map.'
        : 'Cannot reach location search. Check your connection and try again, or choose on the map.');
    }
  }

  async searchLocalities(query: string, signal?: AbortSignal): Promise<LocalitySuggestionDto[]> {
    if (!query || query.trim().length < 2) return [];
    const response = await this.requestLocality(`/localities/search?q=${encodeURIComponent(query.trim())}`, signal);
    let data: any;
    try { data = await response.json(); } catch { throw new LocalityApiError('Location search returned an unreadable response. Please try again.', 'geocoding_invalidresponse'); }
    if (!Array.isArray(data) || data.some(item => typeof item?.placeId !== 'string' || typeof item?.mainText !== 'string'))
      throw new LocalityApiError('Location search returned an unreadable response. Please try again.', 'geocoding_invalidresponse');
    return data as LocalitySuggestionDto[];
  }

  async getLocalityDetails(placeId: string, signal?: AbortSignal): Promise<LocalityDetailsDto | null> {
    if (!placeId.trim()) return null;
    const response = await this.requestLocality(`/localities/details?placeId=${encodeURIComponent(placeId.trim())}`, signal);
    if (response.status === 404) return null;
    let details: LocalityDetailsDto;
    try { details = await response.json(); } catch { throw new LocalityApiError('Could not read the selected location. Please try again.'); }
    if (!Number.isFinite(details?.latitude) || !Number.isFinite(details?.longitude) ||
        Math.abs(details.latitude) > 90 || Math.abs(details.longitude) > 180)
      throw new LocalityApiError('The selected place did not return valid coordinates. Please choose another result.');
    return details;
  }

  async geocodeAddress(address: string): Promise<LocalityDetailsDto | null> {
    if (!address.trim()) return null;
    const response = await this.requestLocality(`/localities/geocode?address=${encodeURIComponent(address.trim())}`);
    if (response.status === 404) return null;
    return await response.json() as LocalityDetailsDto;
  }

  public async loginWithGoogle(idToken: string): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/auth/google',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ idToken }),
      },
      12000
    );
    if (!response.ok) {
      let errMsg = 'Google sign-in failed.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return await response.json();
  }

  public async requestOtp(email: string, fullName: string, phoneNumber?: string): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/auth/register/request-otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, fullName, phoneNumber }),
      },
      12000
    );
    if (!response.ok) {
      let errMsg = 'Failed to request verification code.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return await response.json();
  }

  public async verifyOtp(email: string, otp: string): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/auth/register/verify-otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, otp }),
      },
      10000
    );
    if (!response.ok) {
      let errMsg = 'Verification code is invalid or expired.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return await response.json();
  }

  public async completeRegistration(
    email: string,
    password: string,
    tempVerificationToken: string,
    fullName?: string,
    phoneNumber?: string
  ): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/auth/register/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password, tempVerificationToken, fullName, phoneNumber }),
      },
      12000
    );
    if (!response.ok) {
      let errMsg = 'Failed to complete registration.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return await response.json();
  }

  public async loginWithPassword(emailOrUsername: string, password: string): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ emailOrUsername, password }),
      },
      30000
    );
    if (!response.ok) {
      let errMsg = 'Invalid email/username or password.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return await response.json();
  }

  public async refreshTokens(refreshToken: string): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/auth/refresh',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      },
      8000
    );
    if (!response.ok) return null;
    return await response.json();
  }

  public async revokeToken(refreshToken: string): Promise<void> {
    try {
      await this.fetchWithTimeout(
        '/auth/revoke',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        5000
      );
    } catch { }
  }

  public async getCurrentUser(accessToken: string): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/me',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
      8000
    );
    if (!response.ok) return null;
    return await response.json();
  }

  public async updateProfile(
    fullName: string,
    phoneNumber?: string,
    avatarUrl?: string,
    accessToken?: string
  ): Promise<any> {
    const response = await this.fetchWithTimeout(
      '/me',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ fullName, phoneNumber, avatarUrl }),
      },
      10000
    );

    if (!response.ok) {
      let errMsg = 'Failed to update profile.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return await response.json();
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string,
    accessToken?: string
  ): Promise<void> {
    const response = await this.fetchWithTimeout(
      '/auth/change-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      10000
    );

    if (!response.ok) {
      let errMsg = 'Failed to update password.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
  }

  public async getMarketplaceListings(
    district?: string,
    landUsage?: number,
    maxPrice?: number,
    search?: string
  ): Promise<MarketplaceListing[]> {
    const params = new URLSearchParams();
    if (district && district !== 'All') params.append('district', district);
    if (landUsage && landUsage > 0) params.append('landUsage', landUsage.toString());
    if (maxPrice && maxPrice > 0) params.append('maxPrice', maxPrice.toString());
    if (search && search.trim()) params.append('search', search.trim());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await this.fetchWithTimeout(
      `/marketplace/listings${qs}`,
      { headers: { Accept: 'application/json' } },
      8000
    );

    if (!response.ok) return [];
    return ((await response.json()) as LegacyListingResponse[]).map(toMarketplaceListing);
  }

  public async getMyMarketplaceListings(accessToken?: string): Promise<MarketplaceListing[]> {
    if (!accessToken || !accessToken.includes('.')) return [];
    try {
      const response = await this.fetchWithTimeout(
        '/marketplace/listings/my',
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
        8000
      );

      if (!response.ok) return [];
      return ((await response.json()) as LegacyListingResponse[]).map(toMarketplaceListing);
    } catch {
      return [];
    }
  }

  public async createMarketplaceListing(data: CreateMarketplaceListingRequest, accessToken?: string): Promise<MarketplaceListing> {
    const response = await this.fetchWithTimeout(
      '/marketplace/listings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(data),
      },
      12000
    );

    if (!response.ok) {
      let errMsg = 'Failed to submit marketplace listing.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return toMarketplaceListing(await response.json());
  }

  public async submitListingEnquiry(
    listingId: string,
    message: string,
    offeredPriceTotal?: number,
    accessToken?: string
  ): Promise<any> {
    const response = await this.fetchWithTimeout(
      `/marketplace/listings/${listingId}/enquiries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ message, offeredPriceTotal }),
      },
      10000
    );

    if (!response.ok) {
      let errMsg = 'Failed to submit enquiry.';
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch { }
      throw new Error(errMsg);
    }
    return await response.json();
  }

  public async getMyListingEnquiries(accessToken?: string): Promise<any[]> {
    if (!accessToken || !accessToken.includes('.')) return [];
    try {
      const response = await this.fetchWithTimeout(
        '/marketplace/enquiries/my',
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
        8000
      );

      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }
}

export const mobileApi = new MobileApiClient();


