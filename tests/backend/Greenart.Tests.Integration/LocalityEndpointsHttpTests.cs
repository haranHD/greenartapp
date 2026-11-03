using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Greenart.Tests.Integration;

public class LocalityEndpointsHttpTests : IClassFixture<WebApplicationFactory<Program>>
{
    private sealed class FakeGeocodingService : IGeocodingService
    {
        public Task<IReadOnlyList<LocalitySuggestionDto>> SearchLocalitiesAsync(string query, CancellationToken ct = default)
        {
            if (query.Equals("bhavani", StringComparison.OrdinalIgnoreCase))
            {
                var list = new List<LocalitySuggestionDto>
                {
                    new("place_bhavani_1", "Bhavani", "Tamil Nadu, India", "Bhavani, Tamil Nadu, India", new[] { "locality" })
                };
                return Task.FromResult<IReadOnlyList<LocalitySuggestionDto>>(list);
            }
            return Task.FromResult<IReadOnlyList<LocalitySuggestionDto>>(Array.Empty<LocalitySuggestionDto>());
        }

        public Task<LocalityDetailsDto?> GetPlaceDetailsAsync(string placeId, CancellationToken ct = default)
        {
            if (placeId == "place_bhavani_1")
            {
                return Task.FromResult<LocalityDetailsDto?>(new LocalityDetailsDto(
                    "place_bhavani_1",
                    "Bhavani",
                    "Bhavani, Tamil Nadu, India",
                    11.4471,
                    77.6840,
                    "Bhavani",
                    "Erode",
                    "Tamil Nadu",
                    "India"
                ));
            }
            return Task.FromResult<LocalityDetailsDto?>(null);
        }

