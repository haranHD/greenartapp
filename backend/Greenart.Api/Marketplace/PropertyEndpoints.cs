using System.Security.Claims;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NetTopologySuite.Geometries;
using static Greenart.Api.Marketplace.MarketplaceAccess;

namespace Greenart.Api.Marketplace;

internal static partial class PropertyEndpoints
{
    public static void MapProperties(this WebApplication app)
    {
        var properties = app.MapGroup("/api/v1/properties").WithTags("Properties").AddEndpointFilter(NoStore);
        properties.MapGet("", Browse);
        properties.MapGet("/map", SearchMap);
        properties.MapGet("/{id:guid}", PublicDetail);
        properties.MapPost("", CreateDraft).RequireAuthorization().RequireRateLimiting("PropertyWriteRateLimit");
        properties.MapPatch("/{id:guid}", Edit).RequireAuthorization();
        properties.MapPost("/{id:guid}/submit", Submit).RequireAuthorization();
        properties.MapPost("/{id:guid}/media", Upload).RequireAuthorization().RequireRateLimiting("PropertyWriteRateLimit");
        properties.MapGet("/{id:guid}/media/{mediaId:guid}", RetrieveMedia);
        properties.MapPatch("/{id:guid}/media", OrderMedia).RequireAuthorization();
        properties.MapDelete("/{id:guid}/media/{mediaId:guid}", DeleteMedia).RequireAuthorization();

        properties.MapPost("/{id:guid}/enquiries", CreateEnquiry).RequireAuthorization();
        properties.MapPost("/{id:guid}/favourite", AddFavourite).RequireAuthorization();
        properties.MapDelete("/{id:guid}/favourite", RemoveFavourite).RequireAuthorization();
        properties.MapPost("/{id:guid}/reports", Report).RequireAuthorization();

        var seller = app.MapGroup("/api/v1/sellers/me").RequireAuthorization().WithTags("Sellers").AddEndpointFilter(NoStore);
        seller.MapGet("/properties", SellerListings);
        seller.MapGet("/properties/{id:guid}", SellerDetail);
        seller.MapPatch("/properties/{id:guid}/sale-status", SaleStatus);
        seller.MapGet("/enquiries", SellerEnquiries);
        seller.MapPatch("/enquiries/{id:guid}", UpdateEnquiry);
        app.MapGet("/api/v1/users/me/favourites", Favourites).RequireAuthorization().WithTags("Properties")
            .AddEndpointFilter(NoStore);

        var admin = app.MapGroup("/api/v1/admin/properties").RequireAuthorization("AdministratorPolicy")
            .WithTags("Administration").AddEndpointFilter(NoStore);
        admin.MapGet("", AdminListings);
        admin.MapGet("/pending", PendingListings);
        admin.MapGet("/{id:guid}", AdminDetail);
        admin.MapPatch("/{id:guid}/moderation", Moderate);
        admin.MapGet("/reports", AdminReports);
        admin.MapGet("/enquiries", AdminEnquiries);
    }

    private static ValueTask<object?> NoStore(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        context.HttpContext.Response.Headers.CacheControl = "private, no-store";
        return next(context);
    }

    private static async Task<IResult> Browse([AsParameters] PropertySearch query, LandPriceDbContext db, CancellationToken ct) =>
        await Discover(query, null, db, ct);

    private static async Task<IResult> SearchMap([AsParameters] PropertySearch query,
        double latitude, double longitude, double radiusMeters, LandPriceDbContext db, CancellationToken ct)
    {
        if (!PropertyValidation.ValidPoint(latitude, longitude) || !double.IsFinite(radiusMeters) ||
            radiusMeters is < 1 or > 100_000)
            return Bad("Provide a valid map centre and a radius of 1 to 100000 metres.");

        return await Discover(query, new MapSearch(new Point(longitude, latitude) { SRID = 4326 }, radiusMeters), db, ct);
    }

