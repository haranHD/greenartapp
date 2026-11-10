"use strict";
/**
 * Greenot Land Market Rate Analyst — Deterministic Valuation Engine
 * Quality-Control Standard: Reproducible mathematical statistics,
 * strict tier separation, unit conversion, and 100-point confidence scoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQFT_PER_SQM = exports.SQFT_PER_ACRE = exports.SQFT_PER_GROUND = exports.SQFT_PER_CENT = void 0;
exports.convertSqFtRateToAllUnits = convertSqFtRateToAllUnits;
exports.validateListingArithmetic = validateListingArithmetic;
exports.calculateHaversineDistanceMeters = calculateHaversineDistanceMeters;
exports.calculatePercentile = calculatePercentile;
exports.computeConfidenceScore = computeConfidenceScore;
exports.estimateLandRate = estimateLandRate;
exports.calculateLandValue = calculateLandValue;
exports.calculateBuildingValuation = calculateBuildingValuation;
exports.calculateMarketRateBuffer = calculateMarketRateBuffer;
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
function validateListingArithmetic(totalPriceInr, landAreaSqft, advertisedRatePerSqft, dimensionsFt, tolerancePct) {
    if (tolerancePct === void 0) { tolerancePct = 2.0; }
    if (landAreaSqft <= 0 || totalPriceInr <= 0) {
        return {
            isValid: false,
            calculatedRatePerSqFt: 0,
            discrepancyPct: 100,
            reason: 'Land area and total price must be strictly positive.',
        };
    }
    var effectiveArea = landAreaSqft;
    var dimensionArea;
    // If dimensions provided (e.g., "76x45" or "76 x 45"), verify area arithmetic
    if (dimensionsFt) {
        var parts = dimensionsFt.toLowerCase().split(/[\s*x×]/).filter(Boolean);
        if (parts.length === 2) {
            var len = parseFloat(parts[0]);
            var wid = parseFloat(parts[1]);
            if (!isNaN(len) && !isNaN(wid) && len > 0 && wid > 0) {
                dimensionArea = Math.round(len * wid * 100) / 100;
                // If stated area differs from dimension product by > 2%, flag it
                var areaMismatchPct = (Math.abs(landAreaSqft - dimensionArea) / dimensionArea) * 100;
                if (areaMismatchPct > tolerancePct) {
                    return {
                        isValid: false,
                        calculatedRatePerSqFt: Math.round((totalPriceInr / dimensionArea) * 100) / 100,
                        advertisedRatePerSqft: advertisedRatePerSqft,
                        discrepancyPct: Math.round(areaMismatchPct * 100) / 100,
                        dimensionAreaSqFt: dimensionArea,
                        reason: "Stated area ".concat(landAreaSqft, " sq.ft does not match dimension product ").concat(len, "x").concat(wid, " = ").concat(dimensionArea, " sq.ft (").concat(areaMismatchPct.toFixed(1), "% discrepancy)."),
                    };
                }
                effectiveArea = dimensionArea;
            }
        }
    }
    var calculatedRate = Math.round((totalPriceInr / effectiveArea) * 100) / 100;
    if (advertisedRatePerSqft != null && advertisedRatePerSqft > 0) {
        var discrepancyPct = Math.round((Math.abs(advertisedRatePerSqft - calculatedRate) / calculatedRate) * 10000) / 100;
        if (discrepancyPct > tolerancePct) {
            return {
                isValid: false,
                calculatedRatePerSqFt: calculatedRate,
                advertisedRatePerSqft: advertisedRatePerSqft,
                discrepancyPct: discrepancyPct,
                dimensionAreaSqFt: dimensionArea,
                reason: "Advertised rate \u20B9".concat(advertisedRatePerSqft.toLocaleString('en-IN'), "/sq.ft differs from calculated rate \u20B9").concat(calculatedRate.toLocaleString('en-IN'), "/sq.ft by ").concat(discrepancyPct.toFixed(1), "% (exceeds ").concat(tolerancePct, "% tolerance)."),
            };
        }
    }
    return {
        isValid: true,
        calculatedRatePerSqFt: calculatedRate,
        advertisedRatePerSqft: advertisedRatePerSqft,
        discrepancyPct: 0.0,
        dimensionAreaSqFt: dimensionArea,
    };
}
// ============================================================================
// 3. HAVERSINE SPATIAL DISTANCE
// ============================================================================
function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Earth radius in meters
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}
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
    var index = (sortedValues.length - 1) * percentile;
    var lower = Math.floor(index);
    var upper = Math.ceil(index);
    var weight = index - lower;
    if (lower === upper)
        return sortedValues[lower];
    return Math.round((sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight) * 100) / 100;
}
// ============================================================================
// 5. 100-POINT CONFIDENCE SCORING & HARD GATES
// ============================================================================
function computeConfidenceScore(subject, includedRecords, verifiedDeedCount, _askingListingCount, hardGateReasons) {
    // Hard Gate 1: If 0 eligible comparables, score is null
    if (includedRecords.length === 0) {
        hardGateReasons.push('Zero eligible comparable records found within search radius.');
        return {
            score: null,
            label: 'insufficient',
            hardGateReasons: hardGateReasons,
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
    var registeredScore = 0;
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
    var locationScore = 0;
    if (subject.userConfirmedLocation)
        locationScore += 10;
    if (subject.surveyNumber)
        locationScore += 5;
    if (subject.address)
        locationScore += 5;
    // 3. Comparable Similarity (Weight 15%)
    var similarityScore = 10;
    var sameCategoryCount = includedRecords.filter(function (r) { return r.category === subject.category; }).length;
    if (sameCategoryCount === includedRecords.length)
        similarityScore = 15;
    // 4. Recency (Weight 10%)
    var now = new Date().getTime();
    var recentCount = 0;
    for (var _i = 0, includedRecords_1 = includedRecords; _i < includedRecords_1.length; _i++) {
        var rec = includedRecords_1[_i];
        var ageDays = (now - new Date(rec.evidenceDate).getTime()) / (1000 * 3600 * 24);
        if (ageDays <= 365)
            recentCount++;
    }
    var recencyScore = Math.round((recentCount / includedRecords.length) * 10);
    // 5. Source Reliability (Weight 10%)
    var reliableCount = 0;
    for (var _a = 0, includedRecords_2 = includedRecords; _a < includedRecords_2.length; _a++) {
        var rec = includedRecords_2[_a];
        if (rec.verification === 'verified')
            reliableCount++;
    }
    var sourceReliabilityScore = Math.round((reliableCount / includedRecords.length) * 10);
    // 6. Subject Property Completeness (Weight 10%)
    var completenessScore = 0;
    if (subject.landAreaSqft && subject.landAreaSqft > 0)
        completenessScore += 4;
    if (subject.roadWidthFt && subject.roadWidthFt > 0)
        completenessScore += 3;
    if (subject.approvalStatus)
        completenessScore += 3;
    var rawTotal = registeredScore +
        locationScore +
        similarityScore +
        recencyScore +
        sourceReliabilityScore +
        completenessScore;
    // Cap: If no registered transactions, score cannot exceed 65 (Medium / Low cap)
    if (verifiedDeedCount === 0 && rawTotal > 65) {
        rawTotal = 65;
    }
    var label = 'low';
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
        label: label,
        hardGateReasons: hardGateReasons,
        breakdown: {
            registeredTransactionsScore: registeredScore,
            locationAccuracyScore: locationScore,
            comparableSimilarityScore: similarityScore,
            recencyScore: recencyScore,
            sourceReliabilityScore: sourceReliabilityScore,
            subjectCompletenessScore: completenessScore,
            totalScore: rawTotal,
        },
    };
}
// ============================================================================
// 6. MAIN ESTIMATION PIPELINE (Deterministic Valuation Engine)
// ============================================================================
function estimateLandRate(subject, rawEvidence, options) {
    var _a, _b, _c, _d, _e;
    if (options === void 0) { options = {}; }
    var radiusKm = (_a = options.radiusKm) !== null && _a !== void 0 ? _a : 1.0;
    var radiusMeters = radiusKm * 1000;
    var minComparables = (_b = options.minComparables) !== null && _b !== void 0 ? _b : 3;
    var maxAgeDays = (_c = options.maxAgeDays) !== null && _c !== void 0 ? _c : 730; // 2 years default
    var tolerancePct = (_d = options.arithmeticTolerancePct) !== null && _d !== void 0 ? _d : 2.0;
    var enableIqr = (_e = options.enableIqrOutlierFilter) !== null && _e !== void 0 ? _e : true;
    var now = new Date().getTime();
    var evaluations = [];
    var candidateRates = [];
    var quarantinedCount = 0;
    var hardGateReasons = [];
    for (var _i = 0, rawEvidence_1 = rawEvidence; _i < rawEvidence_1.length; _i++) {
        var item = rawEvidence_1[_i];
        var distanceMeters = calculateHaversineDistanceMeters(subject.latitude, subject.longitude, item.latitude, item.longitude);
        // 1. Distance filter
        if (distanceMeters > radiusMeters) {
            evaluations.push({
                id: item.id,
                distanceMeters: distanceMeters,
                effectiveRatePerSqFt: item.advertisedRatePerSqft || 0,
                evidenceKind: item.evidenceKind,
                verification: item.verification,
                isIncluded: false,
                exclusionReason: "Distance ".concat(distanceMeters, "m exceeds search radius ").concat(radiusMeters, "m."),
            });
            continue;
        }
        // 2. Category match (Flats / Apartments must NEVER be mixed into raw land)
        if (item.category !== subject.category) {
            evaluations.push({
                id: item.id,
                distanceMeters: distanceMeters,
                effectiveRatePerSqFt: item.advertisedRatePerSqft || 0,
                evidenceKind: item.evidenceKind,
                verification: item.verification,
                isIncluded: false,
                exclusionReason: "Category mismatch (".concat(item.category, " vs subject ").concat(subject.category, "). Mixed categories forbidden."),
            });
            continue;
        }
        // 3. Recency filter (Historical evidence older than maxAgeDays excluded from current valuation)
        var ageDays = (now - new Date(item.evidenceDate).getTime()) / (1000 * 3600 * 24);
        if (ageDays > maxAgeDays) {
            evaluations.push({
                id: item.id,
                distanceMeters: distanceMeters,
                effectiveRatePerSqFt: item.advertisedRatePerSqft || 0,
                evidenceKind: item.evidenceKind,
                verification: item.verification,
                isIncluded: false,
                exclusionReason: "Evidence age ".concat(Math.round(ageDays), " days exceeds current-rate window of ").concat(maxAgeDays, " days."),
            });
            continue;
        }
        // 4. Arithmetic Validation Check (Price / Area mismatch > tolerance)
        var arith = validateListingArithmetic(item.totalPriceInr, item.landAreaSqft, item.advertisedRatePerSqft, item.dimensionsFt, tolerancePct);
        if (!arith.isValid) {
            quarantinedCount++;
            evaluations.push({
                id: item.id,
                distanceMeters: distanceMeters,
                effectiveRatePerSqFt: arith.calculatedRatePerSqFt,
                evidenceKind: item.evidenceKind,
                verification: 'quarantined',
                isIncluded: false,
                arithmeticDiscrepancyPct: arith.discrepancyPct,
                exclusionReason: "Quarantined: ".concat(arith.reason),
            });
            continue;
        }
        var effectiveRate = arith.calculatedRatePerSqFt;
        var evalItem = {
            id: item.id,
            distanceMeters: distanceMeters,
            effectiveRatePerSqFt: effectiveRate,
            evidenceKind: item.evidenceKind,
            verification: item.verification,
            isIncluded: true,
            arithmeticDiscrepancyPct: arith.discrepancyPct,
        };
        evaluations.push(evalItem);
        candidateRates.push({ rate: effectiveRate, record: item, evalItem: evalItem });
    }
    // 5. Outlier Detection via 1.5 x IQR (Interquartile Range)
    if (enableIqr && candidateRates.length >= 4) {
        var rawRates = candidateRates.map(function (c) { return c.rate; }).sort(function (a, b) { return a - b; });
        var q1 = calculatePercentile(rawRates, 0.25);
        var q3 = calculatePercentile(rawRates, 0.75);
        var iqr = q3 - q1;
        var lowerBound = q1 - 1.5 * iqr;
        var upperBound = q3 + 1.5 * iqr;
        for (var _f = 0, candidateRates_1 = candidateRates; _f < candidateRates_1.length; _f++) {
            var cand = candidateRates_1[_f];
            if (cand.rate < lowerBound || cand.rate > upperBound) {
                cand.evalItem.isIncluded = false;
                cand.evalItem.exclusionReason = "Statistical outlier: rate \u20B9".concat(cand.rate.toLocaleString('en-IN'), "/sq.ft is outside 1.5x IQR boundary [\u20B9").concat(Math.max(0, lowerBound).toLocaleString('en-IN'), " - \u20B9").concat(upperBound.toLocaleString('en-IN'), "].");
            }
        }
    }
    // Eligible included records
    var includedCandidates = candidateRates.filter(function (c) { return c.evalItem.isIncluded; });
    var includedRates = includedCandidates.map(function (c) { return c.rate; }).sort(function (a, b) { return a - b; });
    var includedRecords = includedCandidates.map(function (c) { return c.record; });
    var verifiedTransactionCount = includedRecords.filter(function (r) { return r.evidenceKind === 'registered_transaction' && r.verification === 'verified'; }).length;
    var askingListingCount = includedRecords.filter(function (r) { return r.evidenceKind === 'asking_listing'; }).length;
    // Gate Check: Insufficient Evidence
    if (includedRates.length < minComparables) {
        hardGateReasons.push("Insufficient verified evidence: found ".concat(includedRates.length, " eligible comparables within ").concat(radiusKm, "km radius (minimum required: ").concat(minComparables, ")."));
        var emptyUnitRange = { low: null, median: null, high: null };
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
            verifiedTransactionCount: verifiedTransactionCount,
            askingListingCount: askingListingCount,
            quarantinedCount: quarantinedCount,
            confidence: {
                score: null,
                label: 'insufficient',
                hardGateReasons: hardGateReasons,
            },
            comparables: evaluations,
            methodVersion: '1.0',
            disclaimer: 'Insufficient verified comparables available within search radius. A reliable rate range cannot be calculated without fabricating unsupported values.',
        };
    }
    // Compute Core Percentiles
    var p25 = calculatePercentile(includedRates, 0.25);
    var median = calculatePercentile(includedRates, 0.5);
    var p75 = calculatePercentile(includedRates, 0.75);
    var basis = verifiedTransactionCount > 0 ? 'registered_transactions' : 'asking_listings_only';
    var confidence = computeConfidenceScore(subject, includedRecords, verifiedTransactionCount, askingListingCount, hardGateReasons);
    var disclaimer = basis === 'registered_transactions'
        ? 'Evidence-backed rate range derived strictly from verified registered conveyances and filtered comparables.'
        : 'ADVISORY NOTICE: Derived strictly from advertised asking-price listings. Asking prices reflect seller expectations prior to negotiations and are typically higher than registered transactions. Not an agreed or statutory sale value.';
    return {
        status: 'ok',
        basis: basis,
        low: p25,
        median: median,
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
        verifiedTransactionCount: verifiedTransactionCount,
        askingListingCount: askingListingCount,
        quarantinedCount: quarantinedCount,
        confidence: confidence,
        comparables: evaluations,
        methodVersion: '1.0',
        disclaimer: disclaimer,
    };
}
// ============================================================================
// 7. LAND VALUE CALCULATION
// ============================================================================
function calculateLandValue(landAreaSqft, ratePerSqft) {
    if (landAreaSqft <= 0 || ratePerSqft <= 0) {
        throw new Error('Land area and rate per sq.ft must be strictly positive.');
    }
    var totalValue = Math.round(landAreaSqft * ratePerSqft * 100) / 100;
    var formatted = "\u20B9".concat(totalValue.toLocaleString('en-IN'));
    if (totalValue >= 10000000) {
        formatted = "\u20B9".concat((totalValue / 10000000).toFixed(2), " Crore");
    }
    else if (totalValue >= 100000) {
        formatted = "\u20B9".concat((totalValue / 100000).toFixed(2), " Lakh");
    }
    return {
        landAreaSqft: landAreaSqft,
        selectedRatePerSqft: ratePerSqft,
        totalLandValueInr: totalValue,
        totalLandValueFormatted: formatted,
    };
}
// ============================================================================
// 8. LAND + BUILDING VALUATION
// ============================================================================
function calculateBuildingValuation(landValueInr, input) {
    var _a, _b;
    var grossReplacementCost = Math.round(input.builtUpAreaSqft * input.replacementCostPerSqft);
    // Standard Straight-Line Depreciation: 1.5% per year for RCC, capped at 75%
    var annualDepreciationPct = 1.5;
    if (input.constructionType === 'Load_Bearing')
        annualDepreciationPct = 2.0;
    else if (input.constructionType === 'Steel_Frame')
        annualDepreciationPct = 1.25;
    var totalDepreciationPct = Math.min(75.0, input.ageYears * annualDepreciationPct);
    // Adjust for condition
    if (input.condition === 'poor')
        totalDepreciationPct = Math.min(85.0, totalDepreciationPct + 10.0);
    if (input.condition === 'good')
        totalDepreciationPct = Math.max(5.0, totalDepreciationPct - 5.0);
    var depreciatedBuildingValue = Math.round(grossReplacementCost * (1 - totalDepreciationPct / 100));
    var repairOrDemolitionCost = (_a = input.repairOrDemolitionCost) !== null && _a !== void 0 ? _a : 0;
    var isDemolitionIntended = (_b = input.isDemolitionIntended) !== null && _b !== void 0 ? _b : false;
    var netBuildingValue = depreciatedBuildingValue;
    if (isDemolitionIntended) {
        netBuildingValue = -repairOrDemolitionCost;
    }
    else {
        netBuildingValue = Math.max(0, depreciatedBuildingValue - repairOrDemolitionCost);
    }
    var totalPropertyValue = Math.max(0, landValueInr + netBuildingValue);
    return {
        grossReplacementCost: grossReplacementCost,
        depreciationPct: totalDepreciationPct,
        depreciatedBuildingValue: depreciatedBuildingValue,
        repairOrDemolitionCost: repairOrDemolitionCost,
        isDemolitionIntended: isDemolitionIntended,
        netBuildingValue: netBuildingValue,
        totalPropertyValue: totalPropertyValue,
    };
}
// ============================================================================
// 9. MARKET RATE BUFFER & APPROXIMATE MIDPOINT RATE
// ============================================================================
/**
 * Calculates a user-friendly price range (market buffer) and clean approximate midpoint rate.
 *
 * Rules:
 * 1. For Lakhs rates (e.g. per Cent, per Ground, or raw rates >= 100,000 INR):
 *    - Lower limit: Round down to the nearest lower quarter interval (.00, .25, .50, .75).
 *    - Upper limit: Round up to the nearest upper quarter interval (.00, .25, .50, .75).
 *    - If lower == upper: expands by quarter step (±0.25) to provide a true market buffer.
 *    - Approximate rate: Rounded to nearest clean decimal (e.g. 10.90L or 10.95L)
 *      or the clean midpoint of the generated range.
 *    - Example: 10.92 L / Cent -> Estimated Range: ₹10.75 L – ₹11.00 L / Cent,
 *                                Approximate Market Rate: ₹10.90 L / Cent.
 * 2. For Sq.Ft rates (Rupees per sq.ft):
 *    - Lower/Upper limits rounded to nearest sensible interval (e.g. ₹50 or ₹100).
 *    - Approximate rate rounded to nearest clean interval.
 */
