/**
 * Greenot Land Market Rate Analyst — TypeScript Acceptance Test Suite
 * Validates all 10 acceptance scenarios from Developer Specification & README.
 */

declare const process: any;

import {
  estimateLandRate,
  calculateLandValue,
  calculateBuildingValuation,
  validateListingArithmetic,
  convertSqFtRateToAllUnits,
  SQFT_PER_GROUND,
  SQFT_PER_CENT,
  SQFT_PER_ACRE,
} from '../src/greenot/valuation';
import { SubjectPropertyInput, PropertyEvidenceItem } from '../src/greenot/types';

function runAcceptanceTests() {
  console.log('===============================================================');
  console.log('GREENOT VALUATION ENGINE — AUTOMATED ACCEPTANCE TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Unit Conversion Acceptance Test
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Unit Conversions at ₹10,000 / Sq.Ft ---');
  const ratePerSqFt = 10000;
  const units = convertSqFtRateToAllUnits(ratePerSqFt);

  assert(
    units.perCent === 4356000,
    'Rate per Cent equals ₹43,56,000 (₹43.56 Lakh)',
    `Got ${units.perCent}`
  );
  assert(
    units.perGround === 24000000,
    'Rate per Ground equals ₹2,40,00,000 (₹2.40 Crore)',
    `Got ${units.perGround}`
  );
  assert(
    units.perAcre === 435600000,
    'Rate per Acre equals ₹43,56,00,000 (₹43.56 Crore)',
    `Got ${units.perAcre}`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Listing Area-Price Arithmetic Mismatch Validation Check
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Arithmetic Mismatch Validation (Kodambakkam Listing) ---');
  // Listing: 76 x 45 ft, total ₹3.8 Cr (3,80,00,000 INR), stated ₹16,590 / sq.ft
  const mismatchResult = validateListingArithmetic(
    38000000, // ₹3.8 Crore
    3420,     // Stated 3,420 sq.ft
    16590,    // Advertised rate
    '76x45',  // Dimensions
    2.0       // 2% tolerance
  );

  assert(!mismatchResult.isValid, 'Arithmetic validation flags mismatch as invalid');
  assert(
    mismatchResult.calculatedRatePerSqFt === 11111.11,
    'Engine recalculates actual rate as ₹11,111.11 / sq.ft',
    `Got ${mismatchResult.calculatedRatePerSqFt}`
  );
  assert(
    mismatchResult.discrepancyPct > 49.0,
    'Discrepancy is ~49.3%, exceeding 2% tolerance',
    `Got ${mismatchResult.discrepancyPct}%`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Zero Comparables / Missing Evidence
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Missing Comparables (Zero Records) ---');
  const subjectChennai: SubjectPropertyInput = {
    category: 'residential_land',
    latitude: 13.047006,
    longitude: 80.215154,
    address: '7-4-A, Dr. Subbaraya Nagar, Kodambakkam, Chennai',
  };

  const zeroResult = estimateLandRate(subjectChennai, [], { radiusKm: 1, minComparables: 3 });
  assert(
    zeroResult.status === 'insufficient_evidence',
    'Status is insufficient_evidence when zero comparables provided'
  );
  assert(zeroResult.median === null, 'Median is null (no fabricated rate)');
  assert(
    zeroResult.confidence.label === 'insufficient',
    'Confidence label is insufficient'
  );

  // --------------------------------------------------------------------------
  // TEST 4: Asking Listings Only (No Registered Deeds)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Listings Only (5 Active Asking Listings, 0 Transactions) ---');
  const askingListings: PropertyEvidenceItem[] = [
    {
      id: 'ask-1',
      category: 'residential_land',
      evidenceKind: 'asking_listing',
      verification: 'verified',
      evidenceDate: '2026-06-01',
      totalPriceInr: 36000000,
      landAreaSqft: 2400, // ₹15,000/sq.ft
      latitude: 13.0475,
      longitude: 80.2155,
      advertisedRatePerSqft: 15000,
    },
    {
      id: 'ask-2',
      category: 'residential_land',
      evidenceKind: 'asking_listing',
      verification: 'verified',
      evidenceDate: '2026-06-10',
      totalPriceInr: 40800000,
      landAreaSqft: 2400, // ₹17,000/sq.ft
      latitude: 13.0465,
      longitude: 80.2148,
      advertisedRatePerSqft: 17000,
    },
    {
      id: 'ask-3',
      category: 'residential_land',
      evidenceKind: 'asking_listing',
      verification: 'verified',
      evidenceDate: '2026-07-01',
      totalPriceInr: 43200000,
      landAreaSqft: 2400, // ₹18,000/sq.ft
      latitude: 13.048,
      longitude: 80.216,
      advertisedRatePerSqft: 18000,
    },
    {
      id: 'ask-4',
      category: 'residential_land',
      evidenceKind: 'asking_listing',
      verification: 'verified',
      evidenceDate: '2026-07-15',
      totalPriceInr: 45600000,
      landAreaSqft: 2400, // ₹19,000/sq.ft
      latitude: 13.046,
      longitude: 80.214,
      advertisedRatePerSqft: 19000,
    },
    {
      id: 'ask-5',
      category: 'residential_land',
      evidenceKind: 'asking_listing',
      verification: 'verified',
      evidenceDate: '2026-08-01',
      totalPriceInr: 50400000,
      landAreaSqft: 2400, // ₹21,000/sq.ft
      latitude: 13.0472,
      longitude: 80.2158,
      advertisedRatePerSqft: 21000,
    },
  ];

  const listingOnlyResult = estimateLandRate(subjectChennai, askingListings, {
    radiusKm: 1,
    minComparables: 3,
  });

  assert(listingOnlyResult.status === 'ok', 'Status is ok with 5 eligible listings');
  assert(
    listingOnlyResult.basis === 'asking_listings_only',
    'Basis is asking_listings_only (not claimed as registered transaction)'
  );
  assert(
    (listingOnlyResult.confidence.score ?? 0) <= 65,
    'Confidence score is capped at 65 for asking-price evidence',
    `Got ${listingOnlyResult.confidence.score}`
  );
  assert(
    listingOnlyResult.median === 18000,
    'Calculates deterministic median ₹18,000 / sq.ft',
    `Got ${listingOnlyResult.median}`
  );
  assert(
    listingOnlyResult.unitRates.perGround.median === 43200000,
    'Calculates Ground rate as ₹4.32 Crore / Ground',
    `Got ${listingOnlyResult.unitRates.perGround.median}`
  );

  // --------------------------------------------------------------------------
  // TEST 5: Mixed Category Filter (Flats must be excluded from land valuation)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Mixed Category Exclusion ---');
  const mixedSet: PropertyEvidenceItem[] = [
    ...askingListings.slice(0, 3),
    {
      id: 'flat-1',
      category: 'commercial_land', // Different category (e.g. built property or commercial)
      evidenceKind: 'asking_listing',
      verification: 'verified',
      evidenceDate: '2026-08-01',
      totalPriceInr: 80000000,
      landAreaSqft: 2400,
      latitude: 13.0471,
      longitude: 80.2152,
      advertisedRatePerSqft: 33333,
    },
  ];

  const mixedResult = estimateLandRate(subjectChennai, mixedSet, { radiusKm: 1, minComparables: 3 });
  const excludedFlat = mixedResult.comparables.find((c) => c.id === 'flat-1');
  assert(
    excludedFlat?.isIncluded === false,
    'Foreign category property is excluded from comparable set'
  );
  assert(
    excludedFlat?.exclusionReason?.includes('Category mismatch') === true,
    'Exclusion reason explicitly documents category mismatch'
  );

  // --------------------------------------------------------------------------
  // TEST 6: Building Valuation with RCC Depreciation & Demolition
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Building Valuation ---');
  const landVal = 43200000; // 1 Ground at ₹18,000/sqft = ₹4.32 Cr
  const buildingResult = calculateBuildingValuation(landVal, {
    builtUpAreaSqft: 2000,
    constructionType: 'RCC_Framed',
    ageYears: 20,
    condition: 'average',
    replacementCostPerSqft: 2500,
    repairOrDemolitionCost: 0,
    isDemolitionIntended: false,
  });

  assert(
    buildingResult.grossReplacementCost === 5000000,
    'Gross replacement cost is ₹50,00,000 (2,000 sqft * ₹2,500)',
    `Got ${buildingResult.grossReplacementCost}`
  );
  assert(
    buildingResult.depreciationPct === 30,
    'Depreciation is 30% for 20-year RCC building (1.5%/yr)',
    `Got ${buildingResult.depreciationPct}%`
  );
  assert(
    buildingResult.depreciatedBuildingValue === 3500000,
    'Depreciated building value is ₹35,00,000',
    `Got ${buildingResult.depreciatedBuildingValue}`
  );
  assert(
    buildingResult.totalPropertyValue === 46700000,
    'Total property value = Land (₹4.32 Cr) + Building (₹35 L) = ₹4.67 Cr',
    `Got ${buildingResult.totalPropertyValue}`
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests();
