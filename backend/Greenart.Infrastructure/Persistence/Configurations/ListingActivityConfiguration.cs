using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class ListingActivityConfiguration :
    IEntityTypeConfiguration<ListingMedia>, IEntityTypeConfiguration<ListingPriceChange>,
    IEntityTypeConfiguration<ListingModerationChange>, IEntityTypeConfiguration<ListingFavourite>,
    IEntityTypeConfiguration<ListingReport>, IEntityTypeConfiguration<ListingMediaBlob>
{
    public void Configure(EntityTypeBuilder<ListingMedia> builder)
    {
        builder.ToTable("listing_media");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id");
        builder.Property(m => m.ListingId).HasColumnName("listing_id");
        builder.Property(m => m.Kind).HasColumnName("kind").HasConversion<string>().HasMaxLength(25);
        builder.Property(m => m.ContentType).HasColumnName("content_type").HasMaxLength(60);
        builder.Property(m => m.IsCover).HasColumnName("is_cover");
        builder.Property(m => m.SortOrder).HasColumnName("sort_order");
        builder.Property(m => m.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.HasOne<MarketplaceListing>().WithMany().HasForeignKey(m => m.ListingId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(m => new { m.ListingId, m.Kind, m.SortOrder });
    }

    public void Configure(EntityTypeBuilder<ListingMediaBlob> builder)
    {
        builder.ToTable("listing_media_blobs");
        builder.HasKey(m => m.MediaId);
        builder.Property(m => m.MediaId).HasColumnName("media_id");
        builder.Property(m => m.Content).HasColumnName("content");
        builder.HasOne<ListingMedia>().WithOne().HasForeignKey<ListingMediaBlob>(m => m.MediaId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    public void Configure(EntityTypeBuilder<ListingPriceChange> builder)
    {
        builder.ToTable("listing_price_changes");
        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).HasColumnName("id");
        builder.Property(h => h.ListingId).HasColumnName("listing_id");
        builder.Property(h => h.ChangedByUserId).HasColumnName("changed_by_user_id");
        builder.Property(h => h.PreviousPrice).HasColumnName("previous_price").HasPrecision(18, 2);
        builder.Property(h => h.NewPrice).HasColumnName("new_price").HasPrecision(18, 2);
        builder.Property(h => h.ChangedAtUtc).HasColumnName("changed_at_utc");
        builder.HasOne<MarketplaceListing>().WithMany().HasForeignKey(h => h.ListingId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(h => h.ChangedByUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(h => new { h.ListingId, h.ChangedAtUtc });
    }

    public void Configure(EntityTypeBuilder<ListingModerationChange> builder)
    {
        builder.ToTable("listing_moderation_changes");
        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).HasColumnName("id");
        builder.Property(h => h.ListingId).HasColumnName("listing_id");
        builder.Property(h => h.ActorUserId).HasColumnName("actor_user_id");
        builder.Property(h => h.PreviousStatus).HasColumnName("previous_status").HasConversion<string>().HasMaxLength(25);
        builder.Property(h => h.NewStatus).HasColumnName("new_status").HasConversion<string>().HasMaxLength(25);
        builder.Property(h => h.ListingVersion).HasColumnName("listing_version");
        builder.Property(h => h.Reason).HasColumnName("reason").HasMaxLength(1000);
        builder.Property(h => h.Notes).HasColumnName("notes").HasMaxLength(2000);
        builder.Property(h => h.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.HasOne<MarketplaceListing>().WithMany().HasForeignKey(h => h.ListingId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(h => h.ActorUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(h => new { h.ListingId, h.ListingVersion }).IsUnique();
    }

    public void Configure(EntityTypeBuilder<ListingFavourite> builder)
    {
        builder.ToTable("listing_favourites");
        builder.HasKey(f => new { f.UserId, f.ListingId });
        builder.Property(f => f.UserId).HasColumnName("user_id");
        builder.Property(f => f.ListingId).HasColumnName("listing_id");
        builder.Property(f => f.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.HasOne<MarketplaceListing>().WithMany().HasForeignKey(f => f.ListingId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(f => new { f.UserId, f.CreatedAtUtc });
    }

    public void Configure(EntityTypeBuilder<ListingReport> builder)
    {
        builder.ToTable("listing_reports");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.ListingId).HasColumnName("listing_id");
        builder.Property(r => r.ReporterUserId).HasColumnName("reporter_user_id");
        builder.Property(r => r.Reason).HasColumnName("reason").HasMaxLength(1000);
        builder.Property(r => r.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.HasOne<MarketplaceListing>().WithMany().HasForeignKey(r => r.ListingId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(r => r.ReporterUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(r => new { r.ReporterUserId, r.ListingId }).IsUnique();
        builder.HasIndex(r => r.CreatedAtUtc);
    }
}
