using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class ListingEnquiryConfiguration : IEntityTypeConfiguration<ListingEnquiry>
{
    public void Configure(EntityTypeBuilder<ListingEnquiry> builder)
    {
        builder.ToTable("listing_enquiries");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id");

        builder.Property(e => e.ListingId)
            .HasColumnName("listing_id")
            .IsRequired();

        builder.Property(e => e.BuyerUserId)
            .HasColumnName("buyer_user_id")
            .IsRequired();

        builder.Property(e => e.OfferedPriceTotal)
            .HasColumnName("offered_price_total")
            .HasPrecision(18, 2);

        builder.Property(e => e.Message)
            .HasColumnName("message")
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.SubmittedAtUtc)
            .HasColumnName("submitted_at_utc")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        // Listing relationship (Cascade delete removes enquiries if listing is purged)
        builder.HasOne(e => e.Listing)
            .WithMany(l => l.Enquiries)
            .HasForeignKey(e => e.ListingId)
            .OnDelete(DeleteBehavior.Cascade);

        // Buyer relationship (Restrict delete prevents deleting a user who submitted enquiries)
        builder.HasOne(e => e.BuyerUser)
            .WithMany(u => u.Enquiries)
            .HasForeignKey(e => e.BuyerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes for chronological retrieval and user enquiry history
        builder.HasIndex(e => new { e.ListingId, e.SubmittedAtUtc })
            .HasDatabaseName("idx_listing_enquiries_listing_submitted");

        builder.HasIndex(e => e.BuyerUserId)
            .HasDatabaseName("idx_listing_enquiries_buyer_user_id");

        builder.HasIndex(e => e.Status)
            .HasDatabaseName("idx_listing_enquiries_status");
    }
}

