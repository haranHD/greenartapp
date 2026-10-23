namespace Greenart.Application.DTOs;

/// <summary>
/// Diagnostic report for a single row parsed during CSV bulk ingestion.
/// </summary>
public record CsvRowDiagnostic(
    int RowNumber,
    string? Locality,
    string? SurveyNumber,
    string Severity, // "Error", "Warning", "Info"
    string Field,
    string Message
);

/// <summary>
/// Validated record preview displaying parsed values and duplicate detection status.
/// </summary>
public record ValidatedRecordPreview(
    int RowNumber,
    string Locality,
    string? Taluk,
    string? StreetOrLandmark,
    string? SurveyNumber,
    double Latitude,
    double Longitude,
    string LandUsage,
    decimal Area,
    string Unit,
    decimal Price,
    decimal NormalizedRatePerCent,
    decimal NormalizedRatePerSqFt,
    string SourceCategory,
    string? SourceReference,
    DateTime ObservationDate,
    string VerificationStatus,
    bool IsDuplicate,
    string? DuplicateReason,
    bool IsValid,
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Warnings
);

/// <summary>
/// Complete batch import execution summary returned to client.
/// </summary>
public record BatchImportSummaryResponse(
    bool DryRun,
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int DuplicateRows,
    int ImportedRows,
    int SkippedRows,
    DateTime TimestampUtc,
    IReadOnlyList<CsvRowDiagnostic> Diagnostics,
    IReadOnlyList<ValidatedRecordPreview> Previews
);

