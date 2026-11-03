using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.Estimation;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Repositories;
using Xunit;

namespace Greenart.Tests.Integration;

public class EstimationPersistenceIntegrationTests
{
    private readonly ILandPriceRepository _repository = new CoimbatorePilotRepository();

    [Fact]
    public async Task KannampalayamPilot_StrictEligibility_ShouldReturnInsufficientData_WhenOnlyTwoVerifiedDeedsExist()
    {
        var engine = new EstimationEngine(_repository);

        var request = new CalculateEstimateRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0,
            TargetArea: 4.0m,
            TargetAreaUnit: AreaUnit.Cent
        );

        var response = await engine.EstimateMarketPriceAsync(request);

        // Under strict data eligibility, Kannampalayam has exactly 2 verified completed deeds within 1000m.
        // Asking prices (1) and Client Research (1) are strictly excluded from the market pool.
        // Minimum threshold of 3 verified records triggers InsufficientData honestly.
        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(2, insufficient.ComparableRecordsFound);
        Assert.Equal(3, insufficient.MinimumRequiredRecords);

        // Layer 3: Statutory Guideline benchmark must be populated independently
        Assert.NotNull(insufficient.GovernmentGuidelineReference);
        Assert.Equal(650000m, insufficient.GovernmentGuidelineReference.GuidelineRatePerCent);
        Assert.Contains("TNREGINET", insufficient.GovernmentGuidelineReference.LegalNotice);

        // Layer 2: Asking price reference must be populated independently
        Assert.NotNull(insufficient.AskingPriceReference);
        Assert.Equal(1, insufficient.AskingPriceReference.ListingCount);
        Assert.Equal(980000m, insufficient.AskingPriceReference.MedianRatePerCent);

        // Total guideline valuation for 4 Cents = 4 * 650,000 = 2,600,000 INR
        Assert.NotNull(insufficient.TotalGuidelineValuation);
        Assert.True(insufficient.TotalGuidelineValuation >= 2599000m && insufficient.TotalGuidelineValuation <= 2601000m);
    }

    [Fact]
    public async Task PilotHub_WithThreeVerifiedDeeds_ShouldReturn_EstimateSuccess_WithAllThreeLayers()
    {
        // Clone repository and add a 3rd verified sale deed to Kannampalayam
        var repo = new CoimbatorePilotRepository();
        var thirdDeed = new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "SF 145 Main Road",
            surveyNumber: "SF 145/2",
            coordinates: new GeoCoordinate(11.0018, 77.0872),
            landUsage: LandUsageType.Residential,
            area: new LandArea(4.0m, AreaUnit.Cent),
            originalPrice: 4200000m, // 1,050,000 INR/cent
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Sulur Doc 2150/2024",
            observationDate: DateTime.UtcNow.AddMonths(-4),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Audited registered sale deed."
        );
        await repo.AddAsync(thirdDeed);

        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0,
            TargetArea: 4.0m,
            TargetAreaUnit: AreaUnit.Cent
        );

        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal("Success", success.Status);
        Assert.Equal(3, success.ComparableRecordCount);

        // Rates: 1,050,000 (3.5c for 3.675M), 1,100,000 (4.0c for 4.4M), 1,050,000 (SF 145)
        // Median = 1,050,000 INR/cent
        Assert.True(success.PriceRangePerCent.MedianRate >= 1050000m && success.PriceRangePerCent.MedianRate <= 1100000m);

        // Layer 3: Statutory guideline benchmark
        Assert.NotNull(success.GovernmentGuidelineReference);
        Assert.Equal(650000m, success.GovernmentGuidelineReference.GuidelineRatePerCent);

        // Layer 2: Asking price reference
        Assert.NotNull(success.AskingPriceReference);
        Assert.Equal(1, success.AskingPriceReference.ListingCount);

        // Total Valuation for 4 Cents
        Assert.NotNull(success.TotalValuation);
        Assert.Equal(4.0m, success.TotalValuation.AreaValue);
        Assert.True(success.TotalValuation.TotalEstimatedPrice >= 4200000m && success.TotalValuation.TotalEstimatedPrice <= 4400000m);
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
}
