# GREENART PROPERTIES — CORE LAND PRICE ESTIMATION ENGINE
## Technical Implementation & Audit Report

**System:** Greenart Properties Land Market Rate Analyst  
**Author:** Senior .NET Backend Architect & Geospatial Data Engineer  
**Date:** November 3, 2026  
**Status:** Implemented, Validated & Fully Tested (220/220 Tests Passing)  

---

## 1. Existing Implementation Findings

Prior to this implementation, a comprehensive inspection of the Clean Architecture layers was conducted (`LandPriceRecord.cs`, `EstimationEngine.cs`, `DomainEnums.cs`, `EstimateDtos.cs`, repositories, and test suites):

| Area | Prior Implementation Finding | Risk / Defect Identified |
| :--- | :--- | :--- |
| **Data Eligibility** | `IsEligibleForMarketEstimation` allowed `AdvertisedAskingPrice`, `ClientResearch`, and `PendingReview` records into the market estimation pool. | Asking prices and unverified broker estimates were blended into the primary market median, risking artificially inflated valuations without proof of registered transaction. |
| **Seed Dataset Sparsity** | The pilot seed repository (`CoimbatorePilotRepository`) contained only 2 verified completed deeds in Kannampalayam, 2 in Sulur, and 2 in Saravanampatti. | Old tests and endpoints were reaching the 3-record threshold by counting 1 unverified asking price alongside 2 verified deeds, giving a false impression of completed market consensus. |
| **Layer Blending** | Guideline values were isolated, but asking prices were directly mixed into the median rate. | Violated the core valuation principle that asking prices reflect seller sentiment before negotiations and must never dilute registered conveyance deeds. |
| **Outlier Handling** | Outlier filtering only kicked in at $N \ge 8$ using Tukey IQR. Small samples ($4 \le N \le 7$) had no outlier protection. | Zero dispersion ($\text{IQR} = 0$ or identical rates across layout plots) risked fence collapse. Small samples with 1 anomalous record distorted the sample. |
| **Total Valuation** | API lacked user-provided area inputs (`TargetArea` / `TargetAreaUnit`), returning only unit rates. | Clients and mobile apps had to manually perform area calculations and conversions, increasing client-side error risk. |

---

## 2. Changes Made

### A. Strict Domain Eligibility (`backend/Greenart.Domain/Entities/LandPriceRecord.cs`)
- Refactored `IsEligibleForMarketEstimation(DateTime asOfDate, int maxAgeMonths = 36)`:
  - Enforced that **ONLY** records with `SourceCategory == SourceCategory.VerifiedTransaction` qualify.
  - Enforced that `VerificationStatus == VerificationStatus.Verified`.
  - Enforced that `!IsSynthetic` (synthetic fixtures are strictly barred).
  - Enforced positive prices and areas (`OriginalPrice > 0`, `Area.Value > 0`, `NormalizedRatePerSqFt > 0`).
  - Enforced observation date freshness ($\le 36$ months) and valid timeline ($\ge -1$ month clock skew).
- Added `TryGetIneligibilityReason(DateTime asOfDate, int maxAgeMonths, out string reason)` for transparent auditability and moderation logging.

### B. Segregation of Three Independent Data Layers (`backend/Greenart.Application/Estimation/EstimationEngine.cs`)
- **Layer 1 — Verified Completed-Sale Market Valuation**: Formed exclusively from verified registered conveyances. Computes median, P25, P75, min, max, and confidence rating.
- **Layer 2 — Advertised Asking Price Reference**: Advertised listings within the search radius are aggregated into `AskingPriceReferenceDto` (listing count, median rate/sq.ft, median rate/cent, min, max, and clear explanatory notice). **No arbitrary 12–15% negotiation discount is applied without matched empirical evidence.**
- **Layer 3 — Statutory Government Guideline Benchmark**: TNREGINET statutory guideline values from local records or the LandLens ONE API live feed are segregated into `GuidelineReferenceDto`.

### C. Valuation Mathematics & Outlier Protection
- **Small Sample ($N = 3$)**: Preserves all 3 records without dropping; median eliminates single-tail skew without reducing sample size below threshold.
- **Small-to-Moderate Sample ($4 \le N \le 7$)**: Evaluated using **Median Absolute Deviation (MAD 3-sigma)**. Explicit zero-dispersion safety: if $\text{MAD} = 0$ (identical plot rates), all records are preserved without fence collapse.
- **Standard Sample ($N \ge 8$)**: Evaluated using **Tukey's Interquartile Range (1.5 IQR)**. Explicit zero-dispersion safety: if $\text{IQR} = 0$, all records are preserved.
- **Threshold Safeguard**: In all cases, outlier filtering is automatically aborted if dropping outliers would reduce the remaining sample below `MinimumRecordThreshold = 3`.

