using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;

namespace Greenart.Tests.Integration;

// A test using this dependency cannot accidentally call a configured external account.
internal sealed class DisabledLandLensClient : ILandLensClient
{
    public bool IsConfigured => false;
    public Task<LandLensAccountResponse?> GetAccountStatusAsync(CancellationToken ct = default) => throw new NotSupportedException();
    public Task<IReadOnlyList<LandLensToolDefinition>> GetToolsAsync(CancellationToken ct = default) => throw new NotSupportedException();
    public Task<ResolveParcelResult?> ResolveParcelAsync(double lat, double lng, CancellationToken ct = default) => throw new NotSupportedException();
    public Task<GuidelineValueResult?> GetGuidelineValueAsync(GuidelineValueRequest request, CancellationToken ct = default) => throw new NotSupportedException();
    public Task<LocalityValueContextResult?> GetLocalityValueContextAsync(string village, string? zone = null, CancellationToken ct = default) => throw new NotSupportedException();
    public Task<GuidelineHistoryResult?> GetGuidelineHistoryAsync(GuidelineHistoryRequest request, CancellationToken ct = default) => throw new NotSupportedException();
    public Task<PriceMapInitiationResult> RequestPriceMapAsync(PriceMapRequest request, CancellationToken ct = default) => throw new NotSupportedException();
    public Task<PriceMapTransactionsResult?> GetPriceMapTransactionsAsync(PriceMapTransactionsRequest request, CancellationToken ct = default) => throw new NotSupportedException();
}
