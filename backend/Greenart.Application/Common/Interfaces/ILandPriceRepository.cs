using Greenart.Domain.Entities;
using Greenart.Domain.Enums;

namespace Greenart.Application.Common.Interfaces;

public interface ILandPriceRepository
{
    Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(
        string? locality = null,
        LandUsageType? landUsage = null,
        SourceCategory? sourceCategory = null,
        CancellationToken cancellationToken = default);

    Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(
        double latitude,
        double longitude,
        double radiusMeters,
        LandUsageType landUsage,
        CancellationToken cancellationToken = default);
}

