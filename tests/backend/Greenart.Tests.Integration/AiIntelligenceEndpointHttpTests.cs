using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Greenart.Tests.Integration;

public class AiIntelligenceEndpointHttpTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public AiIntelligenceEndpointHttpTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PostAiIntelligence_WhenEvidenceIsInsufficient_ReturnsZeroPrice_AndInsufficientDataStatus()
    {
        var clientFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ILandPriceRepository));
                if (descriptor != null) services.Remove(descriptor);
                services.AddScoped<ILandPriceRepository, CoimbatorePilotRepository>();
            });
        });

        var client = clientFactory.CreateClient();

        // Location far from pilot data with 0 completed sale records
        var request = new AiLandPriceIntelligenceRequest(
            Latitude: 13.0827,
            Longitude: 80.2707,
            LandUsage: LandUsageType.Residential,
            TargetArea: 5.0m,
            TargetAreaUnit: AreaUnit.Cent,
            Locality: "Remote Outskirts",
            District: "Chennai"
        );

        var response = await client.PostAsJsonAsync("/api/v1/estimates/ai-intelligence", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<AiLandPriceIntelligenceResponse>(json, JsonOptions);

        Assert.NotNull(result);
        Assert.Equal("InsufficientData", result.Status);
        // Core Principle: NO price may be invented when evidence is insufficient
        Assert.Equal(0m, result.EstimatedCurrentPricePerCent);
        Assert.Equal(0m, result.EstimatedCurrentPricePerSqFt);
        Assert.Null(result.TotalValuation);
        Assert.Null(result.FactorBreakdown);
        Assert.Equal("Completed Transaction Evidence", result.SectionLabel);
        Assert.Contains("Insufficient verified sales data", result.PriceRangeSummary);
    }

    [Fact]
    public async Task PostAiIntelligence_WhenEvidenceIsSufficient_ReturnsVerifiedPriceFromEngine_WithNoFakeSplit()
    {
        var testRecords = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 950000m),
            CreateVerifiedDeed(11.0012, 77.0872, 1050000m),
            CreateVerifiedDeed(11.0014, 77.0874, 1150000m)
        };

        var clientFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ILandPriceRepository));
                if (descriptor != null) services.Remove(descriptor);
                services.AddScoped<ILandPriceRepository>(_ => new TestInMemoryLandPriceRepository(testRecords));
            });
        });

        var client = clientFactory.CreateClient();

        var request = new AiLandPriceIntelligenceRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            TargetArea: 3.0m,
            TargetAreaUnit: AreaUnit.Cent,
            Locality: "Kannampalayam",
            District: "Coimbatore"
        );

        var response = await client.PostAsJsonAsync("/api/v1/estimates/ai-intelligence", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<AiLandPriceIntelligenceResponse>(json, JsonOptions);

        Assert.NotNull(result);
        Assert.Equal("Success", result.Status);
        // Must match median of verified records: 1,050,000
        Assert.Equal(1050000m, result.EstimatedCurrentPricePerCent);
        Assert.True(result.EstimatedCurrentPricePerSqFt > 0m);
        // FactorBreakdown must be null (no 70/20/10 fake split)
        Assert.Null(result.FactorBreakdown);
        Assert.Equal("Completed Transaction Evidence", result.SectionLabel);
    }

    private static LandPriceRecord CreateVerifiedDeed(double lat, double lon, decimal ratePerCent)
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
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Sulur Registered Sale Deed",
            observationDate: DateTime.UtcNow.AddMonths(-3),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false
        );
    }

    private sealed class TestInMemoryLandPriceRepository : ILandPriceRepository
    {
        private readonly List<LandPriceRecord> _records;
        public TestInMemoryLandPriceRepository(List<LandPriceRecord> records) => _records = records;

        public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(string? locality = null, LandUsageType? landUsage = null, SourceCategory? sourceCategory = null, string? district = null, CancellationToken cancellationToken = default)
        {
            var res = _records.AsEnumerable();
            if (landUsage.HasValue) res = res.Where(r => r.LandUsage == landUsage.Value);
            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(res.ToList());
        }

        public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, LandUsageType landUsage, CancellationToken cancellationToken = default)
        {
            var target = new GeoCoordinate(latitude, longitude);
            var res = _records.Where(r => r.Coordinates.IsWithinRadius(target, radiusMeters) && r.LandUsage == landUsage).ToList();
            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(res);
        }

        public Task<IReadOnlyList<(LandPriceRecord Record, double DistanceMeters)>> GetNearbyAsync(double latitude, double longitude, double radiusMeters, LandUsageType? landUsage = null, CancellationToken cancellationToken = default)
        {
            var target = new GeoCoordinate(latitude, longitude);
            var res = _records
                .Where(r => !landUsage.HasValue || r.LandUsage == landUsage.Value)
                .Select(r => (Record: r, DistanceMeters: Math.Round(r.Coordinates.DistanceToMeters(target), 1)))
                .Where(x => x.DistanceMeters <= radiusMeters)
                .OrderBy(x => x.DistanceMeters)
                .ToList();
            return Task.FromResult<IReadOnlyList<(LandPriceRecord Record, double DistanceMeters)>>(res);
        }

        public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(_records.FirstOrDefault(r => r.Id == id));
        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(_records.Any(r => r.Id == id));
        public Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default) { _records.Add(record); return Task.CompletedTask; }
        public Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default) { _records.AddRange(records); return Task.CompletedTask; }
        public Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<ImportBatch>>(new List<ImportBatch>());
        public Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditEvent>>(new List<AuditEvent>());
    }
}
