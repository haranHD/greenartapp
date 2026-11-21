using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class SellerApplicationConfiguration : IEntityTypeConfiguration<SellerApplication>
{
    public void Configure(EntityTypeBuilder<SellerApplication> builder)
    {
        builder.ToTable("seller_applications");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");
        builder.Property(a => a.UserId).HasColumnName("user_id");
        builder.Property(a => a.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(32);
        builder.Property(a => a.ApplicantFeedback).HasColumnName("applicant_feedback").HasMaxLength(1000);
        builder.Property(a => a.ReviewNotes).HasColumnName("review_notes").HasMaxLength(2000);
        builder.Property(a => a.ReviewedByUserId).HasColumnName("reviewed_by_user_id");
        builder.Property(a => a.ReviewedAtUtc).HasColumnName("reviewed_at_utc");
        builder.Property(a => a.SubmittedAtUtc).HasColumnName("submitted_at_utc");
        builder.Property(a => a.CreatedAtUtc).HasColumnName("created_at_utc");
        builder.Property(a => a.UpdatedAtUtc).HasColumnName("updated_at_utc");
        builder.Property(a => a.Version).HasColumnName("version").IsConcurrencyToken();
        builder.ComplexProperty(a => a.Details, details =>
        {
            details.Property(d => d.ApplicantName).HasColumnName("applicant_name").HasMaxLength(150);
            details.Property(d => d.SellerType).HasColumnName("seller_type").HasConversion<string>().HasMaxLength(32);
            details.Property(d => d.ContactInformation).HasColumnName("contact_information").HasMaxLength(250);
            details.Property(d => d.OperatingDistrict).HasColumnName("operating_district").HasMaxLength(100);
            details.Property(d => d.OperatingLocality).HasColumnName("operating_locality").HasMaxLength(150);
            details.Property(d => d.BusinessDetails).HasColumnName("business_details").HasMaxLength(1000);
            details.Property(d => d.AuthorisationInformation).HasColumnName("authorisation_information").HasMaxLength(2000);
            details.Property(d => d.DeclaresAccuracy).HasColumnName("declares_accuracy");
        });
        builder.HasOne<User>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(a => a.ReviewedByUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(a => new { a.Status, a.SubmittedAtUtc });
        builder.HasIndex(a => a.UserId).IsUnique().HasFilter("status IN ('PendingReview', 'NeedsInformation')");
    }
}
