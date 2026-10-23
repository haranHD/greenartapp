using Greenart.Application.DTOs;
using Greenart.Domain.Enums;

namespace Greenart.Application.Common.Interfaces;

/// <summary>
/// Domain abstraction for external or internal land data providers.
/// Preserves provenance, permitted legal usage, update currency, and verification limitations.
/// Never synthesizes artificial prices or bypasses access controls.
/// </summary>
public interface ILandPriceDataProvider
{
    string ProviderId { get; }
    string ProviderName { get; }
    SourceCategory Category { get; }
    ProviderPermittedUsage PermittedUsage { get; }
    ProviderCoverageDto Coverage { get; }
    DateTime LastUpdatedUtc { get; }
    bool IsLiveFeedAvailable { get; }
    string LicenseTerms { get; }
    string DataIntegrityNote { get; }

    Task<ProviderQueryResult> FetchRecordsAsync(ProviderQueryRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// Registry service managing all configured legal data providers across Tamil Nadu.
/// </summary>
public interface IDataProviderRegistry
{
    IReadOnlyList<ILandPriceDataProvider> GetAllProviders();
    ILandPriceDataProvider? GetProvider(string providerId);
    IReadOnlyList<ProviderSummaryDto> GetProviderSummaries();
}

