using Greenart.Application.DTOs;

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
}

