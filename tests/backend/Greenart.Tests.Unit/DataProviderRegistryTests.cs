using Greenart.Application.Common.Interfaces;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Providers;
using Xunit;

namespace Greenart.Tests.Unit;

public class DataProviderRegistryTests
{
    private class MockRepo : ILandPriceRepository
    {
        public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(string? locality = null, LandUsageType? landUsage = null, SourceCategory? sourceCategory = null, string? district = null, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<LandPriceRecord>>(new List<LandPriceRecord>());
        public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<LandPriceRecord?>(null);
        public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, LandUsageType landUsage, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<LandPriceRecord>>(new List<LandPriceRecord>());
        public Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<ImportBatch>>(new List<ImportBatch>());
        public Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditEvent>>(new List<AuditEvent>());
    }

    [Fact]
    public void Registry_WhenConstructedWithDefaultProviders_RegistersAllThree()
    {
        var repo = new MockRepo();
        var providers = new List<ILandPriceDataProvider>
        {
            new InternalSurveyorDataProvider(repo),
            new TnReginetGuidelineProvider(repo),
            new CommercialPropTechDataProvider()
        };

        var registry = new DataProviderRegistry(providers);
        var summaries = registry.GetProviderSummaries();

        Assert.Equal(3, summaries.Count);
        Assert.Contains(summaries, p => p.ProviderId == "greenart-surveyor-network");
        Assert.Contains(summaries, p => p.ProviderId == "tnreginet-guideline-feed");
        Assert.Contains(summaries, p => p.ProviderId == "licensed-b2b-proptech");
    }

    [Fact]
    public void TnReginetGuidelineProvider_HasCorrectStatutoryAndLegalMetadata()
    {
        var repo = new MockRepo();
        var provider = new TnReginetGuidelineProvider(repo);

        Assert.Equal("tnreginet-guideline-feed", provider.ProviderId);
        Assert.Equal(SourceCategory.GovernmentGuideline, provider.Category);
        Assert.True(provider.Coverage.Statewide);
        Assert.Contains("Statutory benchmark valuation ONLY", provider.DataIntegrityNote);
        Assert.Contains("Tamil Nadu Stamp Act", provider.LicenseTerms);
    }

    [Fact]
    public void InternalSurveyorDataProvider_HasFieldVerificationMetadata()
    {
        var repo = new MockRepo();
        var provider = new InternalSurveyorDataProvider(repo);

        Assert.Equal("greenart-surveyor-network", provider.ProviderId);
        Assert.Equal(SourceCategory.ClientResearch, provider.Category);
        Assert.True(provider.IsLiveFeedAvailable);
        Assert.Contains("Coimbatore", provider.Coverage.CoveredDistricts);
    }

    [Fact]
    public void CommercialPropTechDataProvider_RequiresCommercialLicense()
    {
        var provider = new CommercialPropTechDataProvider();

        Assert.Equal("licensed-b2b-proptech", provider.ProviderId);
        Assert.Equal(SourceCategory.VerifiedTransaction, provider.Category);
        Assert.False(provider.IsLiveFeedAvailable);
        Assert.Contains("bilateral institutional licensing agreement", provider.LicenseTerms);
    }
}

