using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public enum ProviderPermittedUsage
{
    InternalAnalyticsOnly = 1,
    CommercialDisplay = 2,
    BenchmarkReferenceOnly = 3,
    RestrictedEvaluation = 4
}

public record ProviderCoverageDto(
    string RegionName,
    IReadOnlyList<string> CoveredDistricts,
    bool Statewide,
    IReadOnlyList<string> SupportedLandUsages
);

public record ProviderRecordDto(
    string Locality,
    string District,
    string? Taluk,
    string? SurveyNumber,
    double Latitude,
    double Longitude,
    string LandUsage,
    decimal Area,
    string Unit,
    decimal Price,
    string SourceCategory,
    string SourceReference,
    DateTime ObservationDate,
    string LegalProvenance,
    bool IsEstimatedOrSynthesized
);

public record ProviderQueryRequest(
    double Latitude,
    double Longitude,
    double RadiusMeters,
    LandUsageType LandUsage,
    string? District = null
);

public record ProviderQueryResult(
    string ProviderId,
    bool Success,
    int RecordsFound,
    string? Message,
    IReadOnlyList<ProviderRecordDto> Records
);

public record ProviderSummaryDto(
    string ProviderId,
    string ProviderName,
    string SourceCategory,
    string PermittedUsage,
    ProviderCoverageDto Coverage,
    DateTime LastUpdatedUtc,
    bool IsLiveFeedAvailable,
    string LicenseTerms,
    string DataIntegrityNote
);

