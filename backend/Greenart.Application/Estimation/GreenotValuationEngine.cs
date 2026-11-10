using Greenart.Domain.ValueObjects;

namespace Greenart.Application.Estimation;

public record ArithmeticValidationResult(
    bool IsValid,
    decimal CalculatedRatePerSqFt,
    decimal? AdvertisedRatePerSqFt,
    decimal DiscrepancyPct,
    decimal? DimensionAreaSqFt,
    string? Reason);

public record UnitRateRange(
    decimal? Low,
    decimal? Median,
    decimal? High);

public record AllUnitRates(
    decimal? PerCent,
    decimal? PerGround,
    decimal? PerAcre);

public record ConfidenceScoreBreakdown(
    int RegisteredTransactionsScore,
    int LocationAccuracyScore,
    int ComparableSimilarityScore,
    int RecencyScore,
    int SourceReliabilityScore,
    int SubjectCompletenessScore,
    int TotalScore);

public record ConfidenceScoreResult(
    int? Score,
    string Label,
    IReadOnlyList<string> HardGateReasons,
    ConfidenceScoreBreakdown Breakdown);

public record ComparableEvaluationDto(
    Guid Id,
    double DistanceMeters,
    decimal EffectiveRatePerSqFt,
    string EvidenceKind,
    string Verification,
    bool IsIncluded,
    decimal? ArithmeticDiscrepancyPct,
    string? ExclusionReason);

public record GreenotValuationResult(
    string Status, // "ok", "insufficient_evidence"
    string Basis,  // "registered_transactions", "asking_listings_only", "insufficient_evidence"
    decimal? Low,
    decimal? Median,
    decimal? High,
    string Currency,
    string Unit,
    UnitRateRange PerCent,
    UnitRateRange PerGround,
    UnitRateRange PerAcre,
    int SampleCount,
    int VerifiedTransactionCount,
    int AskingListingCount,
    int QuarantinedCount,
    ConfidenceScoreResult Confidence,
    IReadOnlyList<ComparableEvaluationDto> Comparables,
    string MethodVersion,
    string Disclaimer);

public record BuildingValuationInputDto(
    decimal BuiltUpAreaSqFt,
    string ConstructionType, // "RCC_Framed", "Load_Bearing", "Steel_Frame"
    int AgeYears,
    string Condition, // "good", "average", "poor"
    decimal ReplacementCostPerSqFt,
    bool IsDemolitionIntended = false,
    decimal RepairOrDemolitionCost = 0.00m);

public record BuildingValuationResultDto(
    decimal GrossReplacementCost,
    decimal DepreciationPct,
    decimal DepreciatedBuildingValue,
    decimal RepairOrDemolitionCost,
    bool IsDemolitionIntended,
    decimal NetBuildingValue,
    decimal TotalPropertyValue);

public static class GreenotValuationEngine
{
    public const decimal SqFtPerCent = 435.6m;
    public const decimal SqFtPerGround = 2400.0m; // Chennai urban standard
    public const decimal SqFtPerAcre = 43560.0m;
    public const decimal SqFtPerSqMeter = 10.7639104m;

    public static AllUnitRates ConvertSqFtRateToAllUnits(decimal? ratePerSqFt)
    {
        if (!ratePerSqFt.HasValue)
        {
            return new AllUnitRates(null, null, null);
        }

        var sqft = ratePerSqFt.Value;
        return new AllUnitRates(
            PerCent: Math.Round(sqft * SqFtPerCent, 2),
            PerGround: Math.Round(sqft * SqFtPerGround, 2),
            PerAcre: Math.Round(sqft * SqFtPerAcre, 2));
    }

