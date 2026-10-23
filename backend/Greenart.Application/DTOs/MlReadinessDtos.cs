namespace Greenart.Application.DTOs;

public record MlTrainingFeatureSchemaDto(
    string FeatureName,
    string DataType,
    string Description,
    bool IsTarget,
    string TreatmentPolicy
);

public record DistrictMlStatusDto(
    string District,
    int TotalRecords,
    int VerifiedTransactions,
    int AskingPrices,
    int GuidelineBenchmarks,
    int ClientResearch,
    string DensityStatus, // "Dense", "Moderate", "Sparse", "ZeroData"
    bool IsEligibleForMlTraining,
    int RequiredAdditionalRecords
);

public record MlReadinessAuditReportDto(
    DateTime AuditTimestampUtc,
    int MinimumRequiredVerifiedPerDistrict,
    int TotalStatewideRecords,
    int TotalStatewideVerifiedTransactions,
    int QualifiedDistrictsCount,
    IReadOnlyList<DistrictMlStatusDto> Districts,
    IReadOnlyList<MlTrainingFeatureSchemaDto> FeatureSchema,
    IReadOnlyList<string> DataLeakageSafeguards,
    IReadOnlyList<string> ValidationBlockers,
    string ProductionReadinessVerdict
);

public record StatewideCoverageSummaryDto(
    int TotalRecords,
    int TotalVerified,
    int TotalUnverified,
    int TotalGuideline,
    int ActiveDistrictsCount,
    int TotalTamilNaduDistricts,
    DateTime? LatestObservationDateUtc,
    IReadOnlyList<DistrictCoverageDetailDto> DistrictBreakdown
);

public record DistrictCoverageDetailDto(
    string District,
    int RecordCount,
    int VerifiedCount,
    int UnverifiedCount,
    int GuidelineCount,
    string Status, // "PilotHub", "Sparse", "NoData"
    DateTime? LatestObservationDate,
    IReadOnlyList<string> ActiveLocalities
);