function calculateMarketRateBuffer(rate, unit, customStep) {
    if (unit === void 0) { unit = 'Cent'; }
    var isPerSqFt = unit.toLowerCase().includes('sq');
    var isLakhUnit = !isPerSqFt;
    var rawRate = rate;
    var lowerRate = 0;
    var upperRate = 0;
    var approximateRate = 0;
    var midpointRate = 0;
    var lowerFormatted = '';
    var upperFormatted = '';
    var approximateFormatted = '';
    if (isLakhUnit) {
        // If rate is in raw INR (>= 1,000), convert to Lakhs
        var rateInLakhs = rate >= 1000 ? rate / 100000 : rate;
        var step = customStep !== null && customStep !== void 0 ? customStep : 0.25;
        var lowerLakhs = Math.floor(rateInLakhs / step) * step;
        var upperLakhs = Math.ceil(rateInLakhs / step) * step;
        if (lowerLakhs === upperLakhs) {
            lowerLakhs = Math.max(0, rateInLakhs - step);
            upperLakhs = rateInLakhs + step;
        }
        // Clean approximate rate rounded to nearest 0.05 clean decimal (e.g. 10.90L, 10.95L)
        var approxLakhs = Math.round(rateInLakhs / 0.05) * 0.05;
        var midLakhs = (lowerLakhs + upperLakhs) / 2;
        lowerRate = Math.round(lowerLakhs * 100) / 100;
        upperRate = Math.round(upperLakhs * 100) / 100;
        approximateRate = Math.round(approxLakhs * 100) / 100;
        midpointRate = Math.round(midLakhs * 1000) / 1000;
        lowerFormatted = "\u20B9".concat(lowerRate.toFixed(2), " L");
        upperFormatted = "\u20B9".concat(upperRate.toFixed(2), " L");
        approximateFormatted = "\u20B9".concat(approximateRate.toFixed(2), " L");
    }
    else {
        // Per Sq.Ft rates in Rupees
        var step = customStep !== null && customStep !== void 0 ? customStep : (rate >= 5000 ? 100 : 50);
        var lower = Math.floor(rate / step) * step;
        var upper = Math.ceil(rate / step) * step;
        if (lower === upper) {
            lower = Math.max(0, rate - step);
            upper = rate + step;
        }
        var approx = Math.round(rate / (step / 2)) * (step / 2);
        var mid = (lower + upper) / 2;
        lowerRate = lower;
        upperRate = upper;
        approximateRate = approx;
        midpointRate = mid;
        lowerFormatted = "\u20B9".concat(Math.round(lowerRate).toLocaleString('en-IN'));
        upperFormatted = "\u20B9".concat(Math.round(upperRate).toLocaleString('en-IN'));
        approximateFormatted = "\u20B9".concat(Math.round(approximateRate).toLocaleString('en-IN'));
    }
    var rangeFormatted = "".concat(lowerFormatted, " \u2013 ").concat(upperFormatted);
    var displayEstimatedRange = "Estimated Range: ".concat(rangeFormatted, " / ").concat(unit);
    var displayApproximateRate = "Approximate Market Rate: ".concat(approximateFormatted, " / ").concat(unit);
    return {
        rawRate: rawRate,
        lowerRate: lowerRate,
        upperRate: upperRate,
        approximateRate: approximateRate,
        midpointRate: midpointRate,
        unit: unit,
        isLakhs: isLakhUnit,
        lowerFormatted: lowerFormatted,
        upperFormatted: upperFormatted,
        approximateFormatted: approximateFormatted,
        rangeFormatted: rangeFormatted,
        displayEstimatedRange: displayEstimatedRange,
        displayApproximateRate: displayApproximateRate,
    };
}
