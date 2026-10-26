using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("audit_events");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");

        builder.Property(a => a.EntityType).HasColumnName("entity_type").HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityId).HasColumnName("entity_id");
        builder.Property(a => a.Action).HasColumnName("action").HasMaxLength(100).IsRequired();
        builder.Property(a => a.PerformedBy).HasColumnName("performed_by").HasMaxLength(100).IsRequired();
        builder.Property(a => a.TimestampUtc).HasColumnName("timestamp_utc").HasColumnType("timestamp with time zone").IsRequired();
        builder.Property(a => a.Details).HasColumnName("details").HasColumnType("text").IsRequired();

        builder.HasIndex(a => new { a.EntityType, a.EntityId }).HasDatabaseName("idx_audit_events_entity");
        builder.HasIndex(a => a.TimestampUtc).HasDatabaseName("idx_audit_events_timestamp");
    }
}

