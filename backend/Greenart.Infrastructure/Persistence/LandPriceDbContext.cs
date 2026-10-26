using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Greenart.Infrastructure.Persistence;

public class LandPriceDbContext : DbContext
{
    public LandPriceDbContext(DbContextOptions<LandPriceDbContext> options)
        : base(options)
    {
    }

    public DbSet<LandPriceRecord> LandPriceRecords => Set<LandPriceRecord>();
    public DbSet<SourceDocument> SourceDocuments => Set<SourceDocument>();
    public DbSet<HistoricalEstimate> HistoricalEstimates => Set<HistoricalEstimate>();
    public DbSet<HistoricalEstimateObservation> HistoricalEstimateObservations => Set<HistoricalEstimateObservation>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LandPriceDbContext).Assembly);
    }

    public override int SaveChanges()
    {
        SyncSpatialLocations();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        SyncSpatialLocations();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void SyncSpatialLocations()
    {
        foreach (var entry in ChangeTracker.Entries<LandPriceRecord>())
        {
            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                var record = entry.Entity;
                // NetTopologySuite: X = Longitude, Y = Latitude, SRID = 4326 (WGS 84)
                entry.Property<Point>("Location").CurrentValue = new Point(record.Longitude, record.Latitude)
                {
                    SRID = 4326
                };
            }
        }

        foreach (var entry in ChangeTracker.Entries<HistoricalEstimate>())
        {
            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                var estimate = entry.Entity;
                // NetTopologySuite: X = Longitude, Y = Latitude, SRID = 4326 (WGS 84)
                entry.Property<Point>("Location").CurrentValue = new Point(estimate.Longitude, estimate.Latitude)
                {
                    SRID = 4326
                };
            }
        }
    }
}

