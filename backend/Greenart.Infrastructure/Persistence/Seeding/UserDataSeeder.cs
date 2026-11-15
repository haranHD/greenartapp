using System.Security.Cryptography;
using System.Text;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Persistence.Seeding;

/// <summary>
/// Pre-provisions core administrative, client test, and developer accounts into PostGIS PostgreSQL.
/// Seeded ONLY in the Development environment when SEED_ADMIN_PASSWORD is set. Never runs in Production.
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

    public static async Task SeedUsersAsync(
        LandPriceDbContext context,
        ILogger logger,
        bool isDevelopment = false,
        string? adminPassword = null,
        CancellationToken cancellationToken = default)
    {
        if (!isDevelopment)
        {
            logger.LogInformation("Skipping demo user seeding: current environment is not Development. Seeding is strictly disabled in Production.");
            return;
        }

        if (string.IsNullOrWhiteSpace(adminPassword))
        {
            logger.LogWarning("No SEED_ADMIN_PASSWORD configured for Development demo seeding. Skipping user seeding.");
            return;
        }

        var devPassword = adminPassword.Trim();
        var defaultUsers = new List<(string Email, string FullName, UserRole Role, string Phone)>
        {
            ("haricode04@gmail.com", "Hari (Lead Developer & Admin)", UserRole.Administrator, "+919876543210"),
            ("admin@greenartproperties.com", "Greenart Administrator", UserRole.Administrator, "+919876543211"),
            ("client@greenart.com", "Greenart Client Demo", UserRole.Customer, "+919876543212"),
            ("demo@greenart.com", "Greenart Demo User", UserRole.Customer, "+919876543213")
        };

        int seededCount = 0;
        int updatedCount = 0;

        foreach (var def in defaultUsers)
        {
            var normalizedEmail = def.Email.Trim().ToLowerInvariant();
            var existingUser = await context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

            if (existingUser == null)
            {
                var (hash, salt) = HashPassword(devPassword);
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
                var (hash, salt) = HashPassword(devPassword);
                existingUser.SetPassword(hash, salt);
                existingUser.VerifyEmail();
                updatedCount++;
            }
        }

        if (seededCount > 0 || updatedCount > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Development demo user credentials synchronized: {Seeded} newly seeded, {Updated} updated.", seededCount, updatedCount);
        }
    }
}
