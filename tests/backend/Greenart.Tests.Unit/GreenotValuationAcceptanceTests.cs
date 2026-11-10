using Greenart.Application.Estimation;
using Xunit;

namespace Greenart.Tests.Unit;

public class GreenotValuationAcceptanceTests
{
    [Fact]
    public void UnitConversion_At10000PerSqFt_MatchesAcceptanceStandard()
    {
        // Specification Acceptance Criteria:
        // ₹10,000 / Sq.ft → Cent ₹43,56,000; Ground ₹2,40,00,000; Acre ₹4,35,60,000.
        decimal ratePerSqFt = 10000m;

        var converted = GreenotValuationEngine.ConvertSqFtRateToAllUnits(ratePerSqFt);

        Assert.Equal(4356000.00m, converted.PerCent);
        Assert.Equal(24000000.00m, converted.PerGround);
        Assert.Equal(435600000.00m, converted.PerAcre);
    }

    [Fact]
    public void AreaPriceArithmetic_KodambakkamListingMismatch_FlagsErrorAccurately()
    {
        // Specification Acceptance Criteria:
        // 76 × 45 ft; total ₹3.8 crore.
        // Area 3,420 Sq.ft; recalculated rate ≈ ₹11,111.11/Sq.ft.
        // If a listing states ₹16,590/Sq.ft, flag the mismatch (>2%); do not silently overwrite it.
        decimal totalPrice = 38000000m; // ₹3.8 Crore
        decimal statedArea = 3420m;
        string dimensions = "76x45";
        decimal advertisedRate = 16590m;

        var result = GreenotValuationEngine.ValidateListingArithmetic(
            totalPriceInr: totalPrice,
            landAreaSqFt: statedArea,
            advertisedRatePerSqFt: advertisedRate,
            dimensionsFt: dimensions,
            tolerancePct: 2.0m);

        Assert.False(result.IsValid);
        Assert.Equal(3420m, result.DimensionAreaSqFt);
        Assert.Equal(11111.11m, result.CalculatedRatePerSqFt);
        Assert.True(result.DiscrepancyPct > 49.0m, $"Expected discrepancy ~49.3%, got {result.DiscrepancyPct}%");
        Assert.Contains("differs from calculated rate", result.Reason);
        Assert.Contains("exceeds", result.Reason);
        Assert.Contains("tolerance", result.Reason);
    }

    [Fact]
    public void AreaPriceArithmetic_ValidListing_PassesValidation()
    {
        // Plot of 2,400 sq.ft (1 Ground) listed at ₹2.4 Crore with advertised rate ₹10,000/sq.ft
        decimal totalPrice = 24000000m;
        decimal statedArea = 2400m;
        decimal advertisedRate = 10000m;

        var result = GreenotValuationEngine.ValidateListingArithmetic(
            totalPriceInr: totalPrice,
            landAreaSqFt: statedArea,
            advertisedRatePerSqFt: advertisedRate,
            dimensionsFt: "60x40",
            tolerancePct: 2.0m);

        Assert.True(result.IsValid);
        Assert.Equal(10000.00m, result.CalculatedRatePerSqFt);
        Assert.Equal(0.0m, result.DiscrepancyPct);
        Assert.Null(result.Reason);
    }

    [Fact]
    public void PercentileCalculation_LinearInterpolation_IsDeterministic()
    {
        var values = new List<decimal> { 10000m, 12000m, 14000m, 16000m, 18000m };

        var p25 = GreenotValuationEngine.CalculatePercentile(values, 0.25);
        var p50 = GreenotValuationEngine.CalculatePercentile(values, 0.50);
        var p75 = GreenotValuationEngine.CalculatePercentile(values, 0.75);

        Assert.Equal(12000m, p25);
        Assert.Equal(14000m, p50);
        Assert.Equal(16000m, p75);
    }

    [Fact]
    public void BuildingValuation_StandardRccDepreciation_CalculatesAccurately()
    {
        // 2,000 sq.ft built-up area, ₹2,500/sq.ft replacement cost, 20-year-old RCC building
        // Gross cost = ₹50,00,000. Annual depreciation = 1.5% * 20 = 30%.
        // Depreciated building value = ₹50,00,000 * 0.70 = ₹35,00,000.
        // Land value = ₹1,00,00,000 (₹1 Crore).
        decimal landValue = 10000000m;
        var input = new BuildingValuationInputDto(
            BuiltUpAreaSqFt: 2000m,
            ConstructionType: "RCC_Framed",
            AgeYears: 20,
            Condition: "average",
            ReplacementCostPerSqFt: 2500m,
            IsDemolitionIntended: false,
            RepairOrDemolitionCost: 0m);

        var result = GreenotValuationEngine.CalculateBuildingValuation(landValue, input);

        Assert.Equal(5000000.00m, result.GrossReplacementCost);
        Assert.Equal(30.0m, result.DepreciationPct);
        Assert.Equal(3500000.00m, result.DepreciatedBuildingValue);
        Assert.Equal(3500000.00m, result.NetBuildingValue);
        Assert.Equal(13500000.00m, result.TotalPropertyValue);
    }