    private static async Task<IResult> Discover(PropertySearch input, MapSearch? map, LandPriceDbContext db, CancellationToken ct)
    {
        if (!ValidPage(input.Page, input.PageSize) || input.Search?.Length > 150 || input.District?.Length > 100 ||
            input.Locality?.Length > 150 || input.MinPrice is < 0 || input.MaxPrice is < 0 ||
            input.MinAreaCent is < 0 || input.MaxAreaCent is < 0 || input.MinPrice > input.MaxPrice ||
            input.MinAreaCent > input.MaxAreaCent || input.LandUsage is { } usage && !Enum.IsDefined(usage) ||
            input.Sort is { } sort && !Enum.IsDefined(sort))
            return Bad("Invalid filters, sort order or pagination.");

        var query = PublicListings(db).AsNoTracking().Include(l => l.Seller).AsQueryable();
        if (map is not null)
            query = query.Where(l => EF.Functions.IsWithinDistance(
                EF.Property<Point>(l, "PublicLocation"), map.Centre, map.RadiusMeters, true));

        if (PropertyValidation.Clean(input.Search)?.ToLowerInvariant() is { } search)
            query = query.Where(l => l.Title.ToLower().Contains(search) || l.Locality.ToLower().Contains(search) ||
                l.District.ToLower().Contains(search) || l.Taluk != null && l.Taluk.ToLower().Contains(search));
        if (PropertyValidation.Clean(input.District)?.ToLowerInvariant() is { } district)
            query = query.Where(l => l.District.ToLower() == district);
        if (PropertyValidation.Clean(input.Locality)?.ToLowerInvariant() is { } locality)
            query = query.Where(l => l.Locality.ToLower() == locality);
        if (input.LandUsage.HasValue)
            query = query.Where(l => l.LandUsage == input.LandUsage);
        if (input.MinPrice.HasValue)
            query = query.Where(l => l.AskingPriceTotal >= input.MinPrice);
        if (input.MaxPrice.HasValue)
            query = query.Where(l => l.AskingPriceTotal <= input.MaxPrice);
        if (input.MinAreaCent.HasValue)
            query = query.Where(l => l.ExtentCent >= input.MinAreaCent);
        if (input.MaxAreaCent.HasValue)
            query = query.Where(l => l.ExtentCent <= input.MaxAreaCent);

        var ordered = input.Sort switch
        {
            PropertySort.PriceAscending => query.OrderBy(l => l.AskingPriceTotal),
            PropertySort.PriceDescending => query.OrderByDescending(l => l.AskingPriceTotal),
            PropertySort.AreaAscending => query.OrderBy(l => l.ExtentCent),
            PropertySort.AreaDescending => query.OrderByDescending(l => l.ExtentCent),
            _ => query.OrderByDescending(l => l.PublishedAtUtc ?? l.CreatedAtUtc)
        };
        var rows = await Page(ordered.ThenBy(l => l.Id), input.Page, input.PageSize, ct);
        return Results.Ok(await PublicPage(rows, db, ct));
    }

    private static async Task<IResult> PublicDetail(Guid id, LandPriceDbContext db, CancellationToken ct)
    {
        var listing = await PublicListings(db).AsNoTracking().Include(l => l.Seller).SingleOrDefaultAsync(l => l.Id == id, ct);
        if (listing is null)
            return Results.NotFound();

        var photos = await PublicPhotoQuery(db, [id]).Select(m => new
        {
            m.Id, m.Kind, m.ContentType, m.IsCover, m.SortOrder, m.CreatedAtUtc
        }).ToListAsync(ct);
        return Results.Ok(ToPublic(listing, photos.Select(m => ToMedia(id, m.Id, m.Kind, m.ContentType,
            m.IsCover, m.SortOrder, m.CreatedAtUtc)).ToArray(), true));
    }

    private static async Task<IResult> SellerListings(ClaimsPrincipal principal, LandPriceDbContext db,
        int? page, int? pageSize, CancellationToken ct)
    {
        var actor = UserId(principal);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();
        if (!ValidPage(page, pageSize))
            return Bad("Invalid pagination.");

        var approved = await ApprovedSeller(db, actor, ct) is not null;
        var rows = await Page(db.MarketplaceListings.AsNoTracking().Include(l => l.Seller).Where(l => l.SellerId == actor)
            .OrderByDescending(l => l.UpdatedAtUtc).ThenBy(l => l.Id), page, pageSize, ct);
        return Results.Ok(ProjectPage(rows, l => ToOwner(l, [], approved)));
    }

