using Greenart.Application.Common.Interfaces;
using Greenart.Application.Services;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class MlReadinessServiceTests
{
    private class TestRepository : ILandPriceRepository
    {
        private readonly List<LandPriceRecord> _records = new();

        public TestRepository(IEnumerable<LandPriceRecord>? records = null)
        {
            if (records != null) _records.AddRange(records);
        }

        public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(string? locality = null, LandUsageType? landUsage = null, SourceCategory? sourceCategory = null, string? district = null, CancellationToken cancellationToken = default)
        {
            var res = _records.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(district))
                res = res.Where(r => r.District.Equals(district, StringComparison.OrdinalIgnoreCase));
            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(res.ToList());
        }

        public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(_records.FirstOrDefault(r => r.Id == id));
        public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, LandUsageType landUsage, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<LandPriceRecord>>(new List<LandPriceRecord>());
        public Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default) { _records.Add(record); return Task.CompletedTask; }
        public Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default) { _records.AddRange(records); return Task.CompletedTask; }
        public Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<ImportBatch>>(new List<ImportBatch>());
        public Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditEvent>>(new List<AuditEvent>());
    }

    [Fact]
    public async Task GetStatewideCoverageSummary_ReturnsAll38Districts()
    {
        var records = new List<LandPriceRecord>
        {
            CreateRecord("Coimbatore", 11.0012, 77.0874, VerificationStatus.Verified, SourceCategory.VerifiedTransaction),
            CreateRecord("Chennai", 13.0827, 80.2707, VerificationStatus.Unverified, SourceCategory.AdvertisedAskingPrice)
        };

        var repo = new TestRepository(records);
        var service = new MlReadinessService(repo);

        var summary = await service.GetStatewideCoverageSummaryAsync();

        Assert.Equal(2, summary.TotalRecords);
        Assert.Equal(1, summary.TotalVerified);
        Assert.Equal(1, summary.TotalUnverified);
        Assert.Equal(2, summary.ActiveDistrictsCount);
        Assert.Equal(38, summary.TotalTamilNaduDistricts);
        Assert.Equal(38, summary.DistrictBreakdown.Count);

        var cbe = summary.DistrictBreakdown.First(d => d.District == "Coimbatore");
        Assert.Equal(1, cbe.RecordCount);
        Assert.Equal("PilotHub", cbe.Status);

        var chennai = summary.DistrictBreakdown.First(d => d.District == "Chennai");
        Assert.Equal(1, chennai.RecordCount);
        Assert.Equal("Sparse", chennai.Status);

        var madurai = summary.DistrictBreakdown.First(d => d.District == "Madurai");
        Assert.Equal(0, madurai.RecordCount);
        Assert.Equal("NoData", madurai.Status);
    }

    [Fact]
    public async Task GenerateAuditReport_WhenRecordsBelow500Threshold_RejectsProductionReadiness()
    {
        var records = new List<LandPriceRecord>
        {
            CreateRecord("Coimbatore", 11.0012, 77.0874, VerificationStatus.Verified, SourceCategory.VerifiedTransaction)
        };

        var repo = new TestRepository(records);
        var service = new MlReadinessService(repo);

        var report = await service.GenerateAuditReportAsync();

        Assert.Equal(500, report.MinimumRequiredVerifiedPerDistrict);
        Assert.Equal(1, report.TotalStatewideRecords);
        Assert.Equal(0, report.QualifiedDistrictsCount);
        Assert.Contains("ML Training Unready", report.ProductionReadinessVerdict);
        Assert.NotEmpty(report.ValidationBlockers);
        Assert.NotEmpty(report.FeatureSchema);
        Assert.NotEmpty(report.DataLeakageSafeguards);
    }

    private static LandPriceRecord CreateRecord(string district, double lat, double lon, VerificationStatus status, SourceCategory category)
    {
        return new LandPriceRecord(
            Guid.NewGuid(),
            "India",
            "Tamil Nadu",
            district,
            null,
            $"{district} Locality",
            null,
            null,
            new GeoCoordinate(lat, lon),
            LandUsageType.Residential,
            new LandArea(2.5m, AreaUnit.Cent),
            1000000m,
            category,
            "Ref123",
            DateTime.UtcNow,
            status,
            false,
            null
        );
    }
}
