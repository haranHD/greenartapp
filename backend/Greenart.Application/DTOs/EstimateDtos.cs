using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record CoordinatesDto(double Latitude, double Longitude);

public record CalculateEstimateRequest(
    double Latitude,
    double Longitude,
    LandUsageType LandUsage = LandUsageType.Residential,
    double RadiusMeters = 1000.0,
    AreaUnit PreferredUnit = AreaUnit.Cent
);

public record PriceRangeDto(
    decimal MinRate,
    decimal Percentile25,
    decimal MedianRate,
    decimal Percentile75,
    decimal MaxRate,
    string Unit
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
    string Disclaimer
);

public record EstimateInsufficientDataResponse(
    string Status,
    CoordinatesDto TargetCoordinates,
    double SearchRadiusMeters,
    int ComparableRecordsFound,
    int MinimumRequiredRecords,
    string Message,
    List<string> Recommendations
);

