using System.Text;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.Services;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Microsoft.Extensions.Logging.Abstractions;

namespace Greenart.Tests.Unit;

public class CsvLandPriceImporterTests
{
    private readonly NullLogger<CsvLandPriceImporter> _logger = NullLogger<CsvLandPriceImporter>.Instance;

    private static Stream CreateStream(string csvContent)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(csvContent));
    }

    private static InMemoryTestLandPriceRepository CreateSeededRepository()
    {
        var seeded = new List<LandPriceRecord>
        {
            new LandPriceRecord(
                id: Guid.Parse("11111111-1111-1111-1111-111111111101"),
                country: "India",
                state: "Tamil Nadu",
                district: "Coimbatore",
                taluk: "Sulur",
                locality: "Kannampalayam",
                streetOrLandmark: "Trichy Road Branch",
                surveyNumber: "SF 142/2A",
                coordinates: new GeoCoordinate(11.0015, 77.0878),
                landUsage: LandUsageType.Residential,
                area: new LandArea(3.5m, AreaUnit.Cent),
                originalPrice: 3675000m,
                sourceCategory: SourceCategory.VerifiedTransaction,
                sourceReference: "SRO Sulur Doc 3412/2023",
                observationDate: new DateTime(2023, 11, 14),
                verificationStatus: VerificationStatus.Verified,
                isSynthetic: false,
                notes: "Registered sale deed"
            )
        };
        return new InMemoryTestLandPriceRepository(seeded);
    }

    [Fact]
    public async Task ProcessCsvAsync_WithValidCsv_ShouldImportRecordsAndCalculateNormalizedRates()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate,district,notes
Kannampalayam,Sulur,Trichy Road,SF 901/1,11.0020,77.0870,Residential,2.5,Cent,3000000,AdvertisedAskingPrice,Broker #KP-99,2024-03-01,Coimbatore,Test row";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false);

        Assert.Equal(1, result.TotalRows);
        Assert.Equal(1, result.ValidRows);
        Assert.Equal(0, result.InvalidRows);
        Assert.Equal(1, result.ImportedRows);
        Assert.Empty(result.Diagnostics.Where(d => d.Severity == "Error"));

        var preview = result.Previews[0];
        Assert.True(preview.IsValid);
        Assert.Equal(1200000m, preview.NormalizedRatePerCent); // 30L / 2.5 cents = 12L/cent
        Assert.Equal(2754.82m, preview.NormalizedRatePerSqFt);
        Assert.Equal("Unverified", preview.VerificationStatus);
    }

    [Fact]
    public async Task ProcessCsvAsync_WithMissingRequiredHeaders_ShouldReturnImmediateHeaderDiagnostic()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        // Missing latitude, longitude, price
        var csv = @"locality,taluk,surveyNumber,landUsage,area,unit
Kannampalayam,Sulur,SF 100,Residential,2.0,Cent";

        var result = await importer.ProcessCsvAsync(CreateStream(csv));

        Assert.Equal(0, result.ValidRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Headers");
    }

    [Fact]
    public async Task ProcessCsvAsync_WithInvalidCoordinates_ShouldFlagDiagnosticErrors()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,999.0,-250.0,Residential,2.0,Cent,2000000,ClientResearch,2024-01-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv));

        Assert.Equal(1, result.InvalidRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Latitude");
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Longitude");
    }

    [Fact]
    public async Task ProcessCsvAsync_WithSwappedCoordinates_ShouldFlagTransposedError()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        // Latitude = 77.0870 (Lon range), Longitude = 11.0020 (Lat range)
        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,77.0870,11.0020,Residential,2.0,Cent,2000000,ClientResearch,2024-01-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv));

        Assert.Equal(1, result.InvalidRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Coordinates" && d.Message.Contains("transposed"));
    }

    [Fact]
    public async Task ProcessCsvAsync_WithCoordinatesOutsideIndia_ShouldFlagOutOfRangeError()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        // Lat 51.5074, Lon -0.1278 (London)
        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,51.5074,-0.1278,Residential,2.0,Cent,2000000,ClientResearch,2024-01-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv));

        Assert.Equal(1, result.InvalidRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Coordinates" && d.Message.Contains("outside India"));
    }

    [Fact]
    public async Task ProcessCsvAsync_WithInvalidPriceOrArea_ShouldFlagNumericErrors()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,11.0020,77.0870,Residential,-5.0,Cent,0,ClientResearch,2024-01-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv));

        Assert.Equal(1, result.InvalidRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Area");
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Price");
    }

    [Fact]
    public async Task ProcessCsvAsync_WithUnsupportedUnitsOrUsage_ShouldFlagEnumErrors()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,11.0020,77.0870,Underwater,3.0,Hectares,3000000,SupermarketAd,2024-01-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv));

        Assert.Equal(1, result.InvalidRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "LandUsage");
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Unit");
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "SourceCategory");
    }

    [Fact]
    public async Task ProcessCsvAsync_WithFutureOrAncientDate_ShouldFlagDateErrors()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var futureYear = DateTime.UtcNow.Year + 2;
        var csv = $@"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,11.0020,77.0870,Residential,2.0,Cent,2000000,ClientResearch,{futureYear}-01-01
