using Greenart.Application.Common.Interfaces;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;

namespace Greenart.Infrastructure.Repositories;

public class EfLandPriceRepository : ILandPriceRepository
{
    private readonly LandPriceDbContext _context;
    private readonly CoimbatorePilotRepository _fallback = new();
    private readonly ILogger<EfLandPriceRepository>? _logger;

    public EfLandPriceRepository(LandPriceDbContext context, ILogger<EfLandPriceRepository>? logger = null)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(
        string? locality = null,
        LandUsageType? landUsage = null,
        SourceCategory? sourceCategory = null,
        string? district = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var query = _context.LandPriceRecords.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(district))
            {
                var trimmedDistrict = district.Trim().ToLower();
                query = query.Where(r => EF.Functions.ILike(r.District, $"%{trimmedDistrict}%"));
            }

            if (!string.IsNullOrWhiteSpace(locality))
            {
                var trimmedLocality = locality.Trim().ToLower();
                query = query.Where(r => EF.Functions.ILike(r.Locality, $"%{trimmedLocality}%"));
            }

            if (landUsage.HasValue)
            {
                query = query.Where(r => r.LandUsage == landUsage.Value);
            }

            if (sourceCategory.HasValue)
            {
                query = query.Where(r => r.SourceCategory == sourceCategory.Value);
            }

            return await query.OrderByDescending(r => r.ObservationDate).ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL query failed; serving resilient in-memory pilot records.");
            return await _fallback.GetAllAsync(locality, landUsage, sourceCategory, district, cancellationToken);
        }
    }

    public async Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.LandPriceRecords
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL GetById failed; querying in-memory pilot records.");
            return await _fallback.GetByIdAsync(id, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(
        double latitude,
        double longitude,
        double radiusMeters,
        LandUsageType landUsage,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // NetTopologySuite: X = Longitude, Y = Latitude, SRID 4326 (WGS 84)
            var targetPoint = new Point(longitude, latitude) { SRID = 4326 };

            // PostGIS ST_DWithin query using spatial GIST index
            return await _context.LandPriceRecords
                .AsNoTracking()
                .Where(r => r.LandUsage == landUsage &&
                            EF.Functions.IsWithinDistance(EF.Property<Point>(r, "Location"), targetPoint, radiusMeters, true))
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL spatial query failed; falling back to in-memory geodesic evaluation.");
            return await _fallback.GetNearbyComparableAsync(latitude, longitude, radiusMeters, landUsage, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<(LandPriceRecord Record, double DistanceMeters)>> GetNearbyAsync(
        double latitude,
        double longitude,
        double radiusMeters,
        LandUsageType? landUsage = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var targetPoint = new Point(longitude, latitude) { SRID = 4326 };
            var targetCoord = new GeoCoordinate(latitude, longitude);

            var query = _context.LandPriceRecords
                .AsNoTracking()
                .Where(r => r.VerificationStatus != VerificationStatus.Rejected &&
                            r.VerificationStatus != VerificationStatus.Archived)
                .Where(r => EF.Functions.IsWithinDistance(EF.Property<Point>(r, "Location"), targetPoint, radiusMeters, true));

            if (landUsage.HasValue)
            {
                query = query.Where(r => r.LandUsage == landUsage.Value);
            }

            var records = await query.ToListAsync(cancellationToken);

            return records
                .Select(r => (Record: r, DistanceMeters: Math.Round(r.DistanceToMeters(targetCoord), 1)))
                .OrderBy(x => x.DistanceMeters)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL GetNearby query failed; calculating in-memory distances.");
            return await _fallback.GetNearbyAsync(latitude, longitude, radiusMeters, landUsage, cancellationToken);
        }
    }

    public async Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
    {
        try
        {
            await _context.LandPriceRecords.AddAsync(record, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL AddAsync failed; saving to in-memory fallback.");
            await _fallback.AddAsync(record, cancellationToken);
        }
    }

    public async Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default)
    {
        try
        {
            await _context.LandPriceRecords.AddRangeAsync(records, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL AddRangeAsync failed; saving to in-memory fallback.");
            await _fallback.AddRangeAsync(records, cancellationToken);
        }
    }

    public async Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
    {
        try
        {
            _context.LandPriceRecords.Update(record);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL UpdateAsync failed; updating in-memory fallback.");
            await _fallback.UpdateAsync(record, cancellationToken);
        }
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.LandPriceRecords.AnyAsync(r => r.Id == id, cancellationToken);
        }
        catch
        {
            return await _fallback.ExistsAsync(id, cancellationToken);
        }
    }

    public async Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default)
    {
        try
        {
            await _context.ImportBatches.AddAsync(batch, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL RecordImportBatchAsync failed; saving to fallback.");
            await _fallback.RecordImportBatchAsync(batch, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.ImportBatches
                .AsNoTracking()
                .OrderByDescending(b => b.ExecutedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);
        }
        catch
        {
            return await _fallback.GetImportBatchesAsync(limit, cancellationToken);
        }
    }

    public async Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default)
    {
        try
        {
            await _context.AuditEvents.AddAsync(auditEvent, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "PostgreSQL RecordAuditEventAsync failed; recording in fallback.");
            await _fallback.RecordAuditEventAsync(auditEvent, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.AuditEvents
                .AsNoTracking()
                .OrderByDescending(a => a.TimestampUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);
        }
        catch
        {
            return await _fallback.GetAuditEventsAsync(limit, cancellationToken);
        }
    }
}
