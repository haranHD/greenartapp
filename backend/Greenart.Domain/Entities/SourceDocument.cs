using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

public class SourceDocument
{
    public Guid Id { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string StoragePath { get; private set; } = string.Empty;
    public string MimeType { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }
    public string FileChecksumSha256 { get; private set; } = string.Empty;
    public SourceDocumentType DocumentType { get; private set; }
    public DocumentProcessingStatus ProcessingStatus { get; private set; }
    public DocumentValidationStatus ValidationStatus { get; private set; }
    public string UploadedBy { get; private set; } = "Administrator";
    public DateTime UploadedAtUtc { get; private set; }
    public DateTime? ProcessedAtUtc { get; private set; }
    public string? ReviewedBy { get; private set; }
    public DateTime? ReviewedAtUtc { get; private set; }
    public string? Notes { get; private set; }
    public string? ExtractedMetadataJson { get; private set; }
    public Guid? ImportBatchId { get; private set; }
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAtUtc { get; private set; }
    public string? ArchivalReason { get; private set; }

    public ICollection<LandPriceRecord> LandPriceRecords { get; private set; } = new List<LandPriceRecord>();

    // EF Core constructor
    private SourceDocument() { }

    public SourceDocument(
        Guid id,
        string fileName,
        string storagePath,
        string mimeType,
        long fileSizeBytes,
        string fileChecksumSha256,
        SourceDocumentType documentType,
        string uploadedBy = "Administrator",
        DocumentProcessingStatus processingStatus = DocumentProcessingStatus.Pending,
        DocumentValidationStatus validationStatus = DocumentValidationStatus.Unreviewed,
        string? notes = null,
        string? extractedMetadataJson = null,
        Guid? importBatchId = null)
    {
        if (string.IsNullOrWhiteSpace(fileName)) throw new ArgumentException("FileName is required.", nameof(fileName));
        if (string.IsNullOrWhiteSpace(storagePath)) throw new ArgumentException("StoragePath is required.", nameof(storagePath));
        if (string.IsNullOrWhiteSpace(fileChecksumSha256)) throw new ArgumentException("FileChecksumSha256 is required.", nameof(fileChecksumSha256));
        if (fileSizeBytes < 0) throw new ArgumentOutOfRangeException(nameof(fileSizeBytes), "FileSizeBytes cannot be negative.");

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        FileName = fileName.Trim();
        StoragePath = storagePath.Trim();
        MimeType = string.IsNullOrWhiteSpace(mimeType) ? "application/octet-stream" : mimeType.Trim();
        FileSizeBytes = fileSizeBytes;
        FileChecksumSha256 = fileChecksumSha256.Trim().ToLowerInvariant();
        DocumentType = documentType;
        UploadedBy = string.IsNullOrWhiteSpace(uploadedBy) ? "Administrator" : uploadedBy.Trim();
        UploadedAtUtc = DateTime.UtcNow;
        ProcessingStatus = processingStatus;
        ValidationStatus = validationStatus;
        Notes = notes?.Trim();
        ExtractedMetadataJson = extractedMetadataJson;
        ImportBatchId = importBatchId;
    }

    public void MarkExtracted(string? metadataJson = null)
    {
        ProcessingStatus = DocumentProcessingStatus.Extracted;
        ProcessedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(metadataJson))
        {
            ExtractedMetadataJson = metadataJson;
        }
    }

    public void MarkValidated(string? notes = null)
    {
        ProcessingStatus = DocumentProcessingStatus.Validated;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            Notes = string.IsNullOrWhiteSpace(Notes) ? notes : $"{Notes} | {notes}";
        }
    }

    public void MarkFailed(string failureReason)
    {
        ProcessingStatus = DocumentProcessingStatus.Failed;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Failure: {failureReason}" : $"{Notes} | Failure: {failureReason}";
    }

    public void Approve(string reviewer, string? notes = null)
    {
        ValidationStatus = DocumentValidationStatus.Approved;
        ReviewedBy = string.IsNullOrWhiteSpace(reviewer) ? "Administrator" : reviewer.Trim();
        ReviewedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            Notes = string.IsNullOrWhiteSpace(Notes) ? $"Approved: {notes}" : $"{Notes} | Approved: {notes}";
        }
    }

    public void Reject(string reviewer, string reason)
    {
        ValidationStatus = DocumentValidationStatus.Rejected;
        ReviewedBy = string.IsNullOrWhiteSpace(reviewer) ? "Administrator" : reviewer.Trim();
        ReviewedAtUtc = DateTime.UtcNow;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Rejected: {reason}" : $"{Notes} | Rejected: {reason}";
    }

    public void Archive(string archivedBy, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Archival reason is required.", nameof(reason));
        IsArchived = true;
        ArchivedAtUtc = DateTime.UtcNow;
        ArchivalReason = reason.Trim();
        ValidationStatus = DocumentValidationStatus.Archived;
        ReviewedBy = string.IsNullOrWhiteSpace(archivedBy) ? "Administrator" : archivedBy.Trim();
        ReviewedAtUtc = DateTime.UtcNow;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Archived: {reason}" : $"{Notes} | Archived: {reason}";
    }
}

