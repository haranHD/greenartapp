using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record LandRecordDto(
    Guid Id,
    string Country,
    string State,
    string District,
    string? Taluk,
    string Locality,
    string? StreetOrLandmark,
    string? SurveyNumber,
    double Latitude,
    double Longitude,
    string LandUsage,
    decimal OriginalArea,
    string OriginalUnit,
    decimal OriginalPrice,
    decimal NormalizedRatePerCent,
    decimal NormalizedRatePerSqFt,
    string SourceCategory,
    string? SourceReference,
    DateTime ObservationDate,
    string VerificationStatus,
    bool IsSynthetic,
    string? Notes
);

public record LocalityReferenceDto(
    string Name,
    string District,
    double Latitude,
    double Longitude,
    decimal GuidelineRatePerCent,
    decimal GuidelineRatePerSqFt,
    int RecordCount
);

