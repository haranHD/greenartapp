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

public class StatewideCoverageEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public StatewideCoverageEndpointTests(WebApplicationFactory<Program> factory)
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
    public async Task GetCoverageSummary_ShouldReturn200Ok_With38Districts()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/coverage/summary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var summary = JsonSerializer.Deserialize<StatewideCoverageSummaryDto>(json, JsonOptions);

        Assert.NotNull(summary);
        Assert.Equal(38, summary.TotalTamilNaduDistricts);
        Assert.Equal(38, summary.DistrictBreakdown.Count);
        Assert.True(summary.TotalRecords > 0);
        Assert.Contains(summary.DistrictBreakdown, d => d.District == "Coimbatore" && d.Status == "PilotHub");
    }

    [Fact]
    public async Task GetProviders_ShouldReturn200Ok_WithAllThreeProviders()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/providers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var providers = JsonSerializer.Deserialize<List<ProviderSummaryDto>>(json, JsonOptions);

        Assert.NotNull(providers);
        Assert.Equal(3, providers.Count);
        Assert.Contains(providers, p => p.ProviderId == "greenart-surveyor-network");
        Assert.Contains(providers, p => p.ProviderId == "tnreginet-guideline-feed");
        Assert.Contains(providers, p => p.ProviderId == "licensed-b2b-proptech");
    }

    [Fact]
    public async Task GetMlReadiness_ShouldReturn200Ok_WithBlockedVerdictAndAuditDetails()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/ml/readiness");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var report = JsonSerializer.Deserialize<MlReadinessAuditReportDto>(json, JsonOptions);

        Assert.NotNull(report);
        Assert.Equal(500, report.MinimumRequiredVerifiedPerDistrict);
        Assert.Contains("ML Training Unready", report.ProductionReadinessVerdict);
        Assert.NotEmpty(report.ValidationBlockers);
        Assert.NotEmpty(report.FeatureSchema);
    }

    [Fact]
    public async Task GetImportHistory_ShouldReturn200Ok_WithBatchList()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/land-records/import/history?limit=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var history = JsonSerializer.Deserialize<List<object>>(json, JsonOptions);

        Assert.NotNull(history);
    }

    [Fact]
    public async Task GetReferenceLocalities_WithDistrictFilter_ReturnsFilteredLocalities()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/reference/localities?district=Coimbatore");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var localities = JsonSerializer.Deserialize<List<LocalityReferenceDto>>(json, JsonOptions);

        Assert.NotNull(localities);
        Assert.NotEmpty(localities);
        Assert.All(localities, l => Assert.Equal("Coimbatore", l.District));
    }

    [Fact]
    public async Task CalculateEstimate_WithTransposedCoordinates_Returns400BadRequest()
    {
        var client = _factory.CreateClient();
        // Transposed: Lat 77.0874, Lon 11.0012
        var request = new CalculateEstimateRequest(77.0874, 11.0012, LandUsageType.Residential, RadiusMeters: 1000);

        var response = await client.PostAsJsonAsync("/api/v1/estimates/calculate", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadAsStringAsync();
        Assert.Contains("transposed", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CalculateEstimate_OutsideIndia_Returns400BadRequest()
    {
        var client = _factory.CreateClient();
        // Coordinates in London: 51.5074, -0.1278
        var request = new CalculateEstimateRequest(51.5074, -0.1278, LandUsageType.Residential, RadiusMeters: 1000);

        var response = await client.PostAsJsonAsync("/api/v1/estimates/calculate", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadAsStringAsync();
        Assert.Contains("outside Indian geographic territory", error, StringComparison.OrdinalIgnoreCase);
    }
}
