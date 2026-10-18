/**
 * Strict data source category classification.
 * These categories must NEVER be interchanged or conflated.
 */
export enum SourceCategory {
  GovernmentGuideline = 'GovernmentGuideline',
  VerifiedTransaction = 'VerifiedTransaction',
  AdvertisedAskingPrice = 'AdvertisedAskingPrice',
  ClientResearch = 'ClientResearch',
  SyntheticFixture = 'SyntheticFixture',
}

export enum VerificationStatus {
  Unverified = 'Unverified',
  PendingReview = 'PendingReview',
  Verified = 'Verified',
  Rejected = 'Rejected',
  Archived = 'Archived',
}

export enum LandUsageType {
  Residential = 'Residential',
  Commercial = 'Commercial',
  AgriculturalWet = 'AgriculturalWet',
  AgriculturalDry = 'AgriculturalDry',
  Industrial = 'Industrial',
  MixedUse = 'MixedUse',
}

export enum ConfidenceLevel {
  Insufficient = 'Insufficient',
  Low = 'Low',
  Moderate = 'Moderate',
  High = 'High',
}

export enum AreaUnit {
  SqFt = 'SqFt',
  Cent = 'Cent',
  Acre = 'Acre',
  Ground = 'Ground',
  Kuzhi = 'Kuzhi',
  SqMeter = 'SqMeter',
}