    private static async Task<IResult> SellerDetail(Guid id, ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();

        var listing = await db.MarketplaceListings.AsNoTracking().Include(l => l.Seller)
            .SingleOrDefaultAsync(l => l.Id == id && l.SellerId == actor, ct);
        return listing is null ? Results.NotFound() :
            Results.Ok(ToOwner(listing, await OwnerMedia(db, id, ct), await ApprovedSeller(db, actor, ct) is not null));
    }

    private static async Task<IResult> CreateDraft(PropertyDraftRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct) =>
        await Create(request, UserId(principal), db, legacy: false, ct);

    public static async Task<IResult> CreateLegacy(CreateListingRequestDto request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var draft = new PropertyDraftRequest(Title: request.Title, Description: request.Description, State: request.State,
            District: request.District, Taluk: request.Taluk, Locality: request.Locality, StreetAddress: request.StreetAddress,
            SurveyNumber: request.SurveyNumber,
            Latitude: request.Latitude != 0 ? request.Latitude : 11.0168,
            Longitude: request.Longitude != 0 ? request.Longitude : 76.9558,
            LandUsage: request.LandUsage,
            Area: request.ExtentCent, AreaUnit: AreaUnit.Cent, AskingPriceTotal: request.AskingPriceTotal);
        return await Create(draft, UserId(principal), db, legacy: true, ct);
    }

    private static async Task<IResult> Create(PropertyDraftRequest request, Guid sellerId, LandPriceDbContext db,
        bool legacy, CancellationToken ct)
    {
        await using var transaction = await LockUsers(db, ct, sellerId);
        var sellerProfile = await ApprovedSeller(db, sellerId, ct);
        if (sellerProfile is null)
        {
            if (legacy)
            {
                var sellerUser = await ActiveUser(db, sellerId, ct);
                if (sellerUser is null)
                    return Results.Forbid();

                var now = DateTime.UtcNow;
                var details = new SellerApplicationDetails(
                    ApplicantName: string.IsNullOrWhiteSpace(sellerUser.FullName) ? "Property Owner" : sellerUser.FullName,
                    SellerType: sellerUser.SellerType ?? SellerType.IndividualOwner,
                    ContactInformation: string.IsNullOrWhiteSpace(sellerUser.PhoneNumber) ? (sellerUser.Email ?? "Mobile User") : sellerUser.PhoneNumber,
                    OperatingDistrict: request.District ?? "Tamil Nadu",
                    OperatingLocality: request.Locality ?? "Tamil Nadu",
                    BusinessDetails: "Mobile App Land Seller",
                    AuthorisationInformation: "Direct Owner Registration",
                    DeclaresAccuracy: true);

                var app = new SellerApplication(sellerId, details, now);
                app.AutoApproveForDirectListing(now);
                db.SellerApplications.Add(app);

                sellerProfile = await db.SellerProfiles.FindAsync([sellerId], ct);
                if (sellerProfile is null)
                {
                    sellerProfile = new SellerProfile(app, now);
                    db.SellerProfiles.Add(sellerProfile);
                }
                else
                {
                    sellerProfile.TrackApplication(app, now);
                }

                sellerUser.SetSellerVerification(true);
                sellerUser.SetSellerType(details.SellerType);
            }
            else
            {
                return Results.Forbid();
            }
        }

        if (request.RequestId is { } requestId)
        {
            var existing = await db.MarketplaceListings.Include(l => l.Seller)
                .SingleOrDefaultAsync(l => l.SellerId == sellerId && l.CreationRequestId == requestId, ct);
            if (existing is not null)
                return Results.Ok(ToOwner(existing, await OwnerMedia(db, existing.Id, ct), true));
        }

        if (PropertyValidation.Read(request) is not { } revision)
            return Bad("Invalid listing data. Check field lengths, location, price and area.");

        // Track the existing user so the legacy response keeps the seller display name.
        var user = await ActiveUser(db, sellerId, ct);
        var listing = MarketplaceListing.CreateDraft(sellerId, request.RequestId, revision);
        if (user is not null)
        {
            listing.AttachSeller(user);
        }
        if (legacy)
        {
            if (!listing.HasRequiredDetails(requireLocation: false))
                return Bad("Complete the required property details before submitting.");
            if (await IsDuplicate(db, listing, ct))
                return Conflict("This seller already has a submission for the same parcel.");
            listing.Submit(requireLocation: false);
        }

        db.MarketplaceListings.Add(listing);
        RecordPrice(db, listing, sellerId, 0);
        if (legacy)
            RecordModeration(db, listing, sellerId, ListingStatus.Draft, "ListingSubmitted");
        await Save(db, transaction, ct);
        return legacy
            ? Results.Created("/api/v1/marketplace/listings/my", ToLegacy(listing))
            : Results.Created($"/api/v1/sellers/me/properties/{listing.Id}", ToOwner(listing, [], true));
    }

