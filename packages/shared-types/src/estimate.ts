import { AreaUnit, ConfidenceLevel, LandUsageType, SourceCategory } from './enums';
import { Coordinates } from './landRecord';

export interface EstimateRequest {
  targetCoordinates: Coordinates;
  landUsage: LandUsageType;
  radiusMeters?: number; // Default: 1000m
  preferredUnit?: AreaUnit; // Cent or SqFt
}

export interface PriceRange {
  minRate: number;
  percentile25: number;
  medianRate: number;
  percentile75: number;
  maxRate: number;
  unit: AreaUnit;
}

export interface EstimateSourceBreakdown {
  category: SourceCategory;
  count: number;
}

export interface EstimateSuccessResult {
  status: 'Success';
  targetCoordinates: Coordinates;
  searchRadiusMeters: number;
  comparableRecordCount: number;
  confidence: ConfidenceLevel;
  priceRange: PriceRange;
  earliestRecordDate: string;
  latestRecordDate: string;
  sourceBreakdown: EstimateSourceBreakdown[];
  governmentGuidelineReference?: {
    guidelineRatePerCent: number;
    guidelineRatePerSqFt: number;
    locality: string;
    surveyNumber?: string;
  };
  disclaimer: string;
}

export interface EstimateInsufficientDataResult {
  status: 'InsufficientData';
  targetCoordinates: Coordinates;
  searchRadiusMeters: number;
  comparableRecordCount: number;
  minimumRequiredRecords: number;
  message: string;
  recommendations: string[];
}

export type EstimateResult = EstimateSuccessResult | EstimateInsufficientDataResult;