### D. Enriched API Contracts (`backend/Greenart.Application/DTOs/EstimateDtos.cs`)
- Added optional `TargetArea` (decimal?) and `TargetAreaUnit` (AreaUnit?) to `CalculateEstimateRequest`.
- Added `TotalValuationDto` computing total market value, total range, and equivalent total statutory guideline value.
- Enriched `EstimateSuccessResponse` and `EstimateInsufficientDataResponse` with Layer 2 asking prices, total valuation, and natural language `CalculationExplanation` while maintaining **100% backward compatibility**.

---

## 3. Updated Market-Data Eligibility Rules

To qualify for the primary market-rate estimation calculation, a record must pass **every single check** in the table below:

| Condition | Rule | Rationale |
| :--- | :--- | :--- |
| **Source Category** | `SourceCategory == VerifiedTransaction` | Only registered deeds with legally binding consideration represent closed market sales. |
| **Verification Status** | `VerificationStatus == Verified` | Pre-verification broker notes or pending surveyor documents cannot influence valuation. |
| **Synthetic Flag** | `IsSynthetic == false` | Test fixtures, demonstration data, or synthetic models are strictly rejected. |
| **Price Validity** | `OriginalPrice > 0` | Zero-price gifts, nominal transfers, or corrupt data entries are excluded. |
| **Area Validity** | `Area.Value > 0` and rates $> 0$ | Land area must be positive and measurable. |
| **Transaction Date** | Valid date $\ne \text{default}$ | Undated or unrecorded transactions are ineligible. |
| **Freshness Window** | Transaction Age $\le 36$ months | Reflects prevailing market conditions without unverified time-extrapolation inflation. |
| **Future Skew** | Transaction Age $\ge -1$ month | Prevents future-dated transactions while tolerating up to 1 month server clock skew. |

### Excluded Data Types (Preserved for Reference & Secondary Layers)
- **Advertised Asking Prices**: Redirected to Layer 2 (`AskingPriceReference`).
- **Government Guideline Values**: Redirected to Layer 3 (`GuidelineReference`).
- **Client Research / Broker Notes**: Retained in database for auditor promotion upon deed attachment.
- **Pending Review / Rejected / Archived**: Preserved for administrative audit trails.

---

## 4. Comparable-Selection Logic

```
Target Pin (Lat, Lng) + Land Usage (e.g. Residential) + Radius (e.g. 1,000m)
                     │
                     ▼
     PostGIS Spatial Distance Search (ST_DWithin)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
Layer 3: Statutory Guideline   Layer 2: Advertised Listings   Layer 1: Primary Market Pool
(TNREGINET / LandLens)         (SourceCategory = Asking)       (Verified Deeds, Verified Status,
         │                               │                      Age <= 36m, Not Synthetic)
         │                               │                                │
         │                               │                       Count < 3?
         │                               │                       ├─ Yes ──► InsufficientData
         │                               │                       └─ No  ──► Safe Outlier Evaluation
         │                               │                                           │
         └───────────────────────────────┴───────────────────────────────────────────┤
                                                                                     ▼
                                                                        EstimateSuccessResponse
```

- **Configurable Radius**: 250m to 5,000m (default: 1,000m).
- **Land Classification Strict Match**: Only records matching `request.LandUsage` (Residential, Commercial, Agricultural, Industrial) enter the comparable pool.
- **No Arbitrary Multipliers**: Road-width multipliers, Vastu premiums, or hypothetical appreciation rates are strictly forbidden.

---

## 5. Statistical Calculation Details

### Standard Percentile Formulation
Percentiles ($P_{25}, P_{50}, P_{75}$) are computed via linear interpolation on ordered rates $X = [x_1, x_2, \dots, x_N]$:
$$\text{Rank} = p \times (N - 1), \quad \text{where } p \in [0, 1]$$
$$\text{Percentile} = x_{\lfloor\text{Rank}\rfloor} + (\text{Rank} - \lfloor\text{Rank}\rfloor) \times (x_{\lceil\text{Rank}\rceil} - x_{\lfloor\text{Rank}\rfloor})$$

### Safe Outlier Handling Matrix

| Sample Size ($N$) | Method Applied | Lower Fence | Upper Fence | Zero Dispersion Safe Guard |
| :---: | :---: | :---: | :---: | :---: |
| **$N = 3$** | Sample Protection | None | None | All 3 records retained. Sample too small for outlier pruning. |
| **$4 \le N \le 7$** | Median Absolute Deviation | $M - 3 \times 1.4826 \times \text{MAD}$ | $M + 3 \times 1.4826 \times \text{MAD}$ | If $\text{MAD} = 0$, retain all records. Zero dispersion indicates high consensus. |
| **$N \ge 8$** | Tukey Interquartile Range | $Q_1 - 1.5 \times \text{IQR}$ | $Q_3 + 1.5 \times \text{IQR}$ | If $\text{IQR} = 0$, retain all records. |