    /// <summary>
    /// Validates listing arithmetic against claimed price, area, and optional dimension string (e.g. "76x45").
    /// Rejects or flags discrepancies exceeding tolerancePct (default: 2.0%).
    /// </summary>
    public static ArithmeticValidationResult ValidateListingArithmetic(
        decimal totalPriceInr,
        decimal landAreaSqFt,
        decimal? advertisedRatePerSqFt = null,
        string? dimensionsFt = null,
        decimal tolerancePct = 2.0m)
    {
        if (landAreaSqFt <= 0 || totalPriceInr <= 0)
        {
            return new ArithmeticValidationResult(
                IsValid: false,
                CalculatedRatePerSqFt: 0m,
                AdvertisedRatePerSqFt: advertisedRatePerSqFt,
                DiscrepancyPct: 100m,
                DimensionAreaSqFt: null,
                Reason: "Land area and total price must be strictly positive.");
        }

        var effectiveArea = landAreaSqFt;
        decimal? dimensionArea = null;

        if (!string.IsNullOrWhiteSpace(dimensionsFt))
        {
            var parts = dimensionsFt.ToLowerInvariant()
                .Split(new[] { 'x', 'X', '*', '×', ' ' }, StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length == 2 &&
                decimal.TryParse(parts[0], out var len) &&
                decimal.TryParse(parts[1], out var wid) &&
                len > 0 && wid > 0)
            {
                dimensionArea = Math.Round(len * wid, 2);
                var areaMismatchPct = Math.Abs(landAreaSqFt - dimensionArea.Value) / dimensionArea.Value * 100m;
                if (areaMismatchPct > tolerancePct)
                {
                    var calcRate = Math.Round(totalPriceInr / dimensionArea.Value, 2);
                    return new ArithmeticValidationResult(
                        IsValid: false,
                        CalculatedRatePerSqFt: calcRate,
                        AdvertisedRatePerSqFt: advertisedRatePerSqFt,
                        DiscrepancyPct: Math.Round(areaMismatchPct, 2),
                        DimensionAreaSqFt: dimensionArea,
                        Reason: $"Stated area {landAreaSqFt} sq.ft does not match dimension product {len}x{wid} = {dimensionArea} sq.ft ({areaMismatchPct:F1}% discrepancy).");
                }
                effectiveArea = dimensionArea.Value;
            }
        }

        var calculatedRate = Math.Round(totalPriceInr / effectiveArea, 2);

        if (advertisedRatePerSqFt.HasValue && advertisedRatePerSqFt.Value > 0)
        {
            var discrepancyPct = Math.Round(
                Math.Abs(advertisedRatePerSqFt.Value - calculatedRate) / calculatedRate * 100m, 2);

            if (discrepancyPct > tolerancePct)
            {
                return new ArithmeticValidationResult(
                    IsValid: false,
                    CalculatedRatePerSqFt: calculatedRate,
                    AdvertisedRatePerSqFt: advertisedRatePerSqFt,
                    DiscrepancyPct: discrepancyPct,
                    DimensionAreaSqFt: dimensionArea,
                    Reason: $"Advertised rate ₹{advertisedRatePerSqFt.Value:N0}/sq.ft differs from calculated rate ₹{calculatedRate:N0}/sq.ft by {discrepancyPct:F1}% (exceeds {tolerancePct}% tolerance).");
            }
        }

        return new ArithmeticValidationResult(
            IsValid: true,
            CalculatedRatePerSqFt: calculatedRate,
            AdvertisedRatePerSqFt: advertisedRatePerSqFt,
            DiscrepancyPct: 0.0m,
            DimensionAreaSqFt: dimensionArea,
            Reason: null);
    }

    public static decimal CalculatePercentile(IReadOnlyList<decimal> sortedValues, double percentile)
    {
        if (sortedValues == null || sortedValues.Count == 0) return 0m;
        if (sortedValues.Count == 1) return sortedValues[0];
        if (percentile <= 0.0) return sortedValues[0];
        if (percentile >= 1.0) return sortedValues[^1];

        var index = (sortedValues.Count - 1) * percentile;
        var lower = (int)Math.Floor(index);
        var upper = (int)Math.Ceiling(index);
        var weight = (decimal)(index - lower);

        if (lower == upper) return sortedValues[lower];
        return Math.Round(sortedValues[lower] * (1m - weight) + sortedValues[upper] * weight, 2);
    }

    public static BuildingValuationResultDto CalculateBuildingValuation(
        decimal landValueInr,
        BuildingValuationInputDto input)
    {
        var grossCost = Math.Round(input.BuiltUpAreaSqFt * input.ReplacementCostPerSqFt, 2);

        var annualDepreciationPct = input.ConstructionType switch
        {
            "Load_Bearing" => 2.0m,
            "Steel_Frame" => 1.25m,
            _ => 1.5m // RCC_Framed default
        };

        var totalDepreciationPct = Math.Min(75.0m, input.AgeYears * annualDepreciationPct);

        if (input.Condition.Equals("poor", StringComparison.OrdinalIgnoreCase))
            totalDepreciationPct = Math.Min(85.0m, totalDepreciationPct + 10.0m);
        else if (input.Condition.Equals("good", StringComparison.OrdinalIgnoreCase))
            totalDepreciationPct = Math.Max(5.0m, totalDepreciationPct - 5.0m);

        var depreciatedValue = Math.Round(grossCost * (1m - totalDepreciationPct / 100m), 2);

        decimal netBuildingValue;
        if (input.IsDemolitionIntended)
        {
            netBuildingValue = -input.RepairOrDemolitionCost;
        }
        else
        {
            netBuildingValue = Math.Max(0m, depreciatedValue - input.RepairOrDemolitionCost);
        }

        var totalPropertyValue = Math.Max(0m, landValueInr + netBuildingValue);

        return new BuildingValuationResultDto(
            GrossReplacementCost: grossCost,
            DepreciationPct: totalDepreciationPct,
            DepreciatedBuildingValue: depreciatedValue,
            RepairOrDemolitionCost: input.RepairOrDemolitionCost,
            IsDemolitionIntended: input.IsDemolitionIntended,
            NetBuildingValue: netBuildingValue,
            TotalPropertyValue: totalPropertyValue);
    }
}
