using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record AiLandPriceIntelligenceRequest(
    double Latitude,
    double Longitude,
    LandUsageType LandUsage = LandUsageType.Residential,
    decimal? TargetArea = null,
    AreaUnit? TargetAreaUnit = null,
    string? Locality = null,
    string? District = null
);

public record AiLandPriceIntelligenceResponse(
    string Status,
    CoordinatesDto TargetCoordinates,
    string Locality,
    string District,
    string LandUsage,
    decimal EstimatedCurrentPricePerCent,
    decimal EstimatedCurrentPricePerSqFt,
    string PriceRangeSummary,
    string MarketSentiment,
    List<string> GrowthDrivers,
    List<string> NegotiationTips,
    List<string> DueDiligenceChecklist,
    GuidelineReferenceDto? GovernmentGuidelineReference,
    TotalValuationDto? TotalValuation,
    string Model,
    DateTime GeneratedAtUtc
);
