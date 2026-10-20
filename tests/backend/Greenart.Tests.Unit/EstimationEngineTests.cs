using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.Estimation;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class EstimationEngineTests
{
    private class MockLandPriceRepository : ILandPriceRepository
    {
        private readonly List<LandPriceRecord> _records;

        public MockLandPriceRepository(List<LandPriceRecord> records)
        {
            _records = records;
        }

        public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(string? locality = null, LandUsageType? landUsage = null, SourceCategory? sourceCategory = null, CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(_records);
        }

        public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_records.FirstOrDefault(r => r.Id == id));
        }

        public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, LandUsageType landUsage, CancellationToken cancellationToken = default)
        {
            var target = new GeoCoordinate(latitude, longitude);
            var result = _records
                .Where(r => r.Coordinates.IsWithinRadius(target, radiusMeters) && r.LandUsage == landUsage)
                .ToList();

            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(result);
        }
    }

    [Fact]
    public async Task WhenLessThanThreeRecords_ShouldReturn_InsufficientDataResponse()
    {
        // Only 2 records near target
        var records = new List<LandPriceRecord>
        {
            CreateRecord(11.0010, 77.0870, 1000000m, SourceCategory.VerifiedTransaction),
            CreateRecord(11.0015, 77.0875, 1100000m, SourceCategory.VerifiedTransaction)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(2, insufficient.ComparableRecordsFound);
        Assert.Equal(3, insufficient.MinimumRequiredRecords);
        Assert.NotEmpty(insufficient.Recommendations);
    }

    [Fact]
    public async Task WhenThreeOrMoreRecords_ShouldReturn_EstimateSuccessResponse_WithAccurateMedian()
    {
        // 3 records: 1,000,000, 1,100,000, 1,200,000 INR/cent -> Median should be 1,100,000
        var records = new List<LandPriceRecord>
        {
            CreateRecord(11.0010, 77.0870, 1000000m, SourceCategory.VerifiedTransaction),
            CreateRecord(11.0015, 77.0875, 1100000m, SourceCategory.VerifiedTransaction),
            CreateRecord(11.0020, 77.0878, 1200000m, SourceCategory.AdvertisedAskingPrice)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal("Success", success.Status);
        Assert.Equal(3, success.ComparableRecordCount);
        Assert.Equal(1100000.00m, success.PriceRangePerCent.MedianRate);
        Assert.Equal(1000000.00m, success.PriceRangePerCent.MinRate);
        Assert.Equal(1200000.00m, success.PriceRangePerCent.MaxRate);
    }

    [Fact]
    public async Task GovernmentGuidelineValues_ShouldNeverBeBlendedIntoMarketPool()
    {
        // 3 market records (rates: 1.0M, 1.1M, 1.2M) + 1 Government Guideline record (rate: 600K)
        // Guideline value must NOT drag down the market median to 1.05M!
        var records = new List<LandPriceRecord>
        {
            CreateRecord(11.0010, 77.0870, 1000000m, SourceCategory.VerifiedTransaction),
            CreateRecord(11.0015, 77.0875, 1100000m, SourceCategory.VerifiedTransaction),
            CreateRecord(11.0020, 77.0878, 1200000m, SourceCategory.AdvertisedAskingPrice),
            CreateRecord(11.0012, 77.0872, 600000m, SourceCategory.GovernmentGuideline)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);

        // Market pool contains ONLY the 3 market records
        Assert.Equal(3, success.ComparableRecordCount);
        Assert.Equal(1100000.00m, success.PriceRangePerCent.MedianRate);

        // Guideline value is extracted separately
        Assert.NotNull(success.GovernmentGuidelineReference);
        Assert.Equal(600000.00m, success.GovernmentGuidelineReference.GuidelineRatePerCent);
    }

    private static LandPriceRecord CreateRecord(double lat, double lon, decimal ratePerCent, SourceCategory category)
    {
        var area = new LandArea(1.0m, AreaUnit.Cent);
        return new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Main Road",
            surveyNumber: "SF 100",
            coordinates: new GeoCoordinate(lat, lon),
            landUsage: LandUsageType.Residential,
            area: area,
            originalPrice: ratePerCent,
            sourceCategory: category,
            sourceReference: "Ref",
            observationDate: DateTime.UtcNow.AddMonths(-3),
            verificationStatus: category == SourceCategory.VerifiedTransaction ? VerificationStatus.Verified : VerificationStatus.Unverified
        );
    }
}
