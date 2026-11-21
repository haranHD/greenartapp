using System.Security.Claims;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Greenart.Api.Marketplace;

internal static class MarketplaceAccess
{
    public static Guid UserId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty;

    public static Task<User?> ActiveUser(LandPriceDbContext db, Guid id, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id && u.AccountStatus == AccountStatus.Active, ct);

    public static Task<bool> IsActiveAdministrator(LandPriceDbContext db, Guid id, CancellationToken ct) =>
        db.Users.AnyAsync(u => u.Id == id && u.AccountStatus == AccountStatus.Active &&
            u.Role == UserRole.Administrator, ct);

    public static Task<SellerProfile?> ApprovedSeller(LandPriceDbContext db, Guid id, CancellationToken ct) =>
        db.SellerProfiles.FirstOrDefaultAsync(p => p.UserId == id && p.Status == SellerStatus.Approved &&
            db.Users.Any(u => u.Id == p.UserId && u.AccountStatus == AccountStatus.Active), ct);

    public static IQueryable<MarketplaceListing> PublicListings(LandPriceDbContext db) =>
        db.MarketplaceListings.Where(l => l.Status == ListingStatus.Active &&
            (l.SaleStatus == ListingSaleStatus.Available || l.SaleStatus == ListingSaleStatus.UnderNegotiation) &&
            l.Title != "" && l.Locality != "" && l.District != "" && l.State != "" &&
            l.LandUsage != 0 && l.HasExactLocation && l.AskingPriceTotal > 0 && l.ExtentSqFt > 0 && l.ExtentCent > 0 &&
            l.Seller!.AccountStatus == AccountStatus.Active &&
            db.SellerProfiles.Any(p => p.UserId == l.SellerId && p.Status == SellerStatus.Approved &&
                p.CurrentApplicationId == l.ReviewedSellerApplicationId));

    // Serialize eligibility changes and protected writes with account changes on PostgreSQL.
    public static async Task<IDbContextTransaction?> LockUsers(
        LandPriceDbContext db, CancellationToken ct, params Guid[] ids)
    {
        if (!db.Database.IsNpgsql())
            return null;

        var transaction = await db.Database.BeginTransactionAsync(ct);
        try
        {
            foreach (var id in ids.Distinct().Order())
                await db.Database.SqlQuery<Guid>($"SELECT id AS \"Value\" FROM users WHERE id = {id} FOR UPDATE")
                    .ToListAsync(ct);

            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }
}
