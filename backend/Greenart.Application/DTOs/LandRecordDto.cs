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

public record NearbyLandRecordDto(
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
    string? Notes,
    double DistanceMeters
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

public record CreateLandRecordRequest(
    string Locality,
    string? District = null,
    string? State = null,
    string? Country = null,
    string? Taluk = null,
    string? StreetOrLandmark = null,
    string? SurveyNumber = null,
    double Latitude = 0,
    double Longitude = 0,
    LandUsageType LandUsage = LandUsageType.Residential,
    decimal Area = 0,
    AreaUnit Unit = AreaUnit.Cent,
    decimal Price = 0,
    SourceCategory SourceCategory = SourceCategory.VerifiedTransaction,
    string? SourceReference = null,
    DateTime? ObservationDate = null,
    string? Notes = null
);

public record UpdateVerificationRequest(
    VerificationStatus Status,
    string? AuditNote
);