    private static async Task<IResult> Edit(Guid id, PropertyDraftRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        await using var transaction = await LockUsers(db, ct, actor);
        var (listing, error) = await OwnedMutation(db, id, actor, request.Version, ct);
        if (listing is null)
            return error!;
        if (!listing.CanEdit)
            return Conflict("This listing is closed or restricted.");
        if (request.RequestId is not null || PropertyValidation.Read(request) is not { } revision)
            return Bad("Invalid listing revision. Check field lengths, location, price and area.");

        var previousPrice = listing.AskingPriceTotal;
        var previousStatus = listing.Status;
        listing.Edit(revision);
        RecordPrice(db, listing, actor, previousPrice);
        if (previousStatus != listing.Status)
            RecordModeration(db, listing, actor, previousStatus, "ListingRevisionRequiresReview");
        await Save(db, transaction, ct);
        return Results.Ok(ToOwner(listing, await OwnerMedia(db, id, ct), true));
    }

    private static async Task<IResult> Submit(Guid id, PropertyVersionRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        await using var transaction = await LockUsers(db, ct, actor);
        var (listing, error) = await OwnedMutation(db, id, actor, request.Version, ct);
        if (listing is null)
            return error!;
        if (!listing.CanEdit || listing.Status is not (ListingStatus.Draft or ListingStatus.NeedsChanges or ListingStatus.Rejected))
            return Conflict("This listing is not eligible for submission.");
        if (!listing.HasRequiredDetails())
            return Bad("Complete the required property details before submitting.");
        if (await IsDuplicate(db, listing, ct))
            return Conflict("This seller already has a submission for the same parcel.");

        var previous = listing.Status;
        listing.Submit();
        RecordModeration(db, listing, actor, previous, "ListingSubmitted");
        await Save(db, transaction, ct);
        return Results.Ok(ToOwner(listing, await OwnerMedia(db, id, ct), true));
    }

    private static async Task<IResult> SaleStatus(Guid id, PropertySaleStatusRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        await using var transaction = await LockUsers(db, ct, actor);
        var (listing, error) = await OwnedMutation(db, id, actor, request.Version, ct);
        if (listing is null)
            return error!;
        if (!Enum.IsDefined(request.SaleStatus))
            return Bad("Invalid sale status.");
        if (listing.SaleStatus != request.SaleStatus &&
            (!listing.CanEdit || request.SaleStatus != ListingSaleStatus.Withdrawn && listing.Status != ListingStatus.Active))
            return Conflict("This listing cannot enter the requested sale status.");

        var before = listing.SaleStatus;
        listing.ChangeSaleStatus(request.SaleStatus);
        if (before != listing.SaleStatus)
            AddAudit(db, listing.Id, actor, "ListingSaleStatusChanged", $"{before} to {listing.SaleStatus}");
        await Save(db, transaction, ct);
        return Results.Ok(ToOwner(listing, await OwnerMedia(db, id, ct), true));
    }

