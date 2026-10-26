using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class ImportBatchConfiguration : IEntityTypeConfiguration<ImportBatch>
{
    public void Configure(EntityTypeBuilder<ImportBatch> builder)
    {
        builder.ToTable("import_batches");

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).HasColumnName("id");

        builder.Property(b => b.FileName).HasColumnName("file_name").HasMaxLength(255).IsRequired();
        builder.Property(b => b.FileSizeBytes).HasColumnName("file_size_bytes").IsRequired();
        builder.Property(b => b.TotalRows).HasColumnName("total_rows").IsRequired();
        builder.Property(b => b.ValidRows).HasColumnName("valid_rows").IsRequired();
        builder.Property(b => b.InvalidRows).HasColumnName("invalid_rows").IsRequired();
        builder.Property(b => b.DuplicateRows).HasColumnName("duplicate_rows").IsRequired();
        builder.Property(b => b.ImportedRows).HasColumnName("imported_rows").IsRequired();
        builder.Property(b => b.SkippedRows).HasColumnName("skipped_rows").IsRequired();
        builder.Property(b => b.DryRun).HasColumnName("dry_run").IsRequired();
        builder.Property(b => b.TriggeredBy).HasColumnName("triggered_by").HasMaxLength(100).IsRequired();
        builder.Property(b => b.ExecutedAtUtc).HasColumnName("executed_at_utc").HasColumnType("timestamp with time zone").IsRequired();
        builder.Property(b => b.DiagnosticSummary).HasColumnName("diagnostic_summary").HasMaxLength(4000);

        builder.HasIndex(b => b.ExecutedAtUtc).HasDatabaseName("idx_import_batches_executed_at");
    }
}

