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
    public HttpRequestMessage? LastRequest { get; private set; }
    public string? LastRequestBody { get; private set; }

    public MockHttpMessageHandler(HttpResponseMessage response)
    {
      _response = response;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
      LastRequest = request;
      if (request.Content != null)
      {
        LastRequestBody = request.Content.ReadAsStringAsync(cancellationToken).GetAwaiter().GetResult();
      }
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
  public void IsConfigured_WhenGeminiSettingsApiKeyIsEmptyString_FallsBackToGeminiApiKey()
  {
    var config = new TestConfiguration(new Dictionary<string, string?>
    {
      ["GeminiSettings:ApiKey"] = "",
      ["GEMINI_API_KEY"] = "AIzaSyTestValidEnvKey"
    });

    var client = new HttpClient(new MockHttpMessageHandler(new HttpResponseMessage(HttpStatusCode.OK)));
    var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

    Assert.True(service.IsConfigured);
  }

  [Fact]
  public async Task AnalyzeLandPriceAsync_SendsApiKeyInHeader_NotQueryString_AndParsesQualitativeReport()
  {
    var geminiJson = @"{
  ""candidates"": [
    {
      ""content"": {
        ""parts"": [
          {
            ""text"": ""{\n  \""priceRangeSummary\"": \""Market rates in Kannampalayam range from 9.5L to 12L per cent based on registry deeds.\"",\n  \""marketSentiment\"": \""Bullish\"",\n  \""growthDrivers\"": [\""Trichy Highway Expansion\"", \""Sulur Defense Corridor\""],\n  \""negotiationTips\"": [\""Verify DTCP approval\""],\n  \""dueDiligenceChecklist\"": [\""Verify Patta on e-Services\""]\n}""
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

    var handler = new MockHttpMessageHandler(mockResponse);
    var client = new HttpClient(handler);
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

    var marketCent = new PriceRangeDto(
        MinRate: 950000m,
        Percentile25: 1000000m,
        MedianRate: 1050000m,
        Percentile75: 1100000m,
        MaxRate: 1150000m,
        Unit: "INR / Cent"
    );

    var marketSqFt = new PriceRangeDto(
        MinRate: 2180.90m,
        Percentile25: 2295.68m,
        MedianRate: 2410.47m,
        Percentile75: 2525.25m,
        MaxRate: 2640.04m,
        Unit: "INR / Sq.Ft"
    );

    var result = await service.AnalyzeLandPriceAsync(request, guideline, marketCent, marketSqFt, null);

    // Verify request security: API key moved to header, not in URL query
    Assert.NotNull(handler.LastRequest);
    Assert.True(handler.LastRequest.Headers.Contains("x-goog-api-key"));
    Assert.Equal("AQ.TestKey123", handler.LastRequest.Headers.GetValues("x-goog-api-key").Single());
    Assert.DoesNotContain("key=", handler.LastRequest.RequestUri!.Query);

    // Verify response integrity: price numbers are COPIED from market evidence, factor breakdown is null
    Assert.NotNull(result);
    Assert.Equal("Success", result.Status);
    Assert.Equal(1050000m, result.EstimatedCurrentPricePerCent);
    Assert.Equal(2410.47m, result.EstimatedCurrentPricePerSqFt);
    Assert.Null(result.FactorBreakdown);
    Assert.Equal("Completed Transaction Evidence", result.SectionLabel);

    // Verify qualitative analysis from Gemini
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

  [Fact]
  public async Task AnalyzeLandPriceAsync_WithoutMarketEvidence_ReturnsZeroPrice_AndNeverInventsNumbers()
  {
    var geminiJson = @"{
  ""candidates"": [
    {
      ""content"": {
        ""parts"": [
          {
            ""text"": ""{\n  \""priceRangeSummary\"": \""No completed deeds in immediate radius.\"",\n  \""marketSentiment\"": \""Developing Corridor\"",\n  \""growthDrivers\"": [\""Upcoming bypass\""],\n  \""negotiationTips\"": [\""Use guideline value as baseline\""],\n  \""dueDiligenceChecklist\"": [\""Check 30-year EC\""]\n}""
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

    var handler = new MockHttpMessageHandler(mockResponse);
    var client = new HttpClient(handler);
    var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

    var request = new AiLandPriceIntelligenceRequest(
        Latitude: 11.0012,
        Longitude: 77.0874,
        LandUsage: LandUsageType.Residential,
        TargetArea: 4.0m,
        TargetAreaUnit: AreaUnit.Cent,
        Locality: "Rural Sulur",
        District: "Coimbatore"
    );

    var guideline = new GuidelineReferenceDto(
        GuidelineRatePerCent: 300000m,
        GuidelineRatePerSqFt: 688.70m,
        Locality: "Rural Sulur",
        SurveyNumber: "SF 55",
        LegalNotice: "Statutory TNREGINET Benchmark"
    );

    // marketObservedPerCent is null -> no verified completed deed evidence
    var result = await service.AnalyzeLandPriceAsync(request, guideline, null, null, null);

    Assert.NotNull(result);
    Assert.Equal("Success", result.Status);
    // Price must be 0m when no verified completed sales evidence exists (NO invented 1.5x guideline or fallback)
    Assert.Equal(0m, result.EstimatedCurrentPricePerCent);
    Assert.Equal(0m, result.EstimatedCurrentPricePerSqFt);
    Assert.Null(result.TotalValuation);
    Assert.Null(result.FactorBreakdown);
  }

  [Fact]
  public async Task FetchLiveMarketCompsWithGroundingAsync_SendsGoogleSearchToolAndParsesResponse()
  {
    var geminiResponseJson = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "```json\n{\n  \"micro_market_tier\": \"Tier 2 (Established Urban/Suburban Residential Colonies)\",\n  \"min_price_per_sqft\": 2870,\n  \"max_price_per_sqft\": 3673,\n  \"min_price_per_cent_lakhs\": 12.5,\n  \"max_price_per_cent_lakhs\": 16.0,\n  \"price_per_acre_lakhs\": null,\n  \"confidence_level\": \"High\",\n  \"analyzed_landmarks\": [\"Cauvery River Bridge\", \"NH 544\"],\n  \"valuation_rationale\": \"Active retail layout plot listings on 99acres and MagicBricks in Kuruppanaickenpalayam, Bhavani.\"\n}\n```"
                  }
                ]
              },
              "groundingMetadata": {
                "groundingChunks": [
                  {
                    "web": {
                      "uri": "https://www.99acres.com/plots-in-bhavani-erode-ffid",
                      "title": "Plots for Sale in Bhavani Erode"
                    }
                  },
                  {
                    "web": {
                      "uri": "https://www.magicbricks.com/property-for-sale/residential-real-estate?cityName=Erode",
                      "title": "Property for Sale in Erode"
                    }
                  }
                ]
              }
            }
          ]
        }
        """;

    var mockResponse = new HttpResponseMessage(HttpStatusCode.OK)
    {
      Content = new StringContent(geminiResponseJson, System.Text.Encoding.UTF8, "application/json")
    };

    var config = new TestConfiguration(new Dictionary<string, string?>
    {
      ["GeminiSettings:ApiKey"] = "AQ.TestKey123",
      ["GeminiSettings:Model"] = "gemini-1.5-flash"
    });

    var handler = new MockHttpMessageHandler(mockResponse);
    var client = new HttpClient(handler);
    var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

    var landmarks = new List<string> { "Cauvery River Bridge", "NH 544" };
    var guideline = new GuidelineReferenceDto(
        GuidelineRatePerCent: 800000m,
        GuidelineRatePerSqFt: 1836.55m,
        Locality: "Kuruppanaickenpalayam",
        SurveyNumber: "SF 102",
        LegalNotice: "TNREGINET"
    );

    var result = await service.FetchLiveMarketCompsWithGroundingAsync(
        11.4500,
        77.6800,
        "Kuruppanaickenpalayam, Bhavani",
        "Erode",
        LandUsageType.Residential,
        landmarks,
        guideline
    );

    Assert.NotNull(result);
    Assert.Equal(12.5m, result.MinPricePerCentLakhs);
    Assert.Equal(16.0m, result.MaxPricePerCentLakhs);
    Assert.Equal(2870m, result.MinPricePerSqFt);
    Assert.Equal(3673m, result.MaxPricePerSqFt);
    Assert.Equal("Tier 2 (Established Urban/Suburban Residential Colonies)", result.MicroMarketTier);
    Assert.Equal("High", result.ConfidenceLevel);
    Assert.True(result.IsLiveSearchGrounded);
    Assert.Contains("99acres", result.SourcePortals);
    Assert.Contains("MagicBricks", result.SourcePortals);
    Assert.NotNull(result.Citations);
    Assert.Equal(2, result.Citations.Count);
    Assert.Equal("99acres", result.Citations[0].Portal);
    Assert.Equal("MagicBricks", result.Citations[1].Portal);

    // Verify request payload contained googleSearch tool
    Assert.NotNull(handler.LastRequest);
    Assert.NotNull(handler.LastRequestBody);
    Assert.Contains("googleSearch", handler.LastRequestBody);
  }

  [Fact]
  public async Task FetchLiveMarketCompsWithGroundingAsync_WhenUnconfigured_UsesDeterministic1CentEquals435SqFtMath()
  {
    var config = new TestConfiguration(new Dictionary<string, string?>());
    var client = new HttpClient(new MockHttpMessageHandler(new HttpResponseMessage(HttpStatusCode.OK)));
    var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

    var guideline = new GuidelineReferenceDto(
        GuidelineRatePerCent: 1000000m,
        GuidelineRatePerSqFt: 2295.68m,
        Locality: "Bhavani",
        SurveyNumber: null,
        LegalNotice: null
    );

    var result = await service.FetchLiveMarketCompsWithGroundingAsync(
        11.4500,
        77.6800,
        "Bhavani",
        "Erode",
        LandUsageType.Residential,
        new List<string> { "Main Road" },
        guideline
    );

    Assert.NotNull(result);
    Assert.False(result.IsLiveSearchGrounded);
    Assert.True(result.Citations == null || result.Citations.Count == 0);
    Assert.True(result.MinPricePerCentLakhs > 0);
    Assert.True(result.MaxPricePerCentLakhs > result.MinPricePerCentLakhs);
    Assert.Contains("/ sq.ft", result.PricePerSqFtRange);
    Assert.NotEmpty(result.SourcePortals);
  }

  [Fact]
  public async Task FetchLiveMarketCompsWithGroundingAsync_WhenLandmarksContainTaluk_FiltersThemOut()
  {
    var config = new TestConfiguration(new Dictionary<string, string?>());
    var client = new HttpClient(new MockHttpMessageHandler(new HttpResponseMessage(HttpStatusCode.OK)));
    var service = new GeminiLandIntelligenceService(client, config, NullLogger<GeminiLandIntelligenceService>.Instance);

    var guideline = new GuidelineReferenceDto(
        GuidelineRatePerCent: 1000000m,
        GuidelineRatePerSqFt: 2295.68m,
        Locality: "Bhavani",
        SurveyNumber: "SF 12",
        LegalNotice: null
    );

    var result = await service.FetchLiveMarketCompsWithGroundingAsync(
        11.4500,
        77.6800,
        "Bhavani",
        "Erode",
        LandUsageType.Residential,
        new List<string> { "Cauvery Bridge", "taluk", "Bhavani Taluk", "NH 544" },
        guideline
    );

    Assert.NotNull(result);
    Assert.False(result.IsLiveSearchGrounded);
    Assert.True(result.Citations == null || result.Citations.Count == 0);
    Assert.DoesNotContain(result.KeyLandmarksUsed, lm => lm.Equals("taluk", StringComparison.OrdinalIgnoreCase) || lm.EndsWith(" taluk", StringComparison.OrdinalIgnoreCase));
    Assert.Contains("Cauvery Bridge", result.KeyLandmarksUsed);
  }
}
