using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Application.Estimation;

public interface IEstimationEngine
{
    Task<object> EstimateMarketPriceAsync(CalculateEstimateRequest request, CancellationToken cancellationToken = default);
}

public class EstimationEngine : IEstimationEngine
{
    public const int MinimumRecordThreshold = 3;
    public const int DefaultRadiusMeters = 1000;
    public const int MaxRadiusMeters = 5000;
    public const int MaxRecordAgeMonths = 36;

    private readonly ILandPriceRepository _repository;
    private readonly ILandLensClient? _landLensClient;

    public EstimationEngine(ILandPriceRepository repository, ILandLensClient? landLensClient = null)
    {
        _repository = repository;
        _landLensClient = landLensClient;
    }

    public async Task<object> EstimateMarketPriceAsync(CalculateEstimateRequest request, CancellationToken cancellationToken = default)
    {
        var targetCoord = new GeoCoordinate(request.Latitude, request.Longitude);
        var targetCoordDto = new CoordinatesDto(targetCoord.Latitude, targetCoord.Longitude);
        var radiusMeters = request.RadiusMeters > 0 ? Math.Min(request.RadiusMeters, MaxRadiusMeters) : DefaultRadiusMeters;

        // 1. Retrieve candidates within radius and matching land classification
        var candidates = await _repository.GetNearbyComparableAsync(
            targetCoord.Latitude,
            targetCoord.Longitude,
            radiusMeters,
            request.LandUsage,
            cancellationToken);

        // 2. LAYER 3: Government Guideline Benchmark (Statutory baseline)
        // Rule: Guideline values must NEVER be blended into the market transaction pool
        var guidelineRecord = candidates.FirstOrDefault(r => r.SourceCategory == SourceCategory.GovernmentGuideline);
        GuidelineReferenceDto? guidelineBenchmark = null;
        if (guidelineRecord != null)
        {
            guidelineBenchmark = new GuidelineReferenceDto(
                GuidelineRatePerCent: guidelineRecord.NormalizedRatePerCent,
                GuidelineRatePerSqFt: guidelineRecord.NormalizedRatePerSqFt,
                Locality: guidelineRecord.Locality,
                SurveyNumber: guidelineRecord.SurveyNumber,
                LegalNotice: "Statutory minimum valuation benchmark from TNREGINET for stamp duty calculation. Not an open-market transaction."
            );
        }
        else if (_landLensClient != null && _landLensClient.IsConfigured)
        {
            try
            {
                // Step A: Resolve parcel to extract revenue village/district/survey
                var parcel = await _landLensClient.ResolveParcelAsync(targetCoord.Latitude, targetCoord.Longitude, cancellationToken);

                // Step B: Query guideline value using coordinates and resolved parcel details
                var gl = await _landLensClient.GetGuidelineValueAsync(new GuidelineValueRequest
                {
                    Lat = targetCoord.Latitude,
                    Lng = targetCoord.Longitude,
                    DistrictName = parcel?.DistrictName,
                    VillageName = parcel?.VillageName,
                    SurveyNumber = parcel?.SurveyNumber,
                    RuralUrban = parcel?.RuralUrban,
                    UrbanBlockNumber = parcel?.UrbanBlockNumber,
                    FirkaWardNumber = parcel?.FirkaWardNumber
                }, cancellationToken);

                if (gl != null && ((gl.GuidelineRatePerCent.HasValue && gl.GuidelineRatePerCent > 0) ||
                                  (gl.GuidelineRatePerSqFt.HasValue && gl.GuidelineRatePerSqFt > 0)))
                {
                    guidelineBenchmark = new GuidelineReferenceDto(
                        GuidelineRatePerCent: gl.GuidelineRatePerCent ?? Math.Round((gl.GuidelineRatePerSqFt ?? 0) * LandArea.SqFtPerCent, 2),
                        GuidelineRatePerSqFt: gl.GuidelineRatePerSqFt ?? Math.Round((gl.GuidelineRatePerCent ?? 0) / LandArea.SqFtPerCent, 2),
                        Locality: gl.StreetName ?? parcel?.VillageName ?? "Resolved Area",
                        SurveyNumber: parcel?.SurveyNumber,
                        LegalNotice: "Statutory minimum guideline rate from TNREGINET (via LandLens live feed). Not an open-market transaction."
                    );
                }
                else if (parcel != null && !string.IsNullOrWhiteSpace(parcel.VillageName))
                {
                    // Step C: Fallback to village locality value distribution if specific survey is unrated / govt land
                    var loc = await _landLensClient.GetLocalityValueContextAsync(parcel.VillageName, null, cancellationToken);
                    if (loc != null && loc.MedianRatePerSqFt > 0)
                    {
                        var centRate = Math.Round(loc.MedianRatePerSqFt * LandArea.SqFtPerCent, 2);
                        var localityLabel = loc.PricedStreetsCount > 0
                            ? $"{loc.VillageName} (Benchmark: ₹{loc.MedianRatePerSqFt:N0}/sq.ft across {loc.PricedStreetsCount} streets)"
                            : loc.VillageName;

                        guidelineBenchmark = new GuidelineReferenceDto(
                            GuidelineRatePerCent: centRate,
                            GuidelineRatePerSqFt: loc.MedianRatePerSqFt,
                            Locality: localityLabel,
                            SurveyNumber: parcel.SurveyNumber,
                            LegalNotice: $"Statutory guideline benchmark for {loc.VillageName} from TNREGINET (via LandLens). Range: ₹{loc.MinRatePerSqFt:N0} - ₹{loc.MaxRatePerSqFt:N0}/sq.ft. Not an open-market transaction."
                        );
                    }
                }
            }
            catch
            {
                // Non-blocking statutory benchmark fallback
            }
        }

        // 3. LAYER 2: Advertised Asking Price Reference (Seller sentiment)
        // Rule: Asking prices must NEVER be blended into the primary market median.
        // They are kept as an independent reference layer without arbitrary negotiation discounts.
        var askingRecords = candidates
            .Where(r => r.SourceCategory == SourceCategory.AdvertisedAskingPrice)
            .Where(r => r.VerificationStatus != VerificationStatus.Rejected && r.VerificationStatus != VerificationStatus.Archived)
            .Where(r => r.NormalizedRatePerSqFt > 0 && r.NormalizedRatePerCent > 0)
            .ToList();

        AskingPriceReferenceDto? askingPriceReference = null;
        if (askingRecords.Count > 0)
        {
            var askingSqFtRates = askingRecords.Select(r => r.NormalizedRatePerSqFt).OrderBy(r => r).ToList();
            var askingCentRates = askingRecords.Select(r => r.NormalizedRatePerCent).OrderBy(r => r).ToList();

            askingPriceReference = new AskingPriceReferenceDto(
                ListingCount: askingRecords.Count,
                MedianRatePerSqFt: Math.Round(GetPercentile(askingSqFtRates, 0.50), 2),
                MedianRatePerCent: Math.Round(GetPercentile(askingCentRates, 0.50), 2),
                MinRatePerSqFt: Math.Round(askingSqFtRates.First(), 2),
                MaxRatePerSqFt: Math.Round(askingSqFtRates.Last(), 2),
                Notice: "Independent asking-price reference from advertised property listings within search radius. Reflects seller expectations before negotiations. Not an agreed or completed sale price."
            );
        }

        // 4. LAYER 1: Verified Completed-Sale Market Evidence
        // Rule: ONLY verified completed conveyances enter the primary market valuation pool.
        var asOfDate = DateTime.UtcNow;
        var eligibleCompletedSales = candidates
            .Where(r => r.IsEligibleForMarketEstimation(asOfDate, MaxRecordAgeMonths))
            .ToList();

        // 5. Insufficient Data Check (Strict Rule: Minimum 3 verified completed sales required)
        if (eligibleCompletedSales.Count < MinimumRecordThreshold)
        {
            decimal? totalGuidelineValuation = null;
            if (guidelineBenchmark != null && request.TargetArea.HasValue && request.TargetArea.Value > 0)
            {
                var unit = request.TargetAreaUnit ?? request.PreferredUnit;
                var targetAreaObj = new LandArea(request.TargetArea.Value, unit);
                totalGuidelineValuation = Math.Round(guidelineBenchmark.GuidelineRatePerSqFt * targetAreaObj.ToSqFt(), 2);
            }

            return new EstimateInsufficientDataResponse(
                Status: "InsufficientData",
                TargetCoordinates: targetCoordDto,
                SearchRadiusMeters: radiusMeters,
                ComparableRecordsFound: eligibleCompletedSales.Count,
                MinimumRequiredRecords: MinimumRecordThreshold,
                Message: $"Only {eligibleCompletedSales.Count} verified completed-sale transaction(s) found within {radiusMeters:N0} meters for {request.LandUsage} land classification. A minimum of {MinimumRecordThreshold} verified completed sales is strictly required to compute an evidence-based market valuation.",
                Recommendations: new List<string>
                {
                    $"Expand the search radius up to {MaxRadiusMeters:N0} meters if appropriate for this locality.",
                    "Review advertised asking prices or statutory guideline benchmark for secondary reference.",
                    "Verify and promote registered sale deeds or encumbrance certificates (EC) in this revenue village."
                },
                GovernmentGuidelineReference: guidelineBenchmark,
                AskingPriceReference: askingPriceReference,
                TotalGuidelineValuation: totalGuidelineValuation
            );
        }

        // 6. Valuation Mathematics: Outlier filtering (MAD for small samples, IQR for N >= 8, zero-dispersion safe)
        var filteredRecords = FilterOutliers(eligibleCompletedSales, out var outlierAudit);

        var centRates = filteredRecords.Select(r => r.NormalizedRatePerCent).OrderBy(r => r).ToList();
        var sqftRates = filteredRecords.Select(r => r.NormalizedRatePerSqFt).OrderBy(r => r).ToList();

        var priceRangePerCent = BuildPriceRange(centRates, "₹ / Cent");
        var priceRangePerSqFt = BuildPriceRange(sqftRates, "₹ / Sq.Ft");

        // 7. Confidence Rating: Based strictly on verified transaction evidence count
        var confidence = CalculateConfidence(filteredRecords.Count);

        // 8. Source Category Breakdown
        var sourceBreakdown = eligibleCompletedSales
            .GroupBy(r => r.SourceCategory)
            .Select(g => new SourceCategoryBreakdownDto(g.Key.ToString(), g.Count()))
            .ToList();

        // 9. Total Land Value Calculation (Optional based on user provided TargetArea)
        TotalValuationDto? totalValuation = null;
        if (request.TargetArea.HasValue && request.TargetArea.Value > 0)
        {
            var areaUnit = request.TargetAreaUnit ?? request.PreferredUnit;
            var targetAreaObj = new LandArea(request.TargetArea.Value, areaUnit);
            var equivSqFt = targetAreaObj.ToSqFt();
            var equivCents = targetAreaObj.ToCents();

            var totalEst = Math.Round(priceRangePerSqFt.MedianRate * equivSqFt, 2);
            var totalMin = Math.Round(priceRangePerSqFt.MinRate * equivSqFt, 2);
            var totalMax = Math.Round(priceRangePerSqFt.MaxRate * equivSqFt, 2);

            decimal? totalGuideline = null;
            if (guidelineBenchmark != null)
            {
                totalGuideline = Math.Round(guidelineBenchmark.GuidelineRatePerSqFt * equivSqFt, 2);
            }

            totalValuation = new TotalValuationDto(
                TotalEstimatedPrice: totalEst,
                TotalPriceMin: totalMin,
                TotalPriceMax: totalMax,
                AreaValue: request.TargetArea.Value,
                AreaUnit: areaUnit.ToString(),
                EquivalentSqFt: Math.Round(equivSqFt, 2),
                EquivalentCents: Math.Round(equivCents, 2),
                TotalGuidelinePrice: totalGuideline
            );
        }

        // 10. Transparent Calculation Explanation
        var explanation = $"Calculated from {eligibleCompletedSales.Count} verified completed-sale deed(s) within {radiusMeters:N0}m radius for {request.LandUsage} classification. " +
            $"Outlier evaluation: {outlierAudit}. " +
            $"Primary market estimate uses the median rate of ₹{priceRangePerSqFt.MedianRate:N2}/sq.ft (₹{priceRangePerCent.MedianRate:N2}/cent) to eliminate skew from high/low extremes. " +
            $"The interquartile range spans from ₹{priceRangePerSqFt.Percentile25:N2} (P25) to ₹{priceRangePerSqFt.Percentile75:N2} (P75)/sq.ft. " +
            (guidelineBenchmark != null ? $"TNREGINET statutory guideline rate of ₹{guidelineBenchmark.GuidelineRatePerSqFt:N2}/sq.ft is kept strictly in a separate benchmark layer. " : "") +
            (askingPriceReference != null ? $"Advertised asking prices ({askingPriceReference.ListingCount} listing(s) at median ₹{askingPriceReference.MedianRatePerSqFt:N2}/sq.ft) are tracked as an independent seller-sentiment layer without arbitrary negotiation discounts applied. " : "") +
            (totalValuation != null ? $"For the requested area of {totalValuation.AreaValue} {totalValuation.AreaUnit} ({totalValuation.EquivalentSqFt:N0} sq.ft / {totalValuation.EquivalentCents:N2} cents), total indicative market valuation is ₹{totalValuation.TotalEstimatedPrice:N0}." : "");

        return new EstimateSuccessResponse(
            Status: "Success",
            TargetCoordinates: targetCoordDto,
            SearchRadiusMeters: radiusMeters,
            ComparableRecordCount: filteredRecords.Count,
            Confidence: confidence,
            PriceRangePerCent: priceRangePerCent,
            PriceRangePerSqFt: priceRangePerSqFt,
            EarliestRecordDate: eligibleCompletedSales.Min(r => r.ObservationDate),
            LatestRecordDate: eligibleCompletedSales.Max(r => r.ObservationDate),
            SourceBreakdown: sourceBreakdown,
            GovernmentGuidelineReference: guidelineBenchmark,
            Disclaimer: "This indicative land market estimate is calculated via statistical aggregation (Median & IQR/MAD) of verified registered completed-sale deeds within the search radius. It does not constitute a guaranteed sale price, official legal appraisal, or financial commitment by Greenart Properties.",
            AskingPriceReference: askingPriceReference,
            TotalValuation: totalValuation,
            CalculationExplanation: explanation
        );
    }

