using Greenart.Application.Estimation;
using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record CoordinatesDto(double Latitude, double Longitude);

public record CalculateEstimateRequest(
    double Latitude,
    double Longitude,
    LandUsageType LandUsage = LandUsageType.Residential,
    double RadiusMeters = 1000.0,
    AreaUnit PreferredUnit = AreaUnit.Cent,
    decimal? TargetArea = null,
    AreaUnit? TargetAreaUnit = null,
    string? Locality = null,
    string? District = null,
    bool ForceFresh = false
);

public record PriceRangeDto(
    decimal MinRate,
    decimal Percentile25,
    decimal MedianRate,
    decimal Percentile75,
    decimal MaxRate,
    string Unit,
    MarketRateBufferDto? MarketRateBuffer = null
);

public record SourceCategoryBreakdownDto(
    string Category,
    int Count
);

public record GuidelineReferenceDto(
    decimal GuidelineRatePerCent,
    decimal GuidelineRatePerSqFt,
    string Locality,
    string? SurveyNumber,
    string LegalNotice
);

public record AskingPriceReferenceDto(
    int ListingCount,
    decimal MedianRatePerSqFt,
    decimal MedianRatePerCent,
    decimal MinRatePerSqFt,
    decimal MaxRatePerSqFt,
    string Notice
);

public record TotalValuationDto(
    decimal TotalEstimatedPrice,
    decimal TotalPriceMin,
    decimal TotalPriceMax,
    decimal AreaValue,
    string AreaUnit,
    decimal EquivalentSqFt,
    decimal EquivalentCents,
    decimal? TotalGuidelinePrice = null
);

public record EstimateSuccessResponse(
    string Status,
    CoordinatesDto TargetCoordinates,
    double SearchRadiusMeters,
    int ComparableRecordCount,
    string Confidence,
    PriceRangeDto PriceRangePerCent,
    PriceRangeDto PriceRangePerSqFt,
    DateTime EarliestRecordDate,
    DateTime LatestRecordDate,
    List<SourceCategoryBreakdownDto> SourceBreakdown,
    GuidelineReferenceDto? GovernmentGuidelineReference,
    string Disclaimer,
    AskingPriceReferenceDto? AskingPriceReference = null,
    TotalValuationDto? TotalValuation = null,
    string? CalculationExplanation = null
);

public record EstimateInsufficientDataResponse(
    string Status,
    CoordinatesDto TargetCoordinates,
    double SearchRadiusMeters,
    int ComparableRecordsFound,
    int MinimumRequiredRecords,
    string Message,
    List<string> Recommendations,
    GuidelineReferenceDto? GovernmentGuidelineReference = null,
    AskingPriceReferenceDto? AskingPriceReference = null,
    decimal? TotalGuidelineValuation = null
);
