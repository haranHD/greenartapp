using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NetTopologySuite.Geometries;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class LandPriceRecordConfiguration : IEntityTypeConfiguration<LandPriceRecord>
{
    public void Configure(EntityTypeBuilder<LandPriceRecord> builder)
    {
        builder.ToTable("land_price_records");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");

        builder.Property(r => r.Country).HasColumnName("country").HasMaxLength(100).IsRequired();
        builder.Property(r => r.State).HasColumnName("state").HasMaxLength(100).IsRequired();
        builder.Property(r => r.District).HasColumnName("district").HasMaxLength(100).IsRequired();
        builder.Property(r => r.Taluk).HasColumnName("taluk").HasMaxLength(100);
        builder.Property(r => r.Locality).HasColumnName("locality").HasMaxLength(150).IsRequired();
        builder.Property(r => r.StreetOrLandmark).HasColumnName("street_or_landmark").HasMaxLength(250);
        builder.Property(r => r.SurveyNumber).HasColumnName("survey_number").HasMaxLength(100);

        // Spatial Location Column (PostGIS geography Point SRID 4326)
        builder.Property<Point>("Location")
            .HasColumnName("location")
            .HasColumnType("geography(Point, 4326)")
            .IsRequired();

        // Generalized Search Tree (GIST) spatial index
        builder.HasIndex("Location")
            .HasDatabaseName("idx_land_price_records_location")
            .HasMethod("GIST");

        // Coordinates Value Object (EF Core 8 ComplexProperty for DDD readonly struct)
        builder.ComplexProperty(r => r.Coordinates, coord =>
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

        // Land Usage Enum
        builder.Property(r => r.LandUsage)
            .HasColumnName("land_usage")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        // Area Value Object (EF Core 8 ComplexProperty for DDD readonly struct)
        builder.ComplexProperty(r => r.Area, area =>
        {
            area.Property(a => a.Value)
                .HasColumnName("original_area")
                .HasPrecision(18, 4)
                .IsRequired();
            area.Property(a => a.Unit)
                .HasColumnName("original_unit")
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();
        });

        // Prices and Normalized Rates
        builder.Property(r => r.OriginalPrice)
            .HasColumnName("original_price")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.NormalizedRatePerCent)
            .HasColumnName("normalized_rate_per_cent")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.NormalizedRatePerSqFt)
            .HasColumnName("normalized_rate_per_sqft")
            .HasPrecision(18, 2)
            .IsRequired();

        // Provenance & Source Metadata
        builder.Property(r => r.SourceCategory)
            .HasColumnName("source_category")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(r => r.SourceReference)
            .HasColumnName("source_reference")
            .HasMaxLength(300);

        builder.Property(r => r.ObservationDate)
            .HasColumnName("observation_date")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(r => r.RetrievalDate)
            .HasColumnName("retrieval_date")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(r => r.VerificationStatus)
            .HasColumnName("verification_status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(r => r.IsSynthetic)
            .HasColumnName("is_synthetic")
            .IsRequired();

        builder.Property(r => r.Notes)
            .HasColumnName("notes")
            .HasMaxLength(1000);

        // Indices for high-frequency queries
        builder.HasIndex(r => r.Locality)
            .HasDatabaseName("idx_land_price_records_locality");

        builder.HasIndex(r => r.LandUsage)
            .HasDatabaseName("idx_land_price_records_land_usage");

        builder.HasIndex(r => r.SourceCategory)
            .HasDatabaseName("idx_land_price_records_source_category");
    }
}
