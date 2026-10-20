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

    public EstimationEngine(ILandPriceRepository repository)
    {
        _repository = repository;
    }

    public async Task<object> EstimateMarketPriceAsync(CalculateEstimateRequest request, CancellationToken cancellationToken = default)
    {
        var targetCoord = new GeoCoordinate(request.Latitude, request.Longitude);
        var targetCoordDto = new CoordinatesDto(targetCoord.Latitude, targetCoord.Longitude);
        var radiusMeters = request.RadiusMeters > 0 ? Math.Min(request.RadiusMeters, MaxRadiusMeters) : DefaultRadiusMeters;

        // 1. Retrieve candidates within radius
        var candidates = await _repository.GetNearbyComparableAsync(
            targetCoord.Latitude,
            targetCoord.Longitude,
            radiusMeters,
            request.LandUsage,
            cancellationToken);

        // 2. Separate Government Guideline Values from Market Evidence
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

        // 3. Filter eligible market records (Verified Transactions, Advertised Asking, Client Research)
        var asOfDate = DateTime.UtcNow;
        var eligibleMarketRecords = candidates
            .Where(r => r.SourceCategory != SourceCategory.GovernmentGuideline)
            .Where(r => r.IsEligibleForMarketEstimation(asOfDate, MaxRecordAgeMonths))
            .ToList();

        // 4. Insufficient Data Check (Strict Rule: Minimum 3 records required)
        if (eligibleMarketRecords.Count < MinimumRecordThreshold)
        {
            return new EstimateInsufficientDataResponse(
                Status: "InsufficientData",
                TargetCoordinates: targetCoordDto,
                SearchRadiusMeters: radiusMeters,
                ComparableRecordsFound: eligibleMarketRecords.Count,
                MinimumRequiredRecords: MinimumRecordThreshold,
                Message: $"Only {eligibleMarketRecords.Count} comparable market record(s) found within {radiusMeters:N0} meters for {request.LandUsage} land classification. A minimum of {MinimumRecordThreshold} comparable records is strictly required to compute a reliable statistical estimate.",
                Recommendations: new List<string>
                {
                    "Expand the search radius to 2,000 meters if appropriate for this rural/semi-urban locality.",
                    "Verify if client research documents or unverified broker listings in this sector can be audited and promoted.",
                    "Review nearby pilot hubs (Kannampalayam or Sulur Corridor) where dense verified transaction history is available."
                }
            );
        }

        // 5. Statistical Calculations: Sort rates
        var centRates = eligibleMarketRecords.Select(r => r.NormalizedRatePerCent).OrderBy(r => r).ToList();
        var sqftRates = eligibleMarketRecords.Select(r => r.NormalizedRatePerSqFt).OrderBy(r => r).ToList();

        // Outlier detection when sample size >= 8 using IQR
        if (centRates.Count >= 8)
        {
            var q1 = GetPercentile(centRates, 0.25);
            var q3 = GetPercentile(centRates, 0.75);
            var iqr = q3 - q1;
            var lowerFence = q1 - (1.5m * iqr);
            var upperFence = q3 + (1.5m * iqr);

            var filtered = eligibleMarketRecords
                .Where(r => r.NormalizedRatePerCent >= lowerFence && r.NormalizedRatePerCent <= upperFence)
                .ToList();

            if (filtered.Count >= MinimumRecordThreshold)
            {
                centRates = filtered.Select(r => r.NormalizedRatePerCent).OrderBy(r => r).ToList();
                sqftRates = filtered.Select(r => r.NormalizedRatePerSqFt).OrderBy(r => r).ToList();
            }
        }

        var priceRangePerCent = BuildPriceRange(centRates, "₹ / Cent");
        var priceRangePerSqFt = BuildPriceRange(sqftRates, "₹ / Sq.Ft");

        // 6. Explicit Confidence Rating Rules
        var verifiedCount = eligibleMarketRecords.Count(r => r.SourceCategory == SourceCategory.VerifiedTransaction);
        var confidence = CalculateConfidence(eligibleMarketRecords.Count, verifiedCount);

        // 7. Source breakdown
        var sourceBreakdown = eligibleMarketRecords
            .GroupBy(r => r.SourceCategory)
            .Select(g => new SourceCategoryBreakdownDto(g.Key.ToString(), g.Count()))
            .ToList();

        return new EstimateSuccessResponse(
            Status: "Success",
            TargetCoordinates: targetCoordDto,
            SearchRadiusMeters: radiusMeters,
            ComparableRecordCount: eligibleMarketRecords.Count,
            Confidence: confidence,
            PriceRangePerCent: priceRangePerCent,
            PriceRangePerSqFt: priceRangePerSqFt,
            EarliestRecordDate: eligibleMarketRecords.Min(r => r.ObservationDate),
            LatestRecordDate: eligibleMarketRecords.Max(r => r.ObservationDate),
            SourceBreakdown: sourceBreakdown,
            GovernmentGuidelineReference: guidelineBenchmark,
            Disclaimer: "This indicative land market estimate is calculated via statistical aggregation (Median & IQR) of local comparable evidence within 1,000 meters. It does not constitute a guaranteed sale price, official legal appraisal, or financial commitment by Greenart Properties."
        );
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
