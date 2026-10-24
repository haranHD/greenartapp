using System.Net;
using Greenart.Application.Common.Interfaces;
using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Greenart.Tests.Unit;

public class GeocodingServiceTests
{
    private sealed class TestHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responseFactory;
        public int CallCount { get; private set; }

        public TestHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        {
            _responseFactory = responseFactory;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult(_responseFactory(request));
        }
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

    private sealed class DummyChangeToken : IChangeToken
    {
        public bool HasChanged => false;
        public bool ActiveChangeCallbacks => false;
        public IDisposable RegisterChangeCallback(Action<object?> callback, object? state) => new DummyDisposable();
    }
    private sealed class DummyDisposable : IDisposable { public void Dispose() { } }

    private static (IGeocodingService service, TestHttpMessageHandler handler) CreateService(
        HttpStatusCode statusCode,
        string responseContent,
        string apiKey = "test-api-key")
    {
        var handler = new TestHttpMessageHandler(_ => new HttpResponseMessage
        {
            StatusCode = statusCode,
            Content = new StringContent(responseContent)
        });

        var httpClient = new HttpClient(handler);
        var memoryCache = new MemoryCache(new MemoryCacheOptions());

        var configData = new Dictionary<string, string?>
        {
            { "GeocodingSettings:ApiKey", apiKey },
            { "GeocodingSettings:BaseUrl", "https://places.googleapis.com/v1" },
            { "GeocodingSettings:DefaultRegion", "in" }
        };
        var config = new TestConfiguration(configData);
        var logger = NullLogger<GooglePlacesGeocodingService>.Instance;

        var service = new GooglePlacesGeocodingService(httpClient, memoryCache, config, logger);
        return (service, handler);
    }

    [Fact]
    public async Task SearchLocalitiesAsync_WhenQueryTooShort_ReturnsEmptyWithoutHttpCall()
    {
        var (service, handler) = CreateService(HttpStatusCode.OK, "{}");

        var result = await service.SearchLocalitiesAsync("a");

        Assert.Empty(result);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task SearchLocalitiesAsync_WhenValidQuery_ReturnsParsedSuggestions()
    {
        var jsonResponse = """
        {
            "suggestions": [
                {
                    "placePrediction": {
                        "placeId": "ChIJwX20AtdpqTsRGZcB-4gbyis",
                        "text": { "text": "Bhavani, Tamil Nadu, India" },
                        "structuredFormat": {
                            "mainText": { "text": "Bhavani" },
                            "secondaryText": { "text": "Tamil Nadu, India" }
                        },
                        "types": ["locality", "political", "geocode"]
                    }
                }
            ]
        }
        """;

        var (service, _) = CreateService(HttpStatusCode.OK, jsonResponse);

        var result = await service.SearchLocalitiesAsync("bhavani");

        Assert.Single(result);
        Assert.Equal("ChIJwX20AtdpqTsRGZcB-4gbyis", result[0].PlaceId);
        Assert.Equal("Bhavani", result[0].MainText);
        Assert.Equal("Tamil Nadu, India", result[0].SecondaryText);
    }

    [Fact]
    public async Task SearchLocalitiesAsync_WhenHttpError_ReturnsEmptyWithoutLeaking()
    {
        var (service, _) = CreateService(HttpStatusCode.Forbidden, "Forbidden");

        var result = await service.SearchLocalitiesAsync("bhavani");

        Assert.Empty(result);
    }

    [Fact]
    public async Task SearchLocalitiesAsync_CachesRepeatedQueries()
    {
        var jsonResponse = """
        {
            "suggestions": [
                {
                    "placePrediction": {
                        "placeId": "test_place_1",
                        "text": { "text": "Sulur, Tamil Nadu, India" },
                        "structuredFormat": {
                            "mainText": { "text": "Sulur" },
                            "secondaryText": { "text": "Tamil Nadu, India" }
                        }
                    }
                }
            ]
        }
        """;

        var (service, handler) = CreateService(HttpStatusCode.OK, jsonResponse);

        var first = await service.SearchLocalitiesAsync("sulur");
        var second = await service.SearchLocalitiesAsync("sulur");

        Assert.Single(first);
        Assert.Single(second);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task GetPlaceDetailsAsync_WhenValidResponse_ReturnsParsedDetails()
    {
        var jsonResponse = """
        {
            "id": "ChIJwX20AtdpqTsRGZcB-4gbyis",
            "formattedAddress": "Bhavani, Tamil Nadu, India",
            "displayName": { "text": "Bhavani" },
            "location": {
                "latitude": 11.4470564,
                "longitude": 77.6839768
            },
            "addressComponents": [
                { "longText": "Bhavani", "types": ["locality"] },
                { "longText": "Erode", "types": ["administrative_area_level_3"] },
                { "longText": "Tamil Nadu", "types": ["administrative_area_level_1"] },
                { "longText": "India", "types": ["country"] }
            ]
        }
        """;

        var (service, _) = CreateService(HttpStatusCode.OK, jsonResponse);

        var result = await service.GetPlaceDetailsAsync("ChIJwX20AtdpqTsRGZcB-4gbyis");

        Assert.NotNull(result);
        Assert.Equal("Bhavani", result.Name);
        Assert.Equal(11.4470564, result.Latitude, 4);
        Assert.Equal(77.6839768, result.Longitude, 4);
        Assert.Equal("Erode", result.District);
        Assert.Equal("Tamil Nadu", result.State);
    }

    [Fact]
    public async Task GetPlaceDetailsAsync_WhenLocationMissing_ReturnsNull()
    {
        var jsonResponse = """
        {
            "id": "missing_loc",
            "formattedAddress": "Unknown Place"
        }
        """;

        var (service, _) = CreateService(HttpStatusCode.OK, jsonResponse);

        var result = await service.GetPlaceDetailsAsync("missing_loc");

        Assert.Null(result);
    }
}

