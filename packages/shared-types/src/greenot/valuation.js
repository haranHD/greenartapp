"use strict";
/**
 * Greenot Land Market Rate Analyst — Deterministic Valuation Engine
 * Quality-Control Standard: Reproducible mathematical statistics,
 * strict tier separation, unit conversion, and 100-point confidence scoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBuildingValuation = exports.calculateLandValue = exports.estimateLandRate = exports.computeConfidenceScore = exports.calculatePercentile = exports.calculateHaversineDistanceMeters = exports.validateListingArithmetic = exports.convertSqFtRateToAllUnits = exports.SQFT_PER_SQM = exports.SQFT_PER_ACRE = exports.SQFT_PER_GROUND = exports.SQFT_PER_CENT = void 0;
// ============================================================================
// 1. EXACT UNIT CONVERSION CONSTANTS
// ============================================================================
exports.SQFT_PER_CENT = 435.6;
exports.SQFT_PER_GROUND = 2400.0; // Chennai standard: 1 Ground = 2,400 Sq.Ft
exports.SQFT_PER_ACRE = 43560.0; // 1 Acre = 100 Cents = 43,560 Sq.Ft
exports.SQFT_PER_SQM = 10.7639104;
function convertSqFtRateToAllUnits(ratePerSqFt) {
    if (ratePerSqFt == null) {
        return { perCent: null, perGround: null, perAcre: null };
    }
    return {
        perCent: Math.round(ratePerSqFt * exports.SQFT_PER_CENT * 100) / 100,
        perGround: Math.round(ratePerSqFt * exports.SQFT_PER_GROUND * 100) / 100,
        perAcre: Math.round(ratePerSqFt * exports.SQFT_PER_ACRE * 100) / 100,
    };
}
exports.convertSqFtRateToAllUnits = convertSqFtRateToAllUnits;
function validateListingArithmetic(totalPriceInr, landAreaSqft, advertisedRatePerSqft, dimensionsFt, tolerancePct = 2.0) {
    if (landAreaSqft <= 0 || totalPriceInr <= 0) {
        return {
            isValid: false,
            calculatedRatePerSqFt: 0,
            discrepancyPct: 100,
            reason: 'Land area and total price must be strictly positive.',
        };
    }
    let effectiveArea = landAreaSqft;
    let dimensionArea;
    // If dimensions provided (e.g., "76x45" or "76 x 45"), verify area arithmetic
    if (dimensionsFt) {
        const parts = dimensionsFt.toLowerCase().split(/[\s*x×]/).filter(Boolean);
        if (parts.length === 2) {
            const len = parseFloat(parts[0]);
            const wid = parseFloat(parts[1]);
            if (!isNaN(len) && !isNaN(wid) && len > 0 && wid > 0) {
                dimensionArea = Math.round(len * wid * 100) / 100;
                // If stated area differs from dimension product by > 2%, flag it
                const areaMismatchPct = (Math.abs(landAreaSqft - dimensionArea) / dimensionArea) * 100;
                if (areaMismatchPct > tolerancePct) {
                    return {
                        isValid: false,
                        calculatedRatePerSqFt: Math.round((totalPriceInr / dimensionArea) * 100) / 100,
                        advertisedRatePerSqft,
                        discrepancyPct: Math.round(areaMismatchPct * 100) / 100,
                        dimensionAreaSqFt: dimensionArea,
                        reason: `Stated area ${landAreaSqft} sq.ft does not match dimension product ${len}x${wid} = ${dimensionArea} sq.ft (${areaMismatchPct.toFixed(1)}% discrepancy).`,
                    };
                }
                effectiveArea = dimensionArea;
            }
        }
    }
    const calculatedRate = Math.round((totalPriceInr / effectiveArea) * 100) / 100;
    if (advertisedRatePerSqft != null && advertisedRatePerSqft > 0) {
        const discrepancyPct = Math.round((Math.abs(advertisedRatePerSqft - calculatedRate) / calculatedRate) * 10000) / 100;
        if (discrepancyPct > tolerancePct) {
            return {
                isValid: false,
                calculatedRatePerSqFt: calculatedRate,
                advertisedRatePerSqft,
                discrepancyPct,
                dimensionAreaSqFt: dimensionArea,
                reason: `Advertised rate ₹${advertisedRatePerSqft.toLocaleString('en-IN')}/sq.ft differs from calculated rate ₹${calculatedRate.toLocaleString('en-IN')}/sq.ft by ${discrepancyPct.toFixed(1)}% (exceeds ${tolerancePct}% tolerance).`,
            };
        }
    }
    return {
        isValid: true,
        calculatedRatePerSqFt: calculatedRate,
        advertisedRatePerSqft,
        discrepancyPct: 0.0,
        dimensionAreaSqFt: dimensionArea,
    };
}
exports.validateListingArithmetic = validateListingArithmetic;
// ============================================================================
// 3. HAVERSINE SPATIAL DISTANCE
// ============================================================================
function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}
exports.calculateHaversineDistanceMeters = calculateHaversineDistanceMeters;
// ============================================================================
// 4. STATISTICAL PERCENTILES (Deterministic Linear Interpolation)
// ============================================================================
function calculatePercentile(sortedValues, percentile) {
    if (sortedValues.length === 0)
        return 0;
    if (sortedValues.length === 1)
        return sortedValues[0];
    if (percentile <= 0)
        return sortedValues[0];
    if (percentile >= 1)
        return sortedValues[sortedValues.length - 1];
    const index = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper)
        return sortedValues[lower];
    return Math.round((sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight) * 100) / 100;
}
exports.calculatePercentile = calculatePercentile;
// ============================================================================
// 5. 100-POINT CONFIDENCE SCORING & HARD GATES
// ============================================================================
function computeConfidenceScore(subject, includedRecords, verifiedDeedCount, askingListingCount, hardGateReasons) {
    // Hard Gate 1: If 0 eligible comparables, score is null
    if (includedRecords.length === 0) {
        hardGateReasons.push('Zero eligible comparable records found within search radius.');
        return {
            score: null,
            label: 'insufficient',
            hardGateReasons,
            breakdown: {
                registeredTransactionsScore: 0,
                locationAccuracyScore: 0,
                comparableSimilarityScore: 0,
                recencyScore: 0,
                sourceReliabilityScore: 0,
                subjectCompletenessScore: 0,
                totalScore: 0,
            },
        };
    }
    // 1. Registered Transactions (Weight 35%)
    let registeredScore = 0;
    if (verifiedDeedCount >= 5)
        registeredScore = 35;
    else if (verifiedDeedCount >= 3)
        registeredScore = 28;
    else if (verifiedDeedCount >= 1)
        registeredScore = 18;
    else {
        registeredScore = 0;
        hardGateReasons.push('Valuation is based exclusively on asking-price listings; no verified registered deeds available.');
    }
    // 2. Location Accuracy (Weight 20%)
    let locationScore = 0;
    if (subject.userConfirmedLocation)
        locationScore += 10;
    if (subject.surveyNumber)
        locationScore += 5;
    if (subject.address)
        locationScore += 5;
    // 3. Comparable Similarity (Weight 15%)
    let similarityScore = 10;
    const sameCategoryCount = includedRecords.filter((r) => r.category === subject.category).length;
    if (sameCategoryCount === includedRecords.length)
        similarityScore = 15;
    // 4. Recency (Weight 10%)
    const now = new Date().getTime();
    let recentCount = 0;
    for (const rec of includedRecords) {
        const ageDays = (now - new Date(rec.evidenceDate).getTime()) / (1000 * 3600 * 24);
        if (ageDays <= 365)
            recentCount++;
    }
    const recencyScore = Math.round((recentCount / includedRecords.length) * 10);
    // 5. Source Reliability (Weight 10%)
    let reliableCount = 0;
    for (const rec of includedRecords) {
        if (rec.verification === 'verified')
            reliableCount++;
    }
    const sourceReliabilityScore = Math.round((reliableCount / includedRecords.length) * 10);
    // 6. Subject Property Completeness (Weight 10%)
    let completenessScore = 0;
    if (subject.landAreaSqft && subject.landAreaSqft > 0)
        completenessScore += 4;
    if (subject.roadWidthFt && subject.roadWidthFt > 0)
        completenessScore += 3;
    if (subject.approvalStatus)
        completenessScore += 3;
    let rawTotal = registeredScore +
        locationScore +
        similarityScore +
        recencyScore +
        sourceReliabilityScore +
        completenessScore;
    // Cap: If no registered transactions, score cannot exceed 65 (Medium / Low cap)
    if (verifiedDeedCount === 0 && rawTotal > 65) {
        rawTotal = 65;
    }
    let label = 'low';
    if (rawTotal >= 85)
        label = 'high';
    else if (rawTotal >= 65)
        label = 'medium';
    else if (rawTotal >= 40)
        label = 'low';
    else
        label = 'insufficient';
    return {
        score: rawTotal,
        label,
        hardGateReasons,
        breakdown: {
            registeredTransactionsScore: registeredScore,
            locationAccuracyScore: locationScore,
            comparableSimilarityScore: similarityScore,
            recencyScore,
            sourceReliabilityScore,
            subjectCompletenessScore: completenessScore,
            totalScore: rawTotal,
        },
    };
}
exports.computeConfidenceScore = computeConfidenceScore;
// ============================================================================
// 6. MAIN ESTIMATION PIPELINE (Deterministic Valuation Engine)
// ============================================================================
function estimateLandRate(subject, rawEvidence, options = {}) {
    const radiusKm = options.radiusKm ?? 1.0;
    const radiusMeters = radiusKm * 1000;
    const minComparables = options.minComparables ?? 3;
    const maxAgeDays = options.maxAgeDays ?? 730; // 2 years default
    const tolerancePct = options.arithmeticTolerancePct ?? 2.0;
    const enableIqr = options.enableIqrOutlierFilter ?? true;
    const now = new Date().getTime();
    const evaluations = [];
    const candidateRates = [];
    let quarantinedCount = 0;
    const hardGateReasons = [];
    for (const item of rawEvidence) {
        const distanceMeters = calculateHaversineDistanceMeters(subject.latitude, subject.longitude, item.latitude, item.longitude);
        // 1. Distance filter
        if (distanceMeters > radiusMeters) {
            evaluations.push({
                id: item.id,
                distanceMeters,
                effectiveRatePerSqFt: item.advertisedRatePerSqft || 0,
                evidenceKind: item.evidenceKind,
                verification: item.verification,
                isIncluded: false,
                exclusionReason: `Distance ${distanceMeters}m exceeds search radius ${radiusMeters}m.`,
            });
            continue;
        }
        // 2. Category match (Flats / Apartments must NEVER be mixed into raw land)
        if (item.category !== subject.category) {
            evaluations.push({
                id: item.id,
                distanceMeters,
                effectiveRatePerSqFt: item.advertisedRatePerSqft || 0,
                evidenceKind: item.evidenceKind,
                verification: item.verification,
                isIncluded: false,
                exclusionReason: `Category mismatch (${item.category} vs subject ${subject.category}). Mixed categories forbidden.`,
            });
            continue;
        }
        // 3. Recency filter (Historical evidence older than maxAgeDays excluded from current valuation)
        const ageDays = (now - new Date(item.evidenceDate).getTime()) / (1000 * 3600 * 24);
        if (ageDays > maxAgeDays) {
            evaluations.push({
                id: item.id,
                distanceMeters,
                effectiveRatePerSqFt: item.advertisedRatePerSqft || 0,
                evidenceKind: item.evidenceKind,
                verification: item.verification,
                isIncluded: false,
                exclusionReason: `Evidence age ${Math.round(ageDays)} days exceeds current-rate window of ${maxAgeDays} days.`,
            });
            continue;
        }
        // 4. Arithmetic Validation Check (Price / Area mismatch > tolerance)
        const arith = validateListingArithmetic(item.totalPriceInr, item.landAreaSqft, item.advertisedRatePerSqft, item.dimensionsFt, tolerancePct);
        if (!arith.isValid) {
            quarantinedCount++;
            evaluations.push({
                id: item.id,
                distanceMeters,
                effectiveRatePerSqFt: arith.calculatedRatePerSqFt,
                evidenceKind: item.evidenceKind,
                verification: 'quarantined',
                isIncluded: false,
                arithmeticDiscrepancyPct: arith.discrepancyPct,
                exclusionReason: `Quarantined: ${arith.reason}`,
            });
            continue;
        }
        const effectiveRate = arith.calculatedRatePerSqFt;
        const evalItem = {
            id: item.id,
            distanceMeters,
            effectiveRatePerSqFt: effectiveRate,
            evidenceKind: item.evidenceKind,
            verification: item.verification,
            isIncluded: true,
            arithmeticDiscrepancyPct: arith.discrepancyPct,
        };
        evaluations.push(evalItem);
        candidateRates.push({ rate: effectiveRate, record: item, evalItem });
    }
    // 5. Outlier Detection via 1.5 x IQR (Interquartile Range)
    if (enableIqr && candidateRates.length >= 4) {
        const rawRates = candidateRates.map((c) => c.rate).sort((a, b) => a - b);
        const q1 = calculatePercentile(rawRates, 0.25);
        const q3 = calculatePercentile(rawRates, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        for (const cand of candidateRates) {
            if (cand.rate < lowerBound || cand.rate > upperBound) {
                cand.evalItem.isIncluded = false;
                cand.evalItem.exclusionReason = `Statistical outlier: rate ₹${cand.rate.toLocaleString('en-IN')}/sq.ft is outside 1.5x IQR boundary [₹${Math.max(0, lowerBound).toLocaleString('en-IN')} - ₹${upperBound.toLocaleString('en-IN')}].`;
            }
        }
    }
    // Eligible included records
    const includedCandidates = candidateRates.filter((c) => c.evalItem.isIncluded);
    const includedRates = includedCandidates.map((c) => c.rate).sort((a, b) => a - b);
    const includedRecords = includedCandidates.map((c) => c.record);
    const verifiedTransactionCount = includedRecords.filter((r) => r.evidenceKind === 'registered_transaction' && r.verification === 'verified').length;
    const askingListingCount = includedRecords.filter((r) => r.evidenceKind === 'asking_listing').length;
    // Gate Check: Insufficient Evidence
    if (includedRates.length < minComparables) {
        hardGateReasons.push(`Insufficient verified evidence: found ${includedRates.length} eligible comparables within ${radiusKm}km radius (minimum required: ${minComparables}).`);
        const emptyUnitRange = { low: null, median: null, high: null };
        return {
            status: 'insufficient_evidence',
            basis: 'insufficient_evidence',
            low: null,
            median: null,
            high: null,
            currency: 'INR',
            unit: 'sqft',
            unitRates: {
                perCent: emptyUnitRange,
                perGround: emptyUnitRange,
                perAcre: emptyUnitRange,
            },
            sampleCount: includedRates.length,
            verifiedTransactionCount,
            askingListingCount,
            quarantinedCount,
            confidence: {
                score: null,
                label: 'insufficient',
                hardGateReasons,
            },
            comparables: evaluations,
            methodVersion: '1.0',
            disclaimer: 'Insufficient verified comparables available within search radius. A reliable rate range cannot be calculated without fabricating unsupported values.',
        };
    }
    // Compute Core Percentiles
    const p25 = calculatePercentile(includedRates, 0.25);
    const median = calculatePercentile(includedRates, 0.5);
    const p75 = calculatePercentile(includedRates, 0.75);
    const basis = verifiedTransactionCount > 0 ? 'registered_transactions' : 'asking_listings_only';
    const confidence = computeConfidenceScore(subject, includedRecords, verifiedTransactionCount, askingListingCount, hardGateReasons);
    const disclaimer = basis === 'registered_transactions'
        ? 'Evidence-backed rate range derived strictly from verified registered conveyances and filtered comparables.'
        : 'ADVISORY NOTICE: Derived strictly from advertised asking-price listings. Asking prices reflect seller expectations prior to negotiations and are typically higher than registered transactions. Not an agreed or statutory sale value.';
    return {
        status: 'ok',
        basis,
        low: p25,
        median,
        high: p75,
        currency: 'INR',
        unit: 'sqft',
        unitRates: {
            perCent: {
                low: convertSqFtRateToAllUnits(p25).perCent,
                median: convertSqFtRateToAllUnits(median).perCent,
                high: convertSqFtRateToAllUnits(p75).perCent,
            },
            perGround: {
                low: convertSqFtRateToAllUnits(p25).perGround,
                median: convertSqFtRateToAllUnits(median).perGround,
                high: convertSqFtRateToAllUnits(p75).perGround,
            },
            perAcre: {
                low: convertSqFtRateToAllUnits(p25).perAcre,
                median: convertSqFtRateToAllUnits(median).perAcre,
                high: convertSqFtRateToAllUnits(p75).perAcre,
            },
        },
        sampleCount: includedRates.length,
        verifiedTransactionCount,
        askingListingCount,
        quarantinedCount,
        confidence,
        comparables: evaluations,
        methodVersion: '1.0',
        disclaimer,
    };
}
exports.estimateLandRate = estimateLandRate;
// ============================================================================
// 7. LAND VALUE CALCULATION
// ============================================================================
function calculateLandValue(landAreaSqft, ratePerSqft) {
    if (landAreaSqft <= 0 || ratePerSqft <= 0) {
        throw new Error('Land area and rate per sq.ft must be strictly positive.');
    }
    const totalValue = Math.round(landAreaSqft * ratePerSqft * 100) / 100;
    let formatted = `₹${totalValue.toLocaleString('en-IN')}`;
    if (totalValue >= 10000000) {
        formatted = `₹${(totalValue / 10000000).toFixed(2)} Crore`;
    }
    else if (totalValue >= 100000) {
        formatted = `₹${(totalValue / 100000).toFixed(2)} Lakh`;
    }
    return {
        landAreaSqft,
        selectedRatePerSqft: ratePerSqft,
        totalLandValueInr: totalValue,
        totalLandValueFormatted: formatted,
    };
}
exports.calculateLandValue = calculateLandValue;
// ============================================================================
// 8. LAND + BUILDING VALUATION
// ============================================================================
function calculateBuildingValuation(landValueInr, input) {
    const grossReplacementCost = Math.round(input.builtUpAreaSqft * input.replacementCostPerSqft);
    // Standard Straight-Line Depreciation: 1.5% per year for RCC, capped at 75%
    let annualDepreciationPct = 1.5;
    if (input.constructionType === 'Load_Bearing')
        annualDepreciationPct = 2.0;
    else if (input.constructionType === 'Steel_Frame')
        annualDepreciationPct = 1.25;
    let totalDepreciationPct = Math.min(75.0, input.ageYears * annualDepreciationPct);
    // Adjust for condition
    if (input.condition === 'poor')
        totalDepreciationPct = Math.min(85.0, totalDepreciationPct + 10.0);
    if (input.condition === 'good')
        totalDepreciationPct = Math.max(5.0, totalDepreciationPct - 5.0);
    const depreciatedBuildingValue = Math.round(grossReplacementCost * (1 - totalDepreciationPct / 100));
    const repairOrDemolitionCost = input.repairOrDemolitionCost ?? 0;
    const isDemolitionIntended = input.isDemolitionIntended ?? false;
    let netBuildingValue = depreciatedBuildingValue;
    if (isDemolitionIntended) {
        netBuildingValue = -repairOrDemolitionCost;
    }
    else {
        netBuildingValue = Math.max(0, depreciatedBuildingValue - repairOrDemolitionCost);
    }
    const totalPropertyValue = Math.max(0, landValueInr + netBuildingValue);
    return {
        grossReplacementCost,
        depreciationPct: totalDepreciationPct,
        depreciatedBuildingValue,
        repairOrDemolitionCost,
        isDemolitionIntended,
        netBuildingValue,
        totalPropertyValue,
    };
}
exports.calculateBuildingValuation = calculateBuildingValuation;