Kannampalayam,11.0020,77.0870,Residential,2.0,Cent,2000000,ClientResearch,1975-01-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv));

        Assert.Equal(2, result.InvalidRows);
        Assert.Equal(2, result.Diagnostics.Count(d => d.Severity == "Error" && d.Field == "ObservationDate"));
    }

    [Fact]
    public async Task ProcessCsvAsync_WithVerifiedTransaction_MustDefaultVerificationStatusToUnverified()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Sulur,11.0260,77.1280,Commercial,2000,SqFt,4500000,VerifiedTransaction,2024-02-15";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false);

        Assert.Equal(1, result.ValidRows);
        var preview = result.Previews[0];
        Assert.Equal("Unverified", preview.VerificationStatus);
        Assert.Contains(preview.Warnings, w => w.Contains("defaulted to Unverified"));
    }

    [Fact]
    public async Task ProcessCsvAsync_WithDuplicateRecords_ShouldDetectDuplicatesAndSkipWhenRequested()
    {
        var repo = CreateSeededRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        // Repo already has Kannampalayam SF 142/2A (11.0015, 77.0878) at 3675000 on 2023-11-14
        var csv = @"locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate
Kannampalayam,Sulur,Trichy Road,SF 142/2A,11.0015,77.0878,Residential,3.5,Cent,3675000,VerifiedTransaction,SRO Sulur Doc 3412/2023,2023-11-14";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false, skipDuplicates: true);

        Assert.Equal(1, result.ValidRows);
        Assert.Equal(1, result.DuplicateRows);
        Assert.Equal(0, result.ImportedRows); // Skipped due to duplicate
        Assert.Equal(1, result.SkippedRows);
        Assert.True(result.Previews[0].IsDuplicate);
        Assert.NotNull(result.Previews[0].DuplicateReason);
    }

    [Fact]
    public async Task ProcessCsvAsync_WithSpatialProximityDuplicate_ShouldFlagDuplicate()
    {
        var repo = CreateSeededRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        // Kannampalayam SF 142/2A is at (11.0015, 77.0878), Residential, 3,675,000 on 2023-11-14
        // Coordinate 5 meters away: (11.00154, 77.08782), same price, date within 2 days
        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,11.00154,77.08782,Residential,3.5,Cent,3675000,AdvertisedAskingPrice,2023-11-16";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false, skipDuplicates: true);

        Assert.Equal(1, result.ValidRows);
        Assert.Equal(1, result.DuplicateRows);
        Assert.True(result.Previews[0].IsDuplicate);
        Assert.Contains("Spatial proximity duplicate", result.Previews[0].DuplicateReason);
    }

    [Fact]
    public async Task ProcessCsvAsync_WithDryRunTrue_ShouldReturnSummaryWithoutCallingRepositoryAddRange()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var initialCount = (await repo.GetAllAsync()).Count;

        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Saravanampatti,11.0850,77.0010,Residential,2.0,Cent,2400000,AdvertisedAskingPrice,2024-03-10";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: true);

        Assert.True(result.DryRun);
        Assert.Equal(1, result.ValidRows);
        Assert.Equal(0, result.ImportedRows); // 0 because dryRun = true

        var currentCount = (await repo.GetAllAsync()).Count;
        Assert.Equal(initialCount, currentCount); // Database untouched
    }

    [Fact]
    public async Task ProcessCsvAsync_WithMixedValidAndInvalidRows_ShouldImportOnlyValidRows()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,11.0035,77.0890,Residential,2.0,Cent,2000000,ClientResearch,2024-02-01
