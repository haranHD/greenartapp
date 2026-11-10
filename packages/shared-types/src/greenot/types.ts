/**
 * Greenot Land Market Rate Analyst — TypeScript Domain Types
 * Quality-Control Standard: Deterministic evidence evaluation,
 * strict tier isolation, and reproducible auditable snapshots.
 */

export type GreenotCategory =
  | 'residential_land'
  | 'commercial_land'
  | 'agricultural_wet'
  | 'agricultural_dry'
  | 'industrial_land'
  | 'mixed_use';

export type GreenotEvidenceKind =
  | 'registered_transaction'
  | 'asking_listing'
  | 'guideline_benchmark'
  | 'broker_quote';

export type GreenotVerification =
  | 'unverified'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'quarantined';

export type GreenotAreaUnit = 'sqft' | 'cent' | 'ground' | 'acre' | 'sqm';

export type GreenotConfidenceLabel = 'high' | 'medium' | 'low' | 'insufficient';

export interface SubjectPropertyInput {
  category: GreenotCategory;
  latitude: number;
  longitude: number;
  address?: string;
  landAreaSqft?: number;
  roadWidthFt?: number;
  frontageFt?: number;
  approvalStatus?: string;
  surveyNumber?: string;
  userConfirmedLocation?: boolean;
}

export interface PropertyEvidenceItem {
  id: string;
  category: GreenotCategory;
  evidenceKind: GreenotEvidenceKind;
  verification: GreenotVerification;
  evidenceDate: string; // YYYY-MM-DD
  totalPriceInr: number;
  landAreaSqft: number;
  latitude: number;
  longitude: number;
  advertisedRatePerSqft?: number;
  locality?: string;
  district?: string;
  sourceName?: string;
  sourceUrlOrDoc?: string;
  dimensionsFt?: string; // e.g. "76x45"
  roadWidthFt?: number;
  frontageFt?: number;
  notes?: string;
  rawPayload?: Record<string, unknown>;
}

export interface ValuationOptions {
  radiusKm?: number; // Default: 1.0 km
  minComparables?: number; // Default: 3
  maxAgeDays?: number; // Default: 730 days (2 years)
  arithmeticTolerancePct?: number; // Default: 2.0%
  enableIqrOutlierFilter?: boolean; // Default: true
}

export interface ComparableEvaluation {
  id: string;
  distanceMeters: number;
  effectiveRatePerSqFt: number;
  evidenceKind: GreenotEvidenceKind;
  verification: GreenotVerification;
  isIncluded: boolean;
  exclusionReason?: string;
  arithmeticDiscrepancyPct?: number;
}

export interface ConfidenceScoreBreakdown {
  registeredTransactionsScore: number; // max 35
  locationAccuracyScore: number; // max 20
  comparableSimilarityScore: number; // max 15
  recencyScore: number; // max 10
  sourceReliabilityScore: number; // max 10
  subjectCompletenessScore: number; // max 10
  totalScore: number; // 0 - 100
}

export interface ValuationConfidence {
  score: number | null;
  label: GreenotConfidenceLabel;
  hardGateReasons: string[];
  breakdown?: ConfidenceScoreBreakdown;
}

export interface UnitRateRange {
  low: number | null;
  median: number | null;
  high: number | null;
}

export interface ValuationResult {
  status: 'ok' | 'insufficient_evidence';
  basis: 'registered_transactions' | 'asking_listings_only' | 'insufficient_evidence';
  low: number | null;
  median: number | null;
  high: number | null;
  currency: 'INR';
  unit: 'sqft';
  unitRates: {
    perCent: UnitRateRange;
    perGround: UnitRateRange;
    perAcre: UnitRateRange;
  };
  sampleCount: number;
  verifiedTransactionCount: number;
  askingListingCount: number;
  quarantinedCount: number;
  confidence: ValuationConfidence;
  comparables: ComparableEvaluation[];
  methodVersion: string;
  disclaimer: string;
}

export interface LandValueResult {
  landAreaSqft: number;
  selectedRatePerSqft: number;
  totalLandValueInr: number;
  totalLandValueFormatted: string;
}

export interface BuildingValuationInput {
  builtUpAreaSqft: number;
  constructionType: 'RCC_Framed' | 'Load_Bearing' | 'Steel_Frame';
  ageYears: number;
  condition: 'good' | 'average' | 'poor';
  replacementCostPerSqft: number;
  isDemolitionIntended?: boolean;
  repairOrDemolitionCost?: number;
}

export interface BuildingValuationResult {
  grossReplacementCost: number;
  depreciationPct: number;
  depreciatedBuildingValue: number;
  repairOrDemolitionCost: number;
  isDemolitionIntended: boolean;
  netBuildingValue: number;
  totalPropertyValue: number;
}
