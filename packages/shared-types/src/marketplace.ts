import { AreaUnit, ConfidenceLevel, LandUsageType, SourceCategory, VerificationStatus } from './enums';
import { Coordinates } from './landRecord';

/**
 * Lifecycle status of a land marketplace listing.
 */
export enum ListingStatus {
  Draft = 'Draft',
  PendingReview = 'PendingReview',
  Active = 'Active',
  Rejected = 'Rejected',
  Sold = 'Sold',
}

/**
 * Type of legal and revenue documents associated with land parcels.
 */
export enum DocumentType {
  PattaChitta = 'PattaChitta',
  RegisteredSaleDeed = 'RegisteredSaleDeed',
  FMBPlan = 'FMBPlan',
  EncumbranceCertificate = 'EncumbranceCertificate',
  SurveyReport = 'SurveyReport',
  Other = 'Other',
}

/**
 * Verification progress of submitted legal land documents.
 */
export enum DocumentStatus {
  Pending = 'Pending',
  Extracted = 'Extracted',
  Verified = 'Verified',
  Rejected = 'Rejected',
}

/**
 * Entity type of the land seller.
 */
export enum SellerType {
  IndividualOwner = 'IndividualOwner',
  Promoter = 'Promoter',
  LicensedAgent = 'LicensedAgent',
}

/**
 * Document reference associated with a plot listing.
 */
export interface ListingDocumentItem {
  type: DocumentType;
  verified: boolean;
  documentName: string;
  surveyNumber?: string;
}

/**
 * Core marketplace listing representing a land plot for sale.
 */
export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  sellerId: string;
  sellerName: string;
  sellerPhone?: string;
  sellerType: SellerType;
  isSellerVerified: boolean;

  // Geographic & Revenue Identifiers
  state: string;
  district: string;
  taluk?: string;
  locality: string;
  streetAddress?: string;
  surveyNumber?: string;
  coordinates: Coordinates;

  // Plot Extent & Classification
  landUsage: LandUsageType;
  extentCent: number;
  extentSqFt: number;
  roadWidthFeet?: number;
  facing?: string;

  // Pricing Architecture (Distinct from valuation)
  askingPriceTotal: number;
  askingRatePerCent: number;
  askingRatePerSqFt: number;

  // Intelligence Benchmarks (For buyer transparency; never conflated with asking price)
  guidelineRatePerCent?: number;
  guidelineRatePerSqFt?: number;
  estimatedMarketMedianPerCent?: number;

  // Moderation & Metadata
  status: ListingStatus;
  rejectionReason?: string;
  moderationNotes?: string;
  images: string[];
  documentsAvailable: ListingDocumentItem[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Direct buyer enquiry submitted for a specific listing.
 */
export interface ListingEnquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  offeredPriceTotal?: number;
  message: string;
  submittedAt: string; // ISO 8601
}

/**
 * Secure document submission record.
 */
export interface DocumentSubmission {
  id: string;
  userId: string;
  uploaderName: string;
  fileName: string;
  fileSizeBytes: number;
  fileChecksumSha256: string;
  documentType: DocumentType;
  status: DocumentStatus;
  surveyNumber?: string;
  locality?: string;
  district?: string;
  extractedMetadata?: {
    pattaNumber?: string;
    surveyNumber?: string;
    ownerName?: string;
    extentCent?: number;
    subDivision?: string;
  };
  reviewNotes?: string;
  reviewedBy?: string;
  submittedAt: string; // ISO 8601
  reviewedAt?: string;  // ISO 8601
}

/**
 * Valuation certificate structure for downloadable/printable PDF reports.
 */
export interface ValuationPdfReport {
  reportId: string;
  generatedAt: string; // ISO 8601
  targetLocation: {
    locality: string;
    district: string;
    state: string;
    coordinates: Coordinates;
  };
  landUsage: LandUsageType;
  extentCent: number;
  extentSqFt: number;
  valuationRange: {
    minRatePerCent: number;
    p25RatePerCent: number;
    medianRatePerCent: number;
    p75RatePerCent: number;
    maxRatePerCent: number;
    totalEstimatedMedianValue: number;
    unit: AreaUnit;
  };
  guidelineReference?: {
    guidelineRatePerCent: number;
    guidelineRatePerSqFt: number;
    locality: string;
    surveyNumber?: string;
  };
  factorBreakdown?: {
    baseLocalityRatePerCent: number;
    roadFrontageAdjustmentPerCent: number;
    amenitiesAdjustmentPerCent: number;
    roadFrontageType: string;
    surroundingAmenitiesType: string;
    roadAdjustmentReason: string;
    amenityAdjustmentReason: string;
  };
  comparablesCount: number;
  comparables: Array<{
    id: string;
    locality: string;
    ratePerCent: number;
    distanceMeters: number;
    observationDate: string;
    sourceCategory: SourceCategory;
    verificationStatus: VerificationStatus;
  }>;
  confidence: ConfidenceLevel;
  verificationHash: string;
  disclaimer: string;
}