    private static async Task<(MarketplaceListing? Listing, IResult? Error)> OwnedMutation(LandPriceDbContext db,
        Guid id, Guid actor, int? version, CancellationToken ct)
    {
        if (await ApprovedSeller(db, actor, ct) is null)
            return (null, Results.Forbid());

        var listing = await db.MarketplaceListings.Include(l => l.Seller)
            .SingleOrDefaultAsync(l => l.Id == id && l.SellerId == actor, ct);
        if (listing is null)
            return (null, Results.NotFound());
        return version == listing.Version ? (listing, null) :
            (null, Conflict("The listing has changed. Reload and retry with its current version."));
    }

    private static Task<bool> IsDuplicate(LandPriceDbContext db, MarketplaceListing listing, CancellationToken ct) =>
        db.MarketplaceListings.AnyAsync(l => l.Id != listing.Id && l.SellerId == listing.SellerId &&
            l.ParcelFingerprint != null && l.ParcelFingerprint == listing.ParcelFingerprint &&
            (l.Status == ListingStatus.PendingReview || l.Status == ListingStatus.Active) &&
            (l.SaleStatus == ListingSaleStatus.Available || l.SaleStatus == ListingSaleStatus.UnderNegotiation), ct);

    private static void RecordPrice(LandPriceDbContext db, MarketplaceListing listing, Guid actor, decimal previous)
    {
        if (previous != listing.AskingPriceTotal)
            db.ListingPriceChanges.Add(new ListingPriceChange(Guid.NewGuid(), listing.Id, actor,
                previous == 0 ? null : previous, listing.AskingPriceTotal == 0 ? null : listing.AskingPriceTotal, DateTime.UtcNow));
    }

    private static void RecordModeration(LandPriceDbContext db, MarketplaceListing listing, Guid actor,
        ListingStatus previous, string action, string? reason = null, string? notes = null)
    {
        db.ListingModerationChanges.Add(new ListingModerationChange(Guid.NewGuid(), listing.Id, actor,
            previous, listing.Status, listing.Version, reason, notes, DateTime.UtcNow));
        AddAudit(db, listing.Id, actor, action, $"{previous} to {listing.Status}");
    }

    private static void AddAudit(LandPriceDbContext db, Guid listingId, Guid actor, string action, string details) =>
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), nameof(MarketplaceListing), listingId, action, actor.ToString(), details));

    private static async Task Save(LandPriceDbContext db, IDbContextTransaction? transaction, CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);
        if (transaction is not null)
            await transaction.CommitAsync(ct);
    }

    private static bool ValidPage(int? page, int? size) => page is null or >= 1 and <= 10000 && size is null or >= 1 and <= 100;

    private static async Task<PropertyPage<T>> Page<T>(IQueryable<T> query, int? page, int? pageSize, CancellationToken ct)
    {
        var number = page ?? 1;
        var size = pageSize ?? 25;
        var rows = await query.Skip((number - 1) * size).Take(size + 1).ToListAsync(ct);
        return new PropertyPage<T>(rows.Take(size).ToArray(), number, size, rows.Count > size);
    }

    private static PropertyPage<TResult> ProjectPage<T, TResult>(PropertyPage<T> page, Func<T, TResult> map) =>
        new(page.Items.Select(map).ToArray(), page.Page, page.PageSize, page.HasMore);

    private static IResult Bad(string message) => Results.BadRequest(new { error = message });
    private static IResult Conflict(string message) => Results.Conflict(new { error = message });

    public record struct PropertySearch(string? Search, string? District, string? Locality, LandUsageType? LandUsage,
        decimal? MinPrice, decimal? MaxPrice, decimal? MinAreaCent, decimal? MaxAreaCent, PropertySort? Sort, int? Page, int? PageSize);
    public enum PropertySort { Newest, PriceAscending, PriceDescending, AreaAscending, AreaDescending }
    private sealed record MapSearch(Point Centre, double RadiusMeters);
}