        public Task<LocalityDetailsDto?> GeocodeAddressAsync(string address, CancellationToken ct = default)
        {
            if (address.Contains("bhavani", StringComparison.OrdinalIgnoreCase))
            {
                return Task.FromResult<LocalityDetailsDto?>(new LocalityDetailsDto(
                    "place_bhavani_1",
                    "Bhavani",
                    "Bhavani, Tamil Nadu, India",
                    11.4471,
                    77.6840,
                    "Bhavani",
                    "Erode",
                    "Tamil Nadu",
                    "India"
                ));
            }
            return Task.FromResult<LocalityDetailsDto?>(null);
        }
    }

    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public LocalityEndpointsHttpTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var geoDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IGeocodingService));
                if (geoDescriptor != null)
                {
                    services.Remove(geoDescriptor);
                }
                services.AddSingleton<IGeocodingService, FakeGeocodingService>();

                var repoDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ILandPriceRepository));
                if (repoDescriptor != null)
                {
                    services.Remove(repoDescriptor);
                }
                services.AddScoped<ILandPriceRepository, CoimbatorePilotRepository>();
            });
        });
    }

    [Fact]
    public async Task SearchLocalities_WhenQueryValid_Returns200WithSuggestions()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/localities/search?q=bhavani");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var suggestions = JsonSerializer.Deserialize<List<LocalitySuggestionDto>>(json, JsonOpts);

        Assert.NotNull(suggestions);
        Assert.Single(suggestions);
        Assert.Equal("Bhavani", suggestions[0].MainText);
    }

    [Fact]
    public async Task SearchLocalities_WhenQueryTooShort_Returns200WithEmptyList()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/localities/search?q=a");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var suggestions = JsonSerializer.Deserialize<List<LocalitySuggestionDto>>(json, JsonOpts);

        Assert.NotNull(suggestions);
        Assert.Empty(suggestions);
    }

    [Fact]
    public async Task GetLocalityDetails_WhenValidPlaceId_Returns200WithDetails()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/localities/details?placeId=place_bhavani_1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var details = JsonSerializer.Deserialize<LocalityDetailsDto>(json, JsonOpts);

        Assert.NotNull(details);
        Assert.Equal("Bhavani", details.Name);
        Assert.Equal(11.4471, details.Latitude, 3);
        Assert.Equal(77.6840, details.Longitude, 3);
        Assert.Equal("Erode", details.District);
    }

    [Fact]
    public async Task GetLocalityDetails_WhenMissingPlaceId_Returns400BadRequest()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/localities/details");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetLocalityDetails_WhenNotFound_Returns404NotFound()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/localities/details?placeId=non_existent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetReferenceLocalities_WithCoimbatoreDistrict_ReturnsCoimbatoreLocalities()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/reference/localities?district=Coimbatore");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var localities = JsonSerializer.Deserialize<List<LocalityReferenceDto>>(json, JsonOpts);

        Assert.NotNull(localities);
        Assert.NotEmpty(localities);
        Assert.All(localities, l => Assert.Equal("Coimbatore", l.District, StringComparer.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetReferenceLocalities_WithUnseededDistrict_ReturnsEmptyListNotCoimbatore()
    {
        var client = _factory.CreateClient();

        // In Swagger, user tested: /api/v1/reference/localities?district=erode
        // It should return an empty list [], NOT the hardcoded Coimbatore fallback.
        var response = await client.GetAsync("/api/v1/reference/localities?district=erode");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var localities = JsonSerializer.Deserialize<List<LocalityReferenceDto>>(json, JsonOpts);

        Assert.NotNull(localities);
        Assert.Empty(localities);
    }

    [Fact]
    public async Task CalculateEstimate_FromInteractiveMapPin_WithinPilotCorridor_Returns200WithStrictEligibility()
    {
        var client = _factory.CreateClient();

        // Target coordinates placed via interactive map pin in Kannampalayam cluster
        var request = new CalculateEstimateRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0
        );

        var response = await client.PostAsJsonAsync("/api/v1/estimates/calculate", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Under strict data eligibility, Kannampalayam pilot seed contains exactly 2 verified completed deeds.
        // Advertised asking prices and historical client research are strictly excluded from the market pool.
        // The engine honestly reports InsufficientData (2 of 3 required) while providing Layer 2 & 3 references.
        Assert.Equal("InsufficientData", root.GetProperty("status").GetString());
        Assert.Equal(1000, root.GetProperty("searchRadiusMeters").GetInt32());
        Assert.Equal(2, root.GetProperty("comparableRecordsFound").GetInt32());
        Assert.Equal(3, root.GetProperty("minimumRequiredRecords").GetInt32());

        // Verify separate statutory guideline reference
        Assert.True(root.TryGetProperty("governmentGuidelineReference", out var guideline));
        Assert.Equal(650000m, guideline.GetProperty("guidelineRatePerCent").GetDecimal());

        // Verify separate asking price reference
        Assert.True(root.TryGetProperty("askingPriceReference", out var asking));
        Assert.Equal(1, asking.GetProperty("listingCount").GetInt32());
    }

    [Fact]
    public async Task CalculateEstimate_FromInteractiveMapPin_OutsideDataCluster_Returns200InsufficientData()
    {
        var client = _factory.CreateClient();

        // Target coordinates pinned in an unseeded region
        var request = new CalculateEstimateRequest(
            Latitude: 11.4471,
            Longitude: 77.6840,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0
        );

        var response = await client.PostAsJsonAsync("/api/v1/estimates/calculate", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal("InsufficientData", root.GetProperty("status").GetString());
        Assert.Equal(3, root.GetProperty("minimumRequiredRecords").GetInt32());
        Assert.NotEmpty(root.GetProperty("recommendations").EnumerateArray());
    }

    [Fact]
    public async Task CalculateEstimate_ConcurrentSubmissions_BothReturnIdenticalConsistentResults()
    {
        var client = _factory.CreateClient();

        var request = new CalculateEstimateRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0
        );

        // Simulate concurrent duplicate estimate requests
        var task1 = client.PostAsJsonAsync("/api/v1/estimates/calculate", request);
        var task2 = client.PostAsJsonAsync("/api/v1/estimates/calculate", request);

        var responses = await Task.WhenAll(task1, task2);

        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal("InsufficientData", root.GetProperty("status").GetString());
            Assert.Equal(2, root.GetProperty("comparableRecordsFound").GetInt32());
        }
    }

    [Fact]
    public async Task CalculateEstimate_PreservesPinnedCoordinatePrecision()
    {
        var client = _factory.CreateClient();

        const double pinLat = 11.0012;
        const double pinLon = 77.0874;

        var request = new CalculateEstimateRequest(
            Latitude: pinLat,
            Longitude: pinLon,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000.0
        );

        var response = await client.PostAsJsonAsync("/api/v1/estimates/calculate", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var targetCoords = root.GetProperty("targetCoordinates");
        Assert.Equal(pinLat, targetCoords.GetProperty("latitude").GetDouble(), 4);
        Assert.Equal(pinLon, targetCoords.GetProperty("longitude").GetDouble(), 4);
    }
}

