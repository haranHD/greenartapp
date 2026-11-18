using Greenart.Application.DTOs;
using Greenart.Domain.Enums;

namespace Greenart.Application.Common.Interfaces;

public interface IGeminiLandIntelligenceService
{
    bool IsConfigured { get; }

    Task<AiLandPriceIntelligenceResponse?> AnalyzeLandPriceAsync(
        AiLandPriceIntelligenceRequest request,
        GuidelineReferenceDto? guidelineBenchmark,
        PriceRangeDto? marketObservedPerCent,
        PriceRangeDto? marketObservedPerSqFt,
        AskingPriceReferenceDto? askingPriceReference,
        CancellationToken ct = default);

    Task<CrossVerifiedPriceResultDto?> CrossVerifyIndicativeMarketPriceAsync(
        CalculateEstimateRequest request,
        GuidelineReferenceDto? guidelineBenchmark,
        AskingPriceReferenceDto? askingPriceReference,
        CancellationToken ct = default);

    /// <summary>
    /// Fetches live market comps from Indian property portals (99acres, MagicBricks, Housing.com)
    /// using Google Search Grounding with strict Tamil Nadu unit math and outlier filtering.
    /// </summary>
    Task<LiveMarketCompsDto?> FetchLiveMarketCompsWithGroundingAsync(
        double latitude,
        double longitude,
        string localityName,
        string districtName,
        LandUsageType landUsage,
        List<string>? landmarks,
        GuidelineReferenceDto? guidelineBenchmark,
        CancellationToken ct = default);
}

