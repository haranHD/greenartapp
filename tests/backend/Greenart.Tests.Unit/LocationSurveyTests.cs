using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Greenart.Tests.Unit;

public class LocationSurveyTests
{
    private class DummyChangeToken : IChangeToken
    {
        public bool HasChanged => false;
        public bool ActiveChangeCallbacks => false;
        public IDisposable RegisterChangeCallback(Action<object?> callback, object? state) => new DummyDisposable();
        private sealed class DummyDisposable : IDisposable { public void Dispose() { } }
    }

    private sealed class TestConfig : IConfiguration
    {
        private readonly Dictionary<string, string?> _data;
        public TestConfig(Dictionary<string, string?> data) => _data = data;
        public string? this[string key] { get => _data.TryGetValue(key, out var v) ? v : null; set => _data[key] = value; }
        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
        public IChangeToken GetReloadToken() => new DummyChangeToken();
        public IConfigurationSection GetSection(string key) => new TestConfigSection(key, _data);
    }

    private sealed class TestConfigSection : IConfigurationSection
    {
        private readonly string _path;
        private readonly Dictionary<string, string?> _data;
        public TestConfigSection(string path, Dictionary<string, string?> data)
        {
            _path = path;
            _data = data;
        }
        public string? this[string key] { get => _data.TryGetValue($"{_path}:{key}", out var v) ? v : null; set => _data[$"{_path}:{key}"] = value; }
        public string Key => _path.Split(':').Last();
        public string Path => _path;
        public string? Value { get => _data.TryGetValue(_path, out var v) ? v : null; set => _data[_path] = value; }
        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
        public IChangeToken GetReloadToken() => new DummyChangeToken();
        public IConfigurationSection GetSection(string key) => new TestConfigSection($"{_path}:{key}", _data);
    }

    [Fact]
    public async Task SurveyRequestService_QueuesAndConfirmsSurvey()
    {
        var service = new SurveyRequestService(NullLogger<SurveyRequestService>.Instance);

        var queued = await service.QueueSurveyAsync(
            latitude: 11.0168,
            longitude: 76.9558,
            locality: "RS Puram",
            district: "Coimbatore",
            landUsage: LandUsageType.Residential,
            targetArea: 5m,
            targetAreaUnit: AreaUnit.Cent,
            estimatedRatePerCent: 1500000m,
            estimatedRatePerSqFt: 3443.53m,
            guidelineRatePerCent: 1000000m
        );

        Assert.NotNull(queued);
        Assert.Equal("PendingBrokerCall", queued.Status);
        Assert.Equal("RS Puram", queued.Locality);
        Assert.Equal(1500000m, queued.EstimatedRatePerCent);

        // Duplicate suppression within 200m
        var dup = await service.QueueSurveyAsync(
            latitude: 11.0169, // ~10m away
            longitude: 76.9559,
            locality: "RS Puram",
            district: "Coimbatore",
            landUsage: LandUsageType.Residential,
            targetArea: 5m,
            targetAreaUnit: AreaUnit.Cent,
            estimatedRatePerCent: 1500000m,
            estimatedRatePerSqFt: 3443.53m,
            guidelineRatePerCent: 1000000m
        );

        Assert.Equal(queued.Id, dup.Id);

        // Confirm survey by local broker
        var confirmRequest = new ConfirmSurveyRequest(
            BrokerName: "Senthil Kumar",
            BrokerPhone: "9876543210",
            ConfirmedRatePerCent: 1450000m,
            Notes: "Verified with local RS Puram registry documents and active plots."
        );

        var confirmed = await service.ConfirmSurveyAsync(queued.Id, confirmRequest);

        Assert.NotNull(confirmed);
        Assert.Equal("Confirmed", confirmed.Status);
        Assert.Equal("Senthil Kumar", confirmed.BrokerName);
        Assert.Equal("9876543210", confirmed.BrokerPhone);
        Assert.Equal(1450000m, confirmed.ConfirmedRatePerCent);
        Assert.NotNull(confirmed.ConfirmedAtUtc);
    }

    [Fact]
    public async Task GeminiService_CrossVerify_DeterministicFallback_CalibratesFromGuideline()
    {
        var inMemoryConfig = new TestConfig(new Dictionary<string, string?>
        {
            ["GeminiSettings:ApiKey"] = "" // Empty to trigger offline deterministic mode
        });

        var client = new HttpClient();
        var geminiService = new GeminiLandIntelligenceService(
            client,
            inMemoryConfig,
            NullLogger<GeminiLandIntelligenceService>.Instance
        );

        var request = new CalculateEstimateRequest(
            Latitude: 11.0168,
            Longitude: 76.9558,
            LandUsage: LandUsageType.Residential,
            RoadFrontage: "60ft Main Road",
            SurroundingAmenities: "Schools, Hospitals, Bus Terminus"
        );

        var guideline = new GuidelineReferenceDto(
            GuidelineRatePerCent: 1000000m,
            GuidelineRatePerSqFt: 2295.68m,
            Locality: "RS Puram",
            SurveyNumber: "SF 101",
            LegalNotice: "Statutory Guideline Rate"
        );

        var result = await geminiService.CrossVerifyIndicativeMarketPriceAsync(request, guideline, null);

        Assert.NotNull(result);
        Assert.True(result.PriceRangePerCent.MedianRate >= guideline.GuidelineRatePerCent, 
            "Audited rate must respect the statutory guideline floor.");
        Assert.Equal("Moderate", result.Confidence);
        Assert.NotNull(result.FactorBreakdown);
        Assert.True(result.FactorBreakdown.RoadFrontageAdjustmentPerCent > 0, "60ft main road should yield a positive frontage adjustment.");
    }

    [Fact]
    public void LocalRateSurvey_MustNeverPolluteVerifiedTransactionMedian()
    {
        var record = new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Coimbatore South",
            locality: "RS Puram",
            streetOrLandmark: "DB Road",
            surveyNumber: "SF 101",
            coordinates: new GeoCoordinate(11.0168, 76.9558),
            landUsage: LandUsageType.Residential,
            area: new LandArea(1m, AreaUnit.Cent),
            originalPrice: 1450000m,
            sourceCategory: SourceCategory.LocalRateSurvey,
            sourceReference: "Broker: Senthil Kumar (9876543210)",
            observationDate: DateTime.UtcNow,
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Ground survey confirmed"
        );

        // CRITICAL PRINCIPLE: IsEligibleForMarketEstimation must return false for LocalRateSurvey
        // even if VerificationStatus is Verified!
        Assert.False(record.IsEligibleForMarketEstimation(DateTime.UtcNow),
            "Local rate survey data must never enter the verified completed-sale median.");
    }
}
