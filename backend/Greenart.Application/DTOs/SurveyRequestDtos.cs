using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record SurveyVerificationRequestDto(
    Guid Id,
    double Latitude,
    double Longitude,
    string Locality,
    string District,
    LandUsageType LandUsage,
    decimal? TargetArea,
    AreaUnit? TargetAreaUnit,
    decimal EstimatedRatePerCent,
    decimal EstimatedRatePerSqFt,
    decimal? GuidelineRatePerCent,
    string Status,
    DateTime CreatedAtUtc,
    DateTime? ConfirmedAtUtc = null,
    string? BrokerName = null,
    string? BrokerPhone = null,
    decimal? ConfirmedRatePerCent = null,
    string? Notes = null
);

public record ConfirmSurveyRequest(
    string BrokerName,
    string BrokerPhone,
    decimal ConfirmedRatePerCent,
    string? Notes = null
);
