using System.Security.Cryptography;
using System.Text;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Persistence.Seeding;

/// <summary>
/// Pre-provisions core administrative, client test, and developer accounts into PostGIS PostgreSQL.
/// Ensures standard credentials work seamlessly across production and staging environments without manual registration.
/// </summary>
public static class UserDataSeeder
{
    public static (string Hash, string Salt) HashPassword(string password)
    {
        byte[] saltBytes = RandomNumberGenerator.GetBytes(16);
        byte[] hashBytes = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            saltBytes,
            iterations: 100_000,
            HashAlgorithmName.SHA256,
            outputLength: 32);
        return (Convert.ToHexString(hashBytes), Convert.ToHexString(saltBytes));
    }

    public static async Task SeedUsersAsync(LandPriceDbContext context, ILogger logger, CancellationToken cancellationToken = default)
    {
        var defaultUsers = new List<(string Email, string FullName, string Password, UserRole Role, string Phone)>
        {
            ("haricode04@gmail.com", "Hari (Lead Developer & Admin)", "Admin@123", UserRole.Administrator, "+919876543210"),
            ("admin@greenartproperties.com", "Greenart Administrator", "Admin@123", UserRole.Administrator, "+919876543211"),
            ("client@greenart.com", "Greenart Client Demo", "Admin@123", UserRole.Customer, "+919876543212"),
            ("demo@greenart.com", "Greenart Demo User", "Admin@123", UserRole.Customer, "+919876543213")
        };

        int seededCount = 0;
        int updatedCount = 0;

        foreach (var def in defaultUsers)
        {
            var normalizedEmail = def.Email.Trim().ToLowerInvariant();
            var existingUser = await context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

            if (existingUser == null)
            {
                var (hash, salt) = HashPassword(def.Password);
                var newUser = new User(
                    id: Guid.NewGuid(),
                    email: normalizedEmail,
                    fullName: def.FullName,
                    googleSubjectId: $"email:{normalizedEmail}",
                    phoneNumber: def.Phone,
                    avatarUrl: null,
                    role: def.Role,
                    accountStatus: AccountStatus.Active,
                    isSellerVerified: true,
                    sellerType: def.Role == UserRole.Administrator ? SellerType.Promoter : SellerType.IndividualOwner,
                    createdAtUtc: DateTime.UtcNow,
                    isEmailVerified: true,
                    passwordHash: hash,
                    passwordSalt: salt
                );
                context.Users.Add(newUser);
                seededCount++;
            }
            else if (string.IsNullOrWhiteSpace(existingUser.PasswordHash) || string.IsNullOrWhiteSpace(existingUser.PasswordSalt))
            {
                var (hash, salt) = HashPassword(def.Password);
                existingUser.SetPassword(hash, salt);
                existingUser.VerifyEmail();
                updatedCount++;
            }
        }

        if (seededCount > 0 || updatedCount > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Core user credentials synchronized: {Seeded} newly seeded, {Updated} updated with active passwords.", seededCount, updatedCount);
        }
    }
}
