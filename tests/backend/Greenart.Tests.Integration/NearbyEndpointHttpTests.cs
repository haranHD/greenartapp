using System.Net;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Greenart.Tests.Integration;

public class NearbyEndpointHttpTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public NearbyEndpointHttpTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ILandPriceRepository));
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }
                services.AddScoped<ILandPriceRepository, CoimbatorePilotRepository>();
            });
        });
    }

    [Fact]
    public async Task GetNearby_WithValidCoordinates_ShouldReturn200Ok_AndSortedByDistance()
    {
        var client = _factory.CreateClient();

        // Center of Kannampalayam pilot corridor
        var response = await client.GetAsync("/api/v1/land-records/nearby?latitude=11.0012&longitude=77.0874&radiusMeters=1000");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var records = JsonSerializer.Deserialize<List<NearbyLandRecordDto>>(json, JsonOptions);

        Assert.NotNull(records);
        Assert.NotEmpty(records);
        Assert.All(records, r => Assert.True(r.DistanceMeters <= 1000.0));

        // Verify distance ordering
        for (var i = 1; i < records.Count; i++)
        {
            Assert.True(records[i].DistanceMeters >= records[i - 1].DistanceMeters,
                $"Record at index {i} distance ({records[i].DistanceMeters}) is less than preceding ({records[i - 1].DistanceMeters})");
        }
    }

    [Fact]
    public async Task GetNearby_WithLandUsageFilter_ShouldReturnMatchingClassificationOnly()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/land-records/nearby?latitude=11.0012&longitude=77.0874&radiusMeters=2000&landUsage=Residential");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var records = JsonSerializer.Deserialize<List<NearbyLandRecordDto>>(json, JsonOptions);

        Assert.NotNull(records);
        Assert.All(records, r => Assert.Equal("Residential", r.LandUsage));
    }

    [Fact]
    public async Task GetNearby_WithoutCoordinates_ShouldReturn400BadRequest()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/land-records/nearby?radiusMeters=1000");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("required", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetNearby_WithInvalidRadius_ShouldReturn400BadRequest()
    {
        var client = _factory.CreateClient();

        var responseZero = await client.GetAsync("/api/v1/land-records/nearby?latitude=11.0012&longitude=77.0874&radiusMeters=0");
        Assert.Equal(HttpStatusCode.BadRequest, responseZero.StatusCode);

        var responseExcess = await client.GetAsync("/api/v1/land-records/nearby?latitude=11.0012&longitude=77.0874&radiusMeters=25000");
        Assert.Equal(HttpStatusCode.BadRequest, responseExcess.StatusCode);
    }

    [Fact]
    public async Task GetNearby_WithCoordinatesOutsideIndia_ShouldReturn400BadRequest()
    {
        var client = _factory.CreateClient();

        // London coordinates
        var response = await client.GetAsync("/api/v1/land-records/nearby?latitude=51.5074&longitude=-0.1278");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("outside Indian geographic territory", json);
    }

    [Fact]
    public async Task GetNearby_WithTransposedCoordinates_ShouldReturn400BadRequest()
    {
        var client = _factory.CreateClient();

        // Transposed: lat=77.0874, lng=11.0012
        var response = await client.GetAsync("/api/v1/land-records/nearby?latitude=77.0874&longitude=11.0012");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("transposed", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetNearby_WithNoMatchesInTinyRadius_ShouldReturn200OkWithEmptyList()
    {
        var client = _factory.CreateClient();

        // 1 meter radius around an arbitrary point
        var response = await client.GetAsync("/api/v1/land-records/nearby?latitude=11.0012&longitude=77.0874&radiusMeters=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var records = JsonSerializer.Deserialize<List<NearbyLandRecordDto>>(json, JsonOptions);

        Assert.NotNull(records);
        Assert.Empty(records);
    }
}

