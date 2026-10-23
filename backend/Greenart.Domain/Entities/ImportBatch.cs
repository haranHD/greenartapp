namespace Greenart.Domain.Entities;

/// <summary>
/// Persistent audit record of a bulk dataset ingestion operation.
/// </summary>
public class ImportBatch
{
    public Guid Id { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }
    public int TotalRows { get; private set; }
    public int ValidRows { get; private set; }
    public int InvalidRows { get; private set; }
    public int DuplicateRows { get; private set; }
    public int ImportedRows { get; private set; }
    public int SkippedRows { get; private set; }
    public bool DryRun { get; private set; }
    public string TriggeredBy { get; private set; } = "Administrator";
    public DateTime ExecutedAtUtc { get; private set; }
    public string? DiagnosticSummary { get; private set; }

    // EF Core constructor
    private ImportBatch() { }

    public ImportBatch(
        Guid id,
        string fileName,
        long fileSizeBytes,
        int totalRows,
        int validRows,
        int invalidRows,
        int duplicateRows,
        int importedRows,
        int skippedRows,
        bool dryRun,
        string triggeredBy = "Administrator",
        string? diagnosticSummary = null)
    {
        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        FileName = string.IsNullOrWhiteSpace(fileName) ? "unnamed.csv" : fileName.Trim();
        FileSizeBytes = Math.Max(0, fileSizeBytes);
        TotalRows = totalRows;
        ValidRows = validRows;
        InvalidRows = invalidRows;
        DuplicateRows = duplicateRows;
        ImportedRows = importedRows;
        SkippedRows = skippedRows;
        DryRun = dryRun;
        TriggeredBy = string.IsNullOrWhiteSpace(triggeredBy) ? "Administrator" : triggeredBy.Trim();
        ExecutedAtUtc = DateTime.UtcNow;
        DiagnosticSummary = diagnosticSummary;
    }
}

