using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Greenart.Infrastructure.Persistence.Seeding;
using Greenart.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Greenart.Tests.Unit;

public class RepositoryFailureSecurityTests
{
    [Fact]
    public async Task DatabaseReadFailure_DoesNotReturnPilotRecordsOrEmptySuccess()
    {
        // A context without a provider deterministically fails without any network access.
        using var db = new LandPriceDbContext(new DbContextOptions<LandPriceDbContext>());
        var repository = new EfLandPriceRepository(db);
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.GetAllAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.GetByIdAsync(Guid.NewGuid()));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.ExistsAsync(Guid.NewGuid()));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.GetNearbyComparableAsync(
            11.0012, 77.0874, 1000, LandUsageType.Residential));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.GetNearbyAsync(11.0012, 77.0874, 1000));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.GetImportBatchesAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.GetAuditEventsAsync());
    }

    [Fact]
    public async Task DatabaseWriteFailure_DoesNotReportTemporaryMemorySaveAsSuccess()
    {
        using var db = new LandPriceDbContext(new DbContextOptions<LandPriceDbContext>());
        var repository = new EfLandPriceRepository(db);
        var record = LandPriceDataSeeder.GetPilotRecords()[0];
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.AddAsync(record));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.AddRangeAsync(new[] { record }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateAsync(record));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.RecordAuditEventAsync(
            new AuditEvent(Guid.NewGuid(), "Test", record.Id, "Verify", "test", "test")));
    }
}