,11.0035,77.0890,Residential,2.0,Cent,2000000,ClientResearch,2024-02-01
Sulur,11.0280,77.1300,Commercial,1500,SqFt,3000000,AdvertisedAskingPrice,2024-02-05";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false);

        Assert.Equal(3, result.TotalRows);
        Assert.Equal(2, result.ValidRows);
        Assert.Equal(1, result.InvalidRows);
        Assert.Equal(2, result.ImportedRows);
    }

    [Fact]
    public async Task ProcessCsvAsync_WithExceededRowLimit_ShouldRejectBatch()
    {
        var repo = new InMemoryTestLandPriceRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var sb = new StringBuilder();
        sb.AppendLine("locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate");
        for (int i = 0; i < 1005; i++)
        {
            sb.AppendLine($"Kannampalayam,11.0035,77.0890,Residential,2.0,Cent,2000000,ClientResearch,2024-02-01");
        }

        var result = await importer.ProcessCsvAsync(CreateStream(sb.ToString()));

        Assert.Equal(1005, result.TotalRows);
        Assert.Equal(0, result.ValidRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "RowCount");
    }

    [Fact]
    public async Task ProcessCsvAsync_WhenRepositoryThrows_ShouldHandleDatabaseErrorSafely()
    {
        var mockRepo = new ThrowingLandPriceRepository();
        var importer = new CsvLandPriceImporter(mockRepo, _logger);

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,11.0035,77.0890,Residential,2.0,Cent,2000000,ClientResearch,2024-02-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false);

        Assert.Equal(0, result.ImportedRows);
        Assert.Contains(result.Diagnostics, d => d.Severity == "Error" && d.Field == "Database");
    }

    private class InMemoryTestLandPriceRepository : ILandPriceRepository
    {
        private readonly List<LandPriceRecord> _records = new();

        public InMemoryTestLandPriceRepository(IEnumerable<LandPriceRecord>? initial = null)
        {
            if (initial != null) _records.AddRange(initial);
        }

        public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(string? locality = null, LandUsageType? landUsage = null, SourceCategory? sourceCategory = null, string? district = null, CancellationToken cancellationToken = default)
        {
            var result = _records.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(locality))
                result = result.Where(r => r.Locality.Equals(locality, StringComparison.OrdinalIgnoreCase));
            if (landUsage.HasValue)
                result = result.Where(r => r.LandUsage == landUsage.Value);
            if (sourceCategory.HasValue)
                result = result.Where(r => r.SourceCategory == sourceCategory.Value);
            if (!string.IsNullOrWhiteSpace(district))
                result = result.Where(r => r.District.Equals(district, StringComparison.OrdinalIgnoreCase));
            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(result.ToList());
        }

        public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_records.FirstOrDefault(r => r.Id == id));

        public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, LandUsageType landUsage, CancellationToken cancellationToken = default)
        {
            var target = new GeoCoordinate(latitude, longitude);
            var result = _records.Where(r => r.LandUsage == landUsage && r.Coordinates.DistanceToMeters(target) <= radiusMeters).ToList();
            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(result);
        }

        public Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
        {
            _records.Add(record);
            return Task.CompletedTask;
        }

        public Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default)
        {
            _records.AddRange(records);
            return Task.CompletedTask;
        }

        public Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
        {
            var idx = _records.FindIndex(r => r.Id == record.Id);
            if (idx >= 0) _records[idx] = record;
            return Task.CompletedTask;
        }

        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_records.Any(r => r.Id == id));

        public Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<ImportBatch>>(new List<ImportBatch>());
        public Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditEvent>>(new List<AuditEvent>());
    }

    private class ThrowingLandPriceRepository : ILandPriceRepository
    {
        public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(string? locality = null, LandUsageType? landUsage = null, SourceCategory? sourceCategory = null, string? district = null, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<LandPriceRecord>>(new List<LandPriceRecord>());

        public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<LandPriceRecord?>(null);
        public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, LandUsageType landUsage, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<LandPriceRecord>>(new List<LandPriceRecord>());
        public Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default) => throw new InvalidOperationException("Simulated connection timeout");
        public Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default) => throw new InvalidOperationException("Simulated connection timeout");
        public Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default) => throw new InvalidOperationException("Simulated connection timeout");
        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(false);

        public Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<ImportBatch>>(new List<ImportBatch>());
        public Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditEvent>>(new List<AuditEvent>());
    }
}