In every scenario, if outlier filtering would reduce the remaining sample below $N = 3$, outlier filtering is aborted and all eligible records are retained.

---

## 6. API Contract Changes

All contract changes are strictly additive, maintaining 100% backward compatibility for existing mobile and web clients:

### Request Contract (`POST /api/v1/estimates/calculate`)
```json
{
  "latitude": 11.0012,
  "longitude": 77.0874,
  "landUsage": 1,
  "radiusMeters": 1000.0,
  "preferredUnit": 1,
  "targetArea": 5.0,
  "targetAreaUnit": 1
}
```

### Success Response (`EstimateSuccessResponse`)
```json
{
  "status": "Success",
  "targetCoordinates": { "latitude": 11.0012, "longitude": 77.0874 },
  "searchRadiusMeters": 1000.0,
  "comparableRecordCount": 3,
  "confidence": "Low",
  "priceRangePerCent": {
    "minRate": 1050000.00,
    "percentile25": 1050000.00,
    "medianRate": 1050000.00,
    "percentile75": 1100000.00,
    "maxRate": 1100000.00,
    "unit": "₹ / Cent"
  },
  "priceRangePerSqFt": {
    "minRate": 2410.47,
    "percentile25": 2410.47,
    "medianRate": 2410.47,
    "percentile75": 2525.25,
    "maxRate": 2525.25,
    "unit": "₹ / Sq.Ft"
  },
  "earliestRecordDate": "2023-11-14T00:00:00Z",
  "latestRecordDate": "2024-07-10T00:00:00Z",
  "sourceBreakdown": [
    { "category": "VerifiedTransaction", "count": 3 }
  ],
  "governmentGuidelineReference": {
    "guidelineRatePerCent": 650000.00,
    "guidelineRatePerSqFt": 1492.20,
    "locality": "Kannampalayam",
    "surveyNumber": "SF 140",
    "legalNotice": "Statutory minimum valuation benchmark from TNREGINET for stamp duty calculation. Not an open-market transaction."
  },
  "askingPriceReference": {
    "listingCount": 1,
    "medianRatePerSqFt": 2249.77,
    "medianRatePerCent": 980000.00,
    "minRatePerSqFt": 2249.77,
    "maxRatePerSqFt": 2249.77,
    "notice": "Independent asking-price reference from advertised property listings within search radius. Reflects seller expectations before negotiations. Not an agreed or completed sale price."
  },
  "totalValuation": {
    "totalEstimatedPrice": 5249993.66,
    "totalPriceMin": 5249993.66,
    "totalPriceMax": 5500004.50,
    "areaValue": 5.0,
    "areaUnit": "Cent",
    "equivalentSqFt": 2178.00,
    "equivalentCents": 5.00,
    "totalGuidelinePrice": 3250011.60
  },
  "calculationExplanation": "Calculated from 3 verified completed-sale deed(s) within 1,000m radius for Residential classification. Outlier evaluation: Sample size < 4; all records preserved without outlier dropping. Primary market estimate uses the median rate of ₹2,410.47/sq.ft (₹1,050,000.00/cent) to eliminate skew from high/low extremes. The interquartile range spans from ₹2,410.47 (P25) to ₹2,525.25 (P75)/sq.ft. TNREGINET statutory guideline rate of ₹1,492.20/sq.ft is kept strictly in a separate benchmark layer. Advertised asking prices (1 listing(s) at median ₹2,249.77/sq.ft) are tracked as an independent seller-sentiment layer without arbitrary negotiation discounts applied. For the requested area of 5 Cent (2,178 sq.ft / 5.00 cents), total indicative market valuation is ₹5,249,994.",
  "disclaimer": "This indicative land market estimate is calculated via statistical aggregation (Median & IQR/MAD) of verified registered completed-sale deeds within the search radius. It does not constitute a guaranteed sale price, official legal appraisal, or financial commitment by Greenart Properties."
}
```

---

## 7. Tests Executed and Actual Results

All unit and integration test suites were executed:

```
Unit Tests:        Passed: 149, Failed: 0, Skipped: 0 (Duration: 115 ms)
Integration Tests: Passed:  71, Failed: 0, Skipped: 0 (Duration: 21 s)
Total Test Suite:  Passed: 220, Failed: 0, 100% Success Rate
```

### Coverage of Step 7 Mandatory Verification Requirements

