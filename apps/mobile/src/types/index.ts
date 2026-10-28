// Shared Application & Screen Types for Greenart Mobile

import { MobileTab } from '../components/FloatingBottomNav';
import {
  LandRecordDto,
  EstimateApiResponse,
  EstimateSuccessResponse,
  EstimateInsufficientDataResponse,
  LocalityReference,
  LocalitySuggestionDto,
  NearbyLandRecordDto,
  HealthStatusResponse,
} from '../services/api';
import {
  MarketplaceListing,
  DocumentSubmission,
  ValuationPdfReport,
  ListingEnquiry,
} from '@greenart/shared-types';

export type EstimateStep = 'selection' | 'result';

export interface ValuationHistoryItem {
  id: string;
  locality: string;
  district: string;
  targetLat: number;
  targetLng: number;
  landUsage: number;
  landUsageLabel: string;
  ratePerCent: number;
  ratePerSqFt: number;
  confidence: string;
  comparableCount: number;
  calculatedAt: string;
}

export type {
  MobileTab,
  LandRecordDto,
  EstimateApiResponse,
  EstimateSuccessResponse,
  EstimateInsufficientDataResponse,
  LocalityReference,
  LocalitySuggestionDto,
  NearbyLandRecordDto,
  HealthStatusResponse,
  MarketplaceListing,
  DocumentSubmission,
  ValuationPdfReport,
  ListingEnquiry,
};
