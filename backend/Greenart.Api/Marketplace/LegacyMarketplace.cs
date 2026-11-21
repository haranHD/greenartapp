using System.Security.Claims;
using Greenart.Application.DTOs;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static Greenart.Api.Marketplace.MarketplaceAccess;

namespace Greenart.Api.Marketplace;

internal static partial class PropertyEndpoints
{
    public static void MapLegacyMarketplace(this WebApplication app)
    {
        var listings = app.MapGroup("/api/v1/marketplace/listings").WithTags("Marketplace").AddEndpointFilter(NoStore);
        listings.MapGet("", LegacyBrowse).WithName("GetActiveMarketplaceListings");
        listings.MapGet("/my", LegacyMine).RequireAuthorization().WithName("GetMyMarketplaceListings");
        listings.MapGet("/{id:guid}", LegacyDetail).WithName("GetMarketplaceListingById");
        listings.MapPost("", CreateLegacy).RequireAuthorization().RequireRateLimiting("PropertyWriteRateLimit")
            .WithName("CreateMarketplaceListing");
        listings.MapPost("/{id:guid}/enquiries", CreateEnquiry).RequireAuthorization().WithName("SubmitListingEnquiry");
        app.MapGet("/api/v1/marketplace/enquiries/my", LegacyBuyerEnquiries).RequireAuthorization()
            .WithTags("Marketplace").AddEndpointFilter(NoStore).WithName("GetMyListingEnquiries");

        var admin = app.MapGroup("/api/v1/admin/marketplace/listings")
            .WithTags("Administration").AddEndpointFilter(NoStore);
        admin.MapGet("/pending", LegacyPending).WithName("GetPendingModerationListings");
        admin.MapPost("/{id:guid}/review", LegacyReview).WithName("ReviewMarketplaceListing");
    }

    private static async Task<IResult> LegacyBrowse(string? district, int? landUsage, decimal? maxPrice, string? search,
        LandPriceDbContext db, CancellationToken ct)
    {
        if (district?.Length > 100 || search?.Length > 150)
            return Bad("Invalid search filters.");

        var listings = PublicListings(db).AsNoTracking().Include(l => l.Seller).AsQueryable();
        if (PropertyValidation.Clean(district)?.ToLowerInvariant() is { } districtCode && districtCode != "all")
            listings = listings.Where(l => l.District.ToLower() == districtCode);
        if (landUsage > 0)
            listings = listings.Where(l => (int)l.LandUsage == landUsage);
        if (maxPrice > 0)
            listings = listings.Where(l => l.AskingPriceTotal <= maxPrice);
        if (PropertyValidation.Clean(search)?.ToLowerInvariant() is { } term)
            listings = listings.Where(l => l.Locality.ToLower().Contains(term) || l.Title.ToLower().Contains(term) ||
                l.Taluk != null && l.Taluk.ToLower().Contains(term));

        var rows = await listings.OrderByDescending(l => l.CreatedAtUtc).ThenBy(l => l.Id).Take(50).ToListAsync(ct);
        return Results.Ok(rows.Select(l => ToLegacy(l, publicView: true)));
    }

    private static async Task<IResult> LegacyDetail(Guid id, LandPriceDbContext db, CancellationToken ct)
    {
        var listing = await PublicListings(db).AsNoTracking().Include(l => l.Seller).SingleOrDefaultAsync(l => l.Id == id, ct);
        return listing is null ? Results.NotFound() : Results.Ok(ToLegacy(listing, publicView: true));
    }

    private static async Task<IResult> LegacyMine(ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();
        var listings = await db.MarketplaceListings.AsNoTracking().Include(l => l.Seller).Where(l => l.SellerId == actor)
            .OrderByDescending(l => l.CreatedAtUtc).ThenBy(l => l.Id).ToListAsync(ct);
        return Results.Ok(listings.Select(l => ToLegacy(l)));
    }
}
