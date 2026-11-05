using System.Net;
using Greenart.Application.DTOs;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Greenart.Tests.Unit;

public class GeminiLandIntelligenceServiceTests
{
    private class DummyChangeToken : IChangeToken
    {
        public bool HasChanged => false;
        public bool ActiveChangeCallbacks => false;
        public IDisposable RegisterChangeCallback(Action<object?> callback, object? state) => new DummyDisposable();
        private sealed class DummyDisposable : IDisposable { public void Dispose() { } }
    }

    private sealed class TestConfiguration : IConfiguration
    {
        private readonly Dictionary<string, string?> _data;
        public TestConfiguration(Dictionary<string, string?> data) => _data = data;
        public string? this[string key] { get => _data.TryGetValue(key, out var v) ? v : null; set => _data[key] = value; }
        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
        public IChangeToken GetReloadToken() => new DummyChangeToken();
        public IConfigurationSection GetSection(string key) => new TestConfigurationSection(key, _data);
    }

    private sealed class TestConfigurationSection : IConfigurationSection
    {
        private readonly string _path;
        private readonly Dictionary<string, string?> _data;
        public TestConfigurationSection(string path, Dictionary<string, string?> data)
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
        public IConfigurationSection GetSection(string key) => new TestConfigurationSection($"{_path}:{key}", _data);
    }

    private class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly HttpResponseMessage _response;

        public MockHttpMessageHandler(HttpResponseMessage response)
        {
            _response = response;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_response);
        }
    }

    [Fact]
    public void IsConfigured_WhenApiKeyPresent_ReturnsTrue()
    {
        var config = new TestConfiguration(new Dictionary<string, string?>
        {
            ["GeminiSettings:ApiKey"] = "AQ.TestKey123",
            ["GeminiSettings:Model"] = "gemini-3-flash-preview"
        });

        var client = new HttpClient(new MockHttpMessageHandler(new HttpResponseMessage(HttpStatusCode.OK)));
        var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

        Assert.True(service.IsConfigured);
    }

    [Fact]
    public void IsConfigured_WhenApiKeyEmpty_ReturnsFalse()
    {
        var config = new TestConfiguration(new Dictionary<string, string?>
        {
            ["GeminiSettings:ApiKey"] = ""
        });

        var client = new HttpClient(new MockHttpMessageHandler(new HttpResponseMessage(HttpStatusCode.OK)));
        var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

        Assert.False(service.IsConfigured);
    }

    [Fact]
    public async Task AnalyzeLandPriceAsync_WithValidGeminiResponse_ParsesIntelligenceReport()
    {
        var geminiJson = @"{
  ""candidates"": [
    {
      ""content"": {
        ""parts"": [
          {
            ""text"": ""{\n  \""estimatedCurrentPricePerCent\"": 1050000,\n  \""estimatedCurrentPricePerSqFt\"": 2410.47,\n  \""priceRangeSummary\"": \""Market rates in Kannampalayam range from 9.5L to 12L per cent.\"",\n  \""marketSentiment\"": \""Bullish\"",\n  \""growthDrivers\"": [\""Trichy Highway Expansion\"", \""Sulur Defense Corridor\""],\n  \""negotiationTips\"": [\""Verify DTCP approval\""],\n  \""dueDiligenceChecklist\"": [\""Verify Patta on e-Services\""]\n}""
          }
        ]
      }
    }
  ]
}";

        var mockResponse = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(geminiJson, System.Text.Encoding.UTF8, "application/json")
        };

        var config = new TestConfiguration(new Dictionary<string, string?>
        {
            ["GeminiSettings:ApiKey"] = "AQ.TestKey123",
            ["GeminiSettings:Model"] = "gemini-3-flash-preview"
        });

        var client = new HttpClient(new MockHttpMessageHandler(mockResponse));
        var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

        var request = new AiLandPriceIntelligenceRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            TargetArea: 4.0m,
            TargetAreaUnit: AreaUnit.Cent,
            Locality: "Kannampalayam",
            District: "Coimbatore"
        );

        var guideline = new GuidelineReferenceDto(
            GuidelineRatePerCent: 650000m,
            GuidelineRatePerSqFt: 1492.20m,
            Locality: "Kannampalayam",
            SurveyNumber: "SF 140",
            LegalNotice: "Statutory TNREGINET Benchmark"
        );

        var result = await service.AnalyzeLandPriceAsync(request, guideline, null, null, null);

        Assert.NotNull(result);
        Assert.Equal("Success", result.Status);
        Assert.Equal(1050000m, result.EstimatedCurrentPricePerCent);
        Assert.Equal(2410.47m, result.EstimatedCurrentPricePerSqFt);
        Assert.Equal("Bullish", result.MarketSentiment);
        Assert.Contains("Trichy Highway Expansion", result.GrowthDrivers);
        Assert.Contains("Verify Patta on e-Services", result.DueDiligenceChecklist);

        // Verify Total Valuation calculation for 4 Cents (4 * 435.6 = 1,742.4 sqft)
        Assert.NotNull(result.TotalValuation);
        Assert.Equal(4.0m, result.TotalValuation.AreaValue);
        Assert.Equal("Cent", result.TotalValuation.AreaUnit);
        Assert.Equal(1742.40m, result.TotalValuation.EquivalentSqFt);
        Assert.True(result.TotalValuation.TotalEstimatedPrice >= 4190000m && result.TotalValuation.TotalEstimatedPrice <= 4210000m);
    }
}
