using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class HistoricalEstimateObservationConfiguration : IEntityTypeConfiguration<HistoricalEstimateObservation>
{
    public void Configure(EntityTypeBuilder<HistoricalEstimateObservation> builder)
    {
        builder.ToTable("historical_estimate_observations");

        builder.HasKey(o => new { o.EstimateId, o.ObservationId });

        builder.Property(o => o.EstimateId).HasColumnName("estimate_id");
        builder.Property(o => o.ObservationId).HasColumnName("observation_id");

        builder.Property(o => o.ContributionWeight)
            .HasColumnName("contribution_weight")
            .HasPrecision(5, 4)
            .IsRequired();

        builder.Property(o => o.IsOutlier)
            .HasColumnName("is_outlier")
            .IsRequired();

        builder.Property(o => o.DistanceMeters)
            .HasColumnName("distance_meters")
            .IsRequired();

        builder.Property(o => o.TemporalOffsetMonths)
            .HasColumnName("temporal_offset_months")
            .IsRequired();

        // Foreign keys:
        // Deleting an estimate cascades and cleans up its observation links
        builder.HasOne(o => o.HistoricalEstimate)
            .WithMany(e => e.SupportingObservations)
            .HasForeignKey(o => o.EstimateId)
            .OnDelete(DeleteBehavior.Cascade);

        // Deleting or modifying a ground-truth observation is RESTRICTED if linked to an estimate
        builder.HasOne(o => o.Observation)
            .WithMany()
            .HasForeignKey(o => o.ObservationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(o => o.ObservationId)
            .HasDatabaseName("idx_historical_estimate_observations_obs_id");
    }
}

