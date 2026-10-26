using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NetTopologySuite.Geometries;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class HistoricalEstimateConfiguration : IEntityTypeConfiguration<HistoricalEstimate>
{
    public void Configure(EntityTypeBuilder<HistoricalEstimate> builder)
    {
        builder.ToTable("historical_estimates");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id");

        builder.Property(e => e.Country).HasColumnName("country").HasMaxLength(100).IsRequired();
        builder.Property(e => e.State).HasColumnName("state").HasMaxLength(100).IsRequired();
        builder.Property(e => e.District).HasColumnName("district").HasMaxLength(100).IsRequired();
        builder.Property(e => e.Taluk).HasColumnName("taluk").HasMaxLength(100);
        builder.Property(e => e.Locality).HasColumnName("locality").HasMaxLength(150).IsRequired();
        builder.Property(e => e.TargetYear).HasColumnName("target_year").IsRequired();

        builder.Property(e => e.LandUsage)
            .HasColumnName("land_usage")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        // Spatial Location Column (PostGIS geography Point SRID 4326)
        builder.Property<Point>("Location")
            .HasColumnName("location")
            .HasColumnType("geography(Point, 4326)")
            .IsRequired();

        builder.HasIndex("Location")
            .HasDatabaseName("idx_historical_estimates_location")
            .HasMethod("GIST");

        // Coordinates Value Object
        builder.ComplexProperty(e => e.Coordinates, coord =>
        {
            coord.Property(c => c.Latitude)
                .HasColumnName("latitude")
                .HasPrecision(9, 6)
                .IsRequired();
            coord.Property(c => c.Longitude)
                .HasColumnName("longitude")
                .HasPrecision(9, 6)
                .IsRequired();
        });

        // Market-derived rate estimations (Median, Min, Max - Nullable for InsufficientData)
        builder.Property(e => e.EstimatedRatePerCent)
            .HasColumnName("estimated_rate_per_cent")
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(e => e.EstimatedRatePerSqFt)
            .HasColumnName("estimated_rate_per_sqft")
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(e => e.MinRatePerCent)
            .HasColumnName("min_rate_per_cent")
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(e => e.MinRatePerSqFt)
            .HasColumnName("min_rate_per_sqft")
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(e => e.MaxRatePerCent)
            .HasColumnName("max_rate_per_cent")
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(e => e.MaxRatePerSqFt)
            .HasColumnName("max_rate_per_sqft")
            .HasPrecision(18, 2)
            .IsRequired(false);

        // Separate government guideline benchmark rates
        builder.Property(e => e.GuidelineRatePerCent)
            .HasColumnName("guideline_rate_per_cent")
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(e => e.GuidelineRatePerSqFt)
            .HasColumnName("guideline_rate_per_sqft")
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(e => e.ConfidenceLevel)
            .HasColumnName("confidence_level")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.ReviewStatus)
            .HasColumnName("review_status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.SampleCount).HasColumnName("sample_count").IsRequired();
        builder.Property(e => e.VerifiedSampleCount).HasColumnName("verified_sample_count").IsRequired();
        builder.Property(e => e.Methodology).HasColumnName("methodology").HasMaxLength(150).IsRequired();
        builder.Property(e => e.AlgorithmVersion).HasColumnName("algorithm_version").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Limitations).HasColumnName("limitations").HasMaxLength(2000);

        builder.Property(e => e.CalculatedAtUtc)
            .HasColumnName("calculated_at_utc")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(e => e.ReviewedBy).HasColumnName("reviewed_by").HasMaxLength(100);
        builder.Property(e => e.ReviewedAtUtc).HasColumnName("reviewed_at_utc").HasColumnType("timestamp with time zone");

        // Compound indexes for temporal analytics & spatial locality lookups
        builder.HasIndex(e => new { e.Locality, e.TargetYear, e.LandUsage })
            .HasDatabaseName("idx_historical_estimates_locality_year_usage");

        builder.HasIndex(e => new { e.District, e.TargetYear })
            .HasDatabaseName("idx_historical_estimates_district_year");
    }
}
