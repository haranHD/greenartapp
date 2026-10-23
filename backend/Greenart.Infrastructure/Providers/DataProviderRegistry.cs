using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;

namespace Greenart.Infrastructure.Providers;

public class DataProviderRegistry : IDataProviderRegistry
{
    private readonly List<ILandPriceDataProvider> _providers;

    public DataProviderRegistry(IEnumerable<ILandPriceDataProvider> providers)
    {
        _providers = providers.ToList();
    }

    public IReadOnlyList<ILandPriceDataProvider> GetAllProviders() => _providers;

    public ILandPriceDataProvider? GetProvider(string providerId) =>
        _providers.FirstOrDefault(p => string.Equals(p.ProviderId, providerId, StringComparison.OrdinalIgnoreCase));

    public IReadOnlyList<ProviderSummaryDto> GetProviderSummaries()
    {
        return _providers.Select(p => new ProviderSummaryDto(
            ProviderId: p.ProviderId,
            ProviderName: p.ProviderName,
            SourceCategory: p.Category.ToString(),
            PermittedUsage: p.PermittedUsage.ToString(),
            Coverage: p.Coverage,
            LastUpdatedUtc: p.LastUpdatedUtc,
            IsLiveFeedAvailable: p.IsLiveFeedAvailable,
            LicenseTerms: p.LicenseTerms,
            DataIntegrityNote: p.DataIntegrityNote
        )).ToList();
    }
}

