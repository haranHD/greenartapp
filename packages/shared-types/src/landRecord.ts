import { AreaUnit, LandUsageType, SourceCategory, VerificationStatus } from './enums';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LandPriceRecord {
  id: string;
  country: string;
  state: string;
  district: string;
  taluk?: string;
  locality: string;
  streetOrLandmark?: string;
  surveyNumber?: string;
  coordinates: Coordinates;
  landUsage: LandUsageType;
  originalArea: number;
  originalUnit: AreaUnit;
  originalPrice: number;
  normalizedRatePerSqFt: number;
  normalizedRatePerCent: number;
  sourceCategory: SourceCategory;
  sourceReference?: string;
  observationDate: string; // ISO 8601
  retrievalDate: string;   // ISO 8601
  verificationStatus: VerificationStatus;
  isSynthetic: boolean;
  notes?: string;
}