| Requirement | Test Name | Location | Result |
| :--- | :--- | :--- | :---: |
| **Verified Sale Inclusion** | `WhenThreeOrMoreRecords_ShouldReturn_EstimateSuccessResponse_WithAccurateMedian` | `EstimationEngineTests.cs` | **PASS** |
| **Asking-Price Exclusion** | `AskingPrices_MustBeExcludedFromPrimaryMarketPool_AndPlacedInLayer2` | `EstimationEngineTests.cs` | **PASS** |
| **Guideline-Value Exclusion** | `GovernmentGuidelineValues_ShouldNeverBeBlendedIntoMarketPool` | `EstimationEngineTests.cs` | **PASS** |
| **Unverified Record Exclusion** | `UnverifiedAndSyntheticRecords_MustBeStrictlyExcluded` | `EstimationEngineTests.cs` | **PASS** |
| **Synthetic Record Exclusion** | `Record_EligibilityCheck_ShouldEnforceStrictEligibilityRules` | `LandPriceRecordTests.cs` | **PASS** |
| **Pending/Rejected Exclusion** | `PendingReviewAndRejectedRecords_MustBeStrictlyExcluded` | `EstimationEngineTests.cs` | **PASS** |
| **Invalid Price or Area** | `LandArea_NegativeOrZero_ThrowsException` | `UnitConversionTests.cs` | **PASS** |
| **Expired Transaction** | `ExpiredTransactions_OlderThan36Months_MustBeExcluded` | `EstimationEngineTests.cs` | **PASS** |
| **MAD Zero-Dispersion Case** | `MAD_ZeroDispersionCase_ShouldRetainAllRecords` | `EstimationEngineTests.cs` | **PASS** |
| **Small Sample ($N=3$)** | `SmallSampleOfThree_ShouldRetainAllRecordsWithoutDropping` | `EstimationEngineTests.cs` | **PASS** |
| **Insufficient Records** | `WhenLessThanThreeVerifiedRecords_ShouldReturn_InsufficientDataResponse` | `EstimationEngineTests.cs` | **PASS** |
| **Separation of 3 Layers** | `ThreeDataLayers_MustRemainCleanlySegregated` | `EstimationEngineTests.cs` | **PASS** |
| **Price-per-Cent Conversion** | `UnitConversion_OneCentMustEqual_435Point6SqFt` | `EstimationEngineTests.cs` | **PASS** |
| **Total Land Valuation** | `WhenTargetAreaProvided_ShouldCompute_AccurateTotalValuation` | `EstimationEngineTests.cs` | **PASS** |
| **Insufficient Data with Area** | `WhenTargetAreaProvidedAndInsufficientRecords_ShouldReturn_TotalGuidelineValuation` | `EstimationEngineTests.cs` | **PASS** |
| **Pilot Seed Integrity** | `KannampalayamPilot_StrictEligibility_ShouldReturnInsufficientData_WhenOnlyTwoVerifiedDeedsExist` | `EstimationPersistenceIntegrationTests.cs` | **PASS** |
| **HTTP Endpoint Behavior** | `CalculateEstimate_FromInteractiveMapPin_WithinPilotCorridor_Returns200WithStrictEligibility` | `LocalityEndpointsHttpTests.cs` | **PASS** |

---

## 8. Remaining Limitations

1. **Seed Dataset Density**: The pilot seed data contains only 2 verified sales deeds in Kannampalayam, 2 in Sulur, and 2 in Saravanampatti. Because the engine strictly and honestly rejects asking prices from the market pool, queries within a 1,000m radius in these hubs currently return `InsufficientData` until the database is loaded with additional verified registered conveyances.
2. **Guideline Granularity**: Tamil Nadu statutory guideline values are defined at the street or revenue-ward level. Internal layout plots on narrow interior branches share the same guideline rate as front plots unless specific SRO sub-survey rates exist.
3. **Paired-Sales Scarcity**: Without a dataset of identical plots where both the advertised asking price and the final registered deed are recorded, empirical negotiation margins cannot be dynamically derived.

---

## 9. Recommended Next Phase

1. **SRO Sale Deed Ingestion Pipeline**: Implement automated batch ingestion for registered sale deeds from Tamil Nadu Registration Department (TNREGINET / Star 2.0) to achieve $\ge 15$ verified deeds per pilot village.
2. **Pairing Pipeline for Negotiation Metrics**: Capture listing URLs and match them against subsequent Encumbrance Certificate (EC) deed entries to empirically measure the discount from asking to closed sale price.
3. **Machine Learning Feasibility Gate**: When a revenue village accumulates $\ge 300$ verified completed deeds over a 24-month window, initiate an offline Gradient Boosted Tree baseline comparison against the Median comparable sales benchmark.
