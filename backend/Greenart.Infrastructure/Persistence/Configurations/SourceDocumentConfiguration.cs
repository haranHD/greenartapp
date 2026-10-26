using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class SourceDocumentConfiguration : IEntityTypeConfiguration<SourceDocument>
{
    public void Configure(EntityTypeBuilder<SourceDocument> builder)
    {
        builder.ToTable("source_documents");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasColumnName("id");

        builder.Property(d => d.FileName).HasColumnName("file_name").HasMaxLength(255).IsRequired();
        builder.Property(d => d.StoragePath).HasColumnName("storage_path").HasMaxLength(500).IsRequired();
        builder.Property(d => d.MimeType).HasColumnName("mime_type").HasMaxLength(100).IsRequired();
        builder.Property(d => d.FileSizeBytes).HasColumnName("file_size_bytes").IsRequired();

        builder.Property(d => d.FileChecksumSha256)
            .HasColumnName("file_checksum_sha256")
            .HasMaxLength(64)
            .IsRequired();

        // Unique index for deduplication and provenance integrity
        builder.HasIndex(d => d.FileChecksumSha256)
            .IsUnique()
            .HasDatabaseName("idx_source_documents_checksum_unique");

        builder.Property(d => d.DocumentType)
            .HasColumnName("document_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(d => d.ProcessingStatus)
            .HasColumnName("processing_status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(d => d.ValidationStatus)
            .HasColumnName("validation_status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(d => d.UploadedBy).HasColumnName("uploaded_by").HasMaxLength(100).IsRequired();
        builder.Property(d => d.UploadedAtUtc).HasColumnName("uploaded_at_utc").HasColumnType("timestamp with time zone").IsRequired();
        builder.Property(d => d.ProcessedAtUtc).HasColumnName("processed_at_utc").HasColumnType("timestamp with time zone");
        builder.Property(d => d.ReviewedBy).HasColumnName("reviewed_by").HasMaxLength(100);
        builder.Property(d => d.ReviewedAtUtc).HasColumnName("reviewed_at_utc").HasColumnType("timestamp with time zone");
        builder.Property(d => d.Notes).HasColumnName("notes").HasMaxLength(2000);
        builder.Property(d => d.ExtractedMetadataJson).HasColumnName("extracted_metadata_json").HasColumnType("text");
        builder.Property(d => d.ImportBatchId).HasColumnName("import_batch_id");

        // Archival provenance fields
        builder.Property(d => d.IsArchived).HasColumnName("is_archived").IsRequired();
        builder.Property(d => d.ArchivedAtUtc).HasColumnName("archived_at_utc").HasColumnType("timestamp with time zone");
        builder.Property(d => d.ArchivalReason).HasColumnName("archival_reason").HasMaxLength(1000);

        // Fast status and moderation queries
        builder.HasIndex(d => new { d.ProcessingStatus, d.ValidationStatus })
            .HasDatabaseName("idx_source_documents_status");

        builder.HasIndex(d => d.DocumentType)
            .HasDatabaseName("idx_source_documents_document_type");

        builder.HasIndex(d => d.IsArchived)
            .HasDatabaseName("idx_source_documents_is_archived");
    }
}