    /// <summary>
    /// Safe outlier filtering:
    /// - For N < 4: sample too small to filter without risk of false rejections; retain all.
    /// - For 4 <= N <= 7: Median Absolute Deviation (MAD 3-sigma). Safe zero-dispersion check (if MAD == 0, retain all).
    /// - For N >= 8: Tukey Interquartile Range (IQR 1.5). Safe zero-dispersion check (if IQR == 0, retain all).
    /// In all cases, filtering is discarded if it would reduce eligible records below MinimumRecordThreshold (3).
    /// </summary>
    public static List<LandPriceRecord> FilterOutliers(List<LandPriceRecord> records, out string outlierAudit)
    {
        if (records.Count < 4)
        {
            outlierAudit = "Sample size < 4; all records preserved without outlier dropping";
            return records;
        }

        var sqftRates = records.Select(r => r.NormalizedRatePerSqFt).OrderBy(r => r).ToList();

        if (records.Count >= 8)
        {
            var q1 = GetPercentile(sqftRates, 0.25);
            var q3 = GetPercentile(sqftRates, 0.75);
            var iqr = q3 - q1;

            if (iqr == 0)
            {
                outlierAudit = "Tukey IQR (Zero dispersion detected: rates identical or tightly clustered; all records retained)";
                return records;
            }

            var lowerFence = q1 - (1.5m * iqr);
            var upperFence = q3 + (1.5m * iqr);

            var filtered = records
                .Where(r => r.NormalizedRatePerSqFt >= lowerFence && r.NormalizedRatePerSqFt <= upperFence)
                .ToList();

            if (filtered.Count >= MinimumRecordThreshold)
            {
                var droppedCount = records.Count - filtered.Count;
                outlierAudit = $"Tukey IQR applied [₹{lowerFence:N2}, ₹{upperFence:N2}]: {droppedCount} outlier(s) filtered, {filtered.Count} retained";
                return filtered;
            }

            outlierAudit = "Tukey IQR (Filtering would reduce sample below minimum threshold; all records retained)";
            return records;
        }
        else
        {
            // Small sample (4 <= N <= 7): MAD (Median Absolute Deviation)
            var median = GetPercentile(sqftRates, 0.50);
            var absoluteDeviations = sqftRates.Select(r => Math.Abs(r - median)).OrderBy(d => d).ToList();
            var mad = GetPercentile(absoluteDeviations, 0.50);

            if (mad == 0)
            {
                outlierAudit = "MAD (Zero dispersion detected: rates identical or tightly clustered; all records retained)";
                return records;
            }

            // Consistency factor 1.4826 for normal distribution equivalence
            var sigma = 1.4826m * mad;
            var lowerFence = median - (3m * sigma);
            var upperFence = median + (3m * sigma);

            var filtered = records
                .Where(r => r.NormalizedRatePerSqFt >= lowerFence && r.NormalizedRatePerSqFt <= upperFence)
                .ToList();

            if (filtered.Count >= MinimumRecordThreshold)
            {
                var droppedCount = records.Count - filtered.Count;
                outlierAudit = $"MAD 3-sigma applied [₹{lowerFence:N2}, ₹{upperFence:N2}]: {droppedCount} outlier(s) filtered, {filtered.Count} retained";
                return filtered;
            }

            outlierAudit = "MAD (Filtering would reduce sample below minimum threshold; all records retained)";
            return records;
        }
    }

