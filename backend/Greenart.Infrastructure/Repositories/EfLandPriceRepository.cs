using Greenart.Application.Common.Interfaces;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Greenart.Infrastructure.Repositories;

public class EfLandPriceRepository : ILandPriceRepository
{
    private readonly LandPriceDbContext _context;

    public EfLandPriceRepository(LandPriceDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(
        string? locality = null,
        LandUsageType? landUsage = null,
        SourceCategory? sourceCategory = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.LandPriceRecords.AsNoTracking().AsQueryable();

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

    public async Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.LandPriceRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(
        double latitude,
        double longitude,
        double radiusMeters,
        LandUsageType landUsage,
        CancellationToken cancellationToken = default)
    {
        // NetTopologySuite: X = Longitude, Y = Latitude, SRID 4326 (WGS 84)
        var targetPoint = new Point(longitude, latitude) { SRID = 4326 };

        // PostGIS ST_DWithin query using spatial GIST index
        // On a geography column, EF.Functions.IsWithinDistance computes geodesic distance in meters on the WGS 84 spheroid
        return await _context.LandPriceRecords
            .AsNoTracking()
            .Where(r => r.LandUsage == landUsage &&
                        EF.Functions.IsWithinDistance(EF.Property<Point>(r, "Location"), targetPoint, radiusMeters, true))
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
    {
        await _context.LandPriceRecords.AddAsync(record, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default)
    {
        await _context.LandPriceRecords.AddRangeAsync(records, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
    {
        _context.LandPriceRecords.Update(record);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.LandPriceRecords.AnyAsync(r => r.Id == id, cancellationToken);
    }
}
