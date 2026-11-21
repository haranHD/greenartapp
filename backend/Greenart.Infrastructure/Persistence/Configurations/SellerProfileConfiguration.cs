using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class SellerProfileConfiguration : IEntityTypeConfiguration<SellerProfile>
{
    public void Configure(EntityTypeBuilder<SellerProfile> builder)
    {
        builder.ToTable("seller_profiles");
        builder.HasKey(p => p.UserId);
        builder.Property(p => p.UserId).HasColumnName("user_id");
        builder.Property(p => p.CurrentApplicationId).HasColumnName("current_application_id");
        builder.Property(p => p.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(p => p.ApprovedAtUtc).HasColumnName("approved_at_utc");
        builder.Property(p => p.SuspendedAtUtc).HasColumnName("suspended_at_utc");
        builder.Property(p => p.SuspensionReason).HasColumnName("suspension_reason").HasMaxLength(1000);
        builder.Property(p => p.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(p => p.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.HasOne<User>().WithOne().HasForeignKey<SellerProfile>(p => p.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<SellerApplication>().WithOne().HasForeignKey<SellerProfile>(p => p.CurrentApplicationId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(p => p.Status);
    }
}