    public static string CalculateConfidence(int verifiedCount)
    {
        if (verifiedCount < MinimumRecordThreshold) return "Insufficient";
        if (verifiedCount >= 10) return "High";
        if (verifiedCount >= 5) return "Moderate";
        return "Low";
    }

    public static string CalculateConfidence(int totalRecords, int verifiedRecords)
    {
        if (totalRecords < MinimumRecordThreshold) return "Insufficient";
        if (totalRecords >= 10 && verifiedRecords >= 3) return "High";
        if (totalRecords >= 5 || verifiedRecords >= 2) return "Moderate";
        return "Low";
    }

    public static PriceRangeDto BuildPriceRange(List<decimal> sorted, string unit)
    {
        var min = sorted.First();
        var max = sorted.Last();
        var median = GetPercentile(sorted, 0.50);
        var q1 = GetPercentile(sorted, 0.25);
        var q3 = GetPercentile(sorted, 0.75);

        return new PriceRangeDto(
            MinRate: Math.Round(min, 2),
            Percentile25: Math.Round(q1, 2),
            MedianRate: Math.Round(median, 2),
            Percentile75: Math.Round(q3, 2),
            MaxRate: Math.Round(max, 2),
            Unit: unit
        );
    }

    public static decimal GetPercentile(List<decimal> sorted, double percentile)
    {
        if (sorted.Count == 0) return 0;
        if (sorted.Count == 1) return sorted[0];

        double rank = percentile * (sorted.Count - 1);
        int low = (int)Math.Floor(rank);
        int high = (int)Math.Ceiling(rank);

        if (low == high) return sorted[low];

        decimal fraction = (decimal)(rank - low);
        return sorted[low] + fraction * (sorted[high] - sorted[low]);
    }
}
