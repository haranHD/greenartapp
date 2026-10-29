using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NetTopologySuite.Geometries;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class MarketplaceListingConfiguration : IEntityTypeConfiguration<MarketplaceListing>
{
    public void Configure(EntityTypeBuilder<MarketplaceListing> builder)
    {
        builder.ToTable("marketplace_listings");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).HasColumnName("id");

        builder.Property(l => l.Title)
            .HasColumnName("title")
            .HasMaxLength(250)
            .IsRequired();

        builder.Property(l => l.Description)
            .HasColumnName("description")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(l => l.SellerId)
            .HasColumnName("seller_id")
            .IsRequired();

        builder.Property(l => l.Locality)
            .HasColumnName("locality")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(l => l.District)
            .HasColumnName("district")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.State)
            .HasColumnName("state")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.Taluk)
            .HasColumnName("taluk")
            .HasMaxLength(100);

        builder.Property(l => l.StreetAddress)
            .HasColumnName("street_address")
            .HasMaxLength(250);

        builder.Property(l => l.SurveyNumber)
            .HasColumnName("survey_number")
            .HasMaxLength(100);

        // Spatial Location Column (PostGIS geography Point SRID 4326)
        builder.Property<Point>("Location")
            .HasColumnName("location")
            .HasColumnType("geography(Point, 4326)")
            .IsRequired();

        // GIST spatial index for proximity and radius queries
        builder.HasIndex("Location")
            .HasDatabaseName("idx_marketplace_listings_location")
            .HasMethod("GIST");

        // Coordinates Value Object (EF Core 8 ComplexProperty)
        builder.ComplexProperty(l => l.Coordinates, coord =>
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

        builder.Property(l => l.LandUsage)
            .HasColumnName("land_usage")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        // Extents
        builder.Property(l => l.ExtentCent)
            .HasColumnName("extent_cent")
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(l => l.ExtentSqFt)
            .HasColumnName("extent_sqft")
            .HasPrecision(18, 2)
            .IsRequired();

        // Asking Price Architecture (distinct from empirical valuation)
        builder.Property(l => l.AskingPriceTotal)
            .HasColumnName("asking_price_total")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(l => l.AskingRatePerCent)
            .HasColumnName("asking_rate_per_cent")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(l => l.AskingRatePerSqFt)
            .HasColumnName("asking_rate_per_sqft")
            .HasPrecision(18, 2)
            .IsRequired();

        // Intelligence Benchmarks (reference points)
        builder.Property(l => l.GuidelineRatePerCent)
            .HasColumnName("guideline_rate_per_cent")
            .HasPrecision(18, 2);

        builder.Property(l => l.GuidelineRatePerSqFt)
            .HasColumnName("guideline_rate_per_sqft")
            .HasPrecision(18, 2);

        builder.Property(l => l.EstimatedMarketMedianPerCent)
            .HasColumnName("estimated_market_median_per_cent")
            .HasPrecision(18, 2);

        // Moderation & Lifecycle
        builder.Property(l => l.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.RejectionReason)
            .HasColumnName("rejection_reason")
            .HasMaxLength(1000);

        builder.Property(l => l.ModerationNotes)
            .HasColumnName("moderation_notes")
            .HasMaxLength(2000);

        builder.Property(l => l.ReviewedByUserId)
            .HasColumnName("reviewed_by_user_id");

        builder.Property(l => l.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(l => l.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        // Seller relationship (Restrict delete prevents deleting a user who owns listings)
        builder.HasOne(l => l.Seller)
            .WithMany(u => u.Listings)
            .HasForeignKey(l => l.SellerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Reviewer relationship
        builder.HasOne(l => l.ReviewedByUser)
            .WithMany()
            .HasForeignKey(l => l.ReviewedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Enquiries relationship (Cascade delete removes enquiries if listing is purged)
        builder.HasMany(l => l.Enquiries)
            .WithOne(e => e.Listing)
            .HasForeignKey(e => e.ListingId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes for marketplace filtering and moderation queries
        builder.HasIndex(l => l.Status)
            .HasDatabaseName("idx_marketplace_listings_status");

        builder.HasIndex(l => l.SellerId)
            .HasDatabaseName("idx_marketplace_listings_seller_id");

        builder.HasIndex(l => new { l.Locality, l.Status })
            .HasDatabaseName("idx_marketplace_listings_locality_status");
    }
}