    [Fact]
    public void BuildingValuation_DemolitionIntended_DeductsCostFromLandValue()
    {
        // Land value = ₹1 Crore, Demolition cost = ₹3,00,000
        // Net building value = -₹3,00,000
        // Total property value = ₹97,00,000
        decimal landValue = 10000000m;
        var input = new BuildingValuationInputDto(
            BuiltUpAreaSqFt: 2000m,
            ConstructionType: "RCC_Framed",
            AgeYears: 45,
            Condition: "poor",
            ReplacementCostPerSqFt: 2500m,
            IsDemolitionIntended: true,
            RepairOrDemolitionCost: 300000m);

        var result = GreenotValuationEngine.CalculateBuildingValuation(landValue, input);

        Assert.True(result.IsDemolitionIntended);
        Assert.Equal(-300000m, result.NetBuildingValue);
        Assert.Equal(9700000m, result.TotalPropertyValue);
    }

    [Fact]
    public void ChennaiKodambakkamPilot_AcceptanceCoordinates_EvaluatesCleanly()
    {
        // Subject property: 7-4-A, Dr. Subbaraya Nagar, Kodambakkam (13.047006, 80.215154)
        double subjectLat = 13.047006;
        double subjectLng = 80.215154;

        Assert.True(subjectLat > 13.0 && subjectLng > 80.0);

        // Ground is standard in Chennai
        decimal testRate = 18000m; // ₹18,000 / sq.ft typical Kodambakkam central residential
        var allUnits = GreenotValuationEngine.ConvertSqFtRateToAllUnits(testRate);

        Assert.Equal(7840800.00m, allUnits.PerCent);   // ₹78.41 Lakh / Cent
        Assert.Equal(43200000.00m, allUnits.PerGround); // ₹4.32 Crore / Ground (2,400 sq.ft)
        Assert.Equal(784080000.00m, allUnits.PerAcre);  // ₹78.41 Crore / Acre
    }

    [Fact]
    public void MarketRateBuffer_UserInput10Point92LakhsPerCent_WrapsToUserFriendlyRangeAndAnchor()
    {
        // User Specification & Requirement:
        // Input Data: 10.92 L / Cent
        // App Output Display:
        //   • Estimated Range: ₹10.75 L – ₹11.00 L / Cent
        //   • Approximate Market Rate: ₹10.90 L / Cent
        decimal inputRate = 10.92m;

        var buffer = GreenotValuationEngine.CalculateMarketRateBuffer(inputRate, "Cent");

        Assert.Equal(10.75m, buffer.LowerRate);
        Assert.Equal(11.00m, buffer.UpperRate);
        Assert.Equal(10.90m, buffer.ApproximateRate);
        Assert.Equal("₹10.75 L – ₹11.00 L", buffer.RangeFormatted);
        Assert.Equal("Estimated Range: ₹10.75 L – ₹11.00 L / Cent", buffer.DisplayEstimatedRange);
        Assert.Equal("Approximate Market Rate: ₹10.90 L / Cent", buffer.DisplayApproximateRate);
    }

    [Fact]
    public void MarketRateBuffer_RawInrPerCent1092000_ConvertsAndWrapsAccurately()
    {
        // When rate is passed as raw INR (₹10,92,000 per Cent)
        decimal rawInr = 1092000m;

        var buffer = GreenotValuationEngine.CalculateMarketRateBuffer(rawInr, "Cent");

        Assert.Equal(10.75m, buffer.LowerRate);
        Assert.Equal(11.00m, buffer.UpperRate);
        Assert.Equal(10.90m, buffer.ApproximateRate);
        Assert.Equal("Estimated Range: ₹10.75 L – ₹11.00 L / Cent", buffer.DisplayEstimatedRange);
        Assert.Equal("Approximate Market Rate: ₹10.90 L / Cent", buffer.DisplayApproximateRate);
    }

    [Fact]
    public void MarketRateBuffer_ExactQuarterBoundary_CreatesRealisticBuffer()
    {
        // When rate is an exact quarter (e.g. 6.50L), it should provide a realistic ±0.25 buffer
        decimal inputRate = 6.50m;

        var buffer = GreenotValuationEngine.CalculateMarketRateBuffer(inputRate, "Cent");

        Assert.Equal(6.25m, buffer.LowerRate);
        Assert.Equal(6.75m, buffer.UpperRate);
        Assert.Equal(6.50m, buffer.ApproximateRate);
        Assert.Equal("Estimated Range: ₹6.25 L – ₹6.75 L / Cent", buffer.DisplayEstimatedRange);
        Assert.Equal("Approximate Market Rate: ₹6.50 L / Cent", buffer.DisplayApproximateRate);
    }

    [Fact]
    public void MarketRateBuffer_PerSqFtRate_RoundsToCleanInterval()
    {
        // ₹2,410 / Sq.Ft
        decimal rateSqFt = 2410m;

        var buffer = GreenotValuationEngine.CalculateMarketRateBuffer(rateSqFt, "Sq.Ft");

        Assert.Equal(2400m, buffer.LowerRate);
        Assert.Equal(2450m, buffer.UpperRate);
        Assert.Equal(2400m, buffer.ApproximateRate);
        Assert.Equal("Estimated Range: ₹2,400 – ₹2,450 / Sq.Ft", buffer.DisplayEstimatedRange);
        Assert.Equal("Approximate Market Rate: ₹2,400 / Sq.Ft", buffer.DisplayApproximateRate);
    }
}
