using Greenart.Application.DTOs;

namespace Greenart.Application.Services;

/// <summary>
/// Service responsible for validating, parsing, duplicate-detecting, and ingesting land records from CSV.
/// </summary>
public interface ICsvLandPriceImporter
{
    Task<BatchImportSummaryResponse> ProcessCsvAsync(
        Stream csvStream,
        bool dryRun = false,
        bool skipDuplicates = true,
        string fileName = "upload.csv",
        long fileSizeBytes = 0,
        string triggeredBy = "Administrator",
        CancellationToken cancellationToken = default);
}

