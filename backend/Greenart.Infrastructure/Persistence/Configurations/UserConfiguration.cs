using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).HasColumnName("id");

        builder.Property(u => u.Email)
            .HasColumnName("email")
            .HasMaxLength(256)
            .IsRequired();

        // Unique index on normalized email
        builder.HasIndex(u => u.Email)
            .IsUnique()
            .HasDatabaseName("idx_users_email_unique");

        builder.Property(u => u.FullName)
            .HasColumnName("full_name")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(u => u.PhoneNumber)
            .HasColumnName("phone_number")
            .HasMaxLength(25);

        builder.Property(u => u.GoogleSubjectId)
            .HasColumnName("google_subject_id")
            .HasMaxLength(255)
            .IsRequired();

        // Unique index on Google OAuth subject identifier
        builder.HasIndex(u => u.GoogleSubjectId)
            .IsUnique()
            .HasDatabaseName("idx_users_google_subject_id_unique");

        builder.Property(u => u.AvatarUrl)
            .HasColumnName("avatar_url")
            .HasMaxLength(1000);

        builder.Property(u => u.Role)
            .HasColumnName("role")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(u => u.AccountStatus)
            .HasColumnName("account_status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(u => u.IsSellerVerified)
            .HasColumnName("is_seller_verified")
            .IsRequired();

        builder.Property(u => u.SellerType)
            .HasColumnName("seller_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(u => u.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(u => u.LastLoginAtUtc)
            .HasColumnName("last_login_at_utc")
            .HasColumnType("timestamp with time zone");

        builder.Property(u => u.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(256);

        builder.Property(u => u.PasswordSalt)
            .HasColumnName("password_salt")
            .HasMaxLength(128);

        builder.Property(u => u.OtpHash)
            .HasColumnName("otp_hash")
            .HasMaxLength(256);

        builder.Property(u => u.OtpExpiresAtUtc)
            .HasColumnName("otp_expires_at_utc")
            .HasColumnType("timestamp with time zone");

        builder.Property(u => u.IsEmailVerified)
            .HasColumnName("is_email_verified")
            .IsRequired()
            .HasDefaultValue(false);

        // Refresh tokens cascade delete when user is deleted
        builder.HasMany(u => u.RefreshTokens)
            .WithOne(t => t.User)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Listings and enquiries restrict delete to maintain marketplace audit trails
        builder.HasMany(u => u.Listings)
            .WithOne(l => l.Seller)
            .HasForeignKey(l => l.SellerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(u => u.Enquiries)
            .WithOne(e => e.BuyerUser)
            .HasForeignKey(e => e.BuyerUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

