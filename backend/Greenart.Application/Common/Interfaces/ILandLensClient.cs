using Greenart.Application.DTOs;

namespace Greenart.Application.Common.Interfaces;

/// <summary>
/// Typed client abstraction for LandLens API (verified.realestate).
/// Provides authenticated access to Tamil Nadu parcel resolution, guideline data, and price intelligence.
/// </summary>
public interface ILandLensClient
{
    /// <summary>
    /// Gets whether the LandLens API client has an API key configured.
    /// </summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Checks verified credential account details, spent today, and current credit balance.
    /// Free endpoint (0 credits).
    /// </summary>
    Task<LandLensAccountResponse?> GetAccountStatusAsync(CancellationToken ct = default);

    /// <summary>
    /// Discovers all available tools, their summary descriptions, and their credit costs.
    /// Free endpoint (0 credits).
    /// </summary>
    Task<IReadOnlyList<LandLensToolDefinition>> GetToolsAsync(CancellationToken ct = default);

    /// <summary>
    /// Resolves real GPS coordinates (latitude/longitude) to the Tamil Nadu land parcel:
    /// survey number, subdivision, village/taluk/district, rural/urban, ULPIN, and extent.
    /// Free endpoint (0 credits).
    /// </summary>
    Task<ResolveParcelResult?> ResolveParcelAsync(double lat, double lng, CancellationToken ct = default);

    /// <summary>
    /// Fetches official government guideline benchmark rate for stamp duty calculation.
    /// Free endpoint (0 credits).
    /// </summary>
    Task<GuidelineValueResult?> GetGuidelineValueAsync(GuidelineValueRequest request, CancellationToken ct = default);

    /// <summary>
    /// Fetches village/town-level guideline price distribution and bands from LandLens locality_value_context.
    /// Free endpoint (0 credits).
    /// </summary>
    Task<LocalityValueContextResult?> GetLocalityValueContextAsync(string village, string? zone = null, CancellationToken ct = default);

    /// <summary>
    /// Fetches year-by-year historical guideline series from 2002 to 2024.
    /// Free endpoint (0 credits).
    /// </summary>
    Task<GuidelineHistoryResult?> GetGuidelineHistoryAsync(GuidelineHistoryRequest request, CancellationToken ct = default);

    /// <summary>
    /// Requests a Price Map report compiling registered transaction deeds for a parcel.
    /// Paid endpoint: 4 credits. Never auto-retries on timeout/failure.
    /// </summary>
    Task<PriceMapInitiationResult> RequestPriceMapAsync(PriceMapRequest request, CancellationToken ct = default);

    /// <summary>
    /// Reads individual registered deed transactions from a previously compiled Price Map report.
    /// Free endpoint (0 credits).
    /// </summary>
    Task<PriceMapTransactionsResult?> GetPriceMapTransactionsAsync(PriceMapTransactionsRequest request, CancellationToken ct = default);
}

