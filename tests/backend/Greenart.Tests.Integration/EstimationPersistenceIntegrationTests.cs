namespace Greenart.Tests.Integration;

public class EstimationPersistenceIntegrationTests
{
    private readonly ILandPriceRepository _repository = new CoimbatorePilotRepository();

    [Fact]
    public async Task KannampalayamPilot_ShouldCalculate_AccurateEstimateWithGuidelineSeparation()
    {
        var engine = new EstimationEngine(_repository);

        var request = new CalculateEstimateRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0
        );

        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal("Success", success.Status);

        // Kannampalayam cluster: 5 total nearby records:
        // - 1 GovernmentGuideline (isolated as benchmark)
        // - 1 ClientResearch (2023-09-15, > 36 months old, properly filtered by freshness rule)
        // - 3 Fresh Market Records (2 Verified, 1 Asking) eligible for current estimation
        Assert.Equal(3, success.ComparableRecordCount);

        // Benchmark must be populated from the statutory guideline record
        Assert.NotNull(success.GovernmentGuidelineReference);
        Assert.Equal(650000m, success.GovernmentGuidelineReference.GuidelineRatePerCent);
        Assert.Contains("TNREGINET", success.GovernmentGuidelineReference.LegalNotice);

        // Source breakdown must contain only fresh eligible market evidence categories
        Assert.Contains(success.SourceBreakdown, s => s.Category == nameof(SourceCategory.VerifiedTransaction));
        Assert.Contains(success.SourceBreakdown, s => s.Category == nameof(SourceCategory.AdvertisedAskingPrice));
        // ClientResearch was 37 months old at test run time, so freshness rule properly excludes it from current estimation
        Assert.DoesNotContain(success.SourceBreakdown, s => s.Category == nameof(SourceCategory.ClientResearch));
        Assert.DoesNotContain(success.SourceBreakdown, s => s.Category == nameof(SourceCategory.GovernmentGuideline));

        // Price range per cent must have valid min <= median <= max
        Assert.True(success.PriceRangePerCent.MinRate <= success.PriceRangePerCent.MedianRate);
        Assert.True(success.PriceRangePerCent.MedianRate <= success.PriceRangePerCent.MaxRate);
    }

    [Fact]
    public async Task LocationWithNoComparableEvidence_ShouldReturn_InsufficientData()
    {
        var engine = new EstimationEngine(_repository);

        // Location with zero comparable records nearby (e.g. Ooty coordinates)
        var request = new CalculateEstimateRequest(
            Latitude: 11.4102,
            Longitude: 76.6950,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0
        );

        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(0, insufficient.ComparableRecordsFound);
        Assert.Equal(3, insufficient.MinimumRequiredRecords);
        Assert.NotEmpty(insufficient.Recommendations);
    }

    [Fact]
    public async Task SaravanampattiHub_ShouldYield_HighRatePerCentConsistentWithSEZGrowth()
    {
        var engine = new EstimationEngine(_repository);

        // Saravanampatti IT corridor hub
        var request = new CalculateEstimateRequest(
            Latitude: 11.0805,
            Longitude: 76.9976,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0
        );

        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal("Success", success.Status);
        Assert.Equal(3, success.ComparableRecordCount); // 2 verified + 1 asking (guideline separated)

        // IT corridor prices are above 15 Lakhs / Cent
        Assert.True(success.PriceRangePerCent.MedianRate >= 1500000m);
    }
}
