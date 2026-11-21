using System.Security.Claims;
using System.Text.Json;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static Greenart.Api.Marketplace.MarketplaceAccess;

namespace Greenart.Api.Marketplace;

internal static partial class PropertyEndpoints
{
    private static async Task<IResult> AdminListings(ClaimsPrincipal principal, LandPriceDbContext db,
        string? status, ListingSaleStatus? saleStatus, int? page, int? pageSize, CancellationToken ct)
    {
        if (!await IsActiveAdministrator(db, UserId(principal), ct))
            return Results.Forbid();
        var filter = string.Equals(status, "Published", StringComparison.OrdinalIgnoreCase) ? ListingStatus.Active :
            Enum.TryParse<ListingStatus>(status, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed) ? parsed : (ListingStatus?)null;
        if (!ValidPage(page, pageSize) || status is not null && !filter.HasValue ||
            saleStatus.HasValue && !Enum.IsDefined(saleStatus.Value))
            return Bad("Invalid status or pagination.");

        var query = db.MarketplaceListings.AsNoTracking().Include(l => l.Seller).AsQueryable();
        if (filter.HasValue)
            query = query.Where(l => l.Status == filter || filter == ListingStatus.Active && l.Status == ListingStatus.Sold);
        if (saleStatus.HasValue)
            query = query.Where(l => l.SaleStatus == saleStatus);
        var rows = await Page(query.OrderByDescending(l => l.UpdatedAtUtc).ThenBy(l => l.Id), page, pageSize, ct);
        var sellerIds = rows.Items.Select(l => l.SellerId).Distinct().ToArray();
        var approved = await db.SellerProfiles.Where(p => sellerIds.Contains(p.UserId) && p.Status == SellerStatus.Approved &&
            db.Users.Any(u => u.Id == p.UserId && u.AccountStatus == AccountStatus.Active))
            .Select(p => p.UserId).ToListAsync(ct);
        var approvedIds = approved.ToHashSet();
        return Results.Ok(ProjectPage(rows, l => ToOwner(l, [], approvedIds.Contains(l.SellerId))));
    }

    private static IQueryable<MarketplaceListing> ReviewQueue(LandPriceDbContext db) =>
        db.MarketplaceListings.AsNoTracking().Include(l => l.Seller)
            .Where(l => (l.Status == ListingStatus.PendingReview || l.Status == ListingStatus.Active) &&
                (l.SaleStatus == ListingSaleStatus.Available || l.SaleStatus == ListingSaleStatus.UnderNegotiation) &&
                l.Seller!.AccountStatus == AccountStatus.Active &&
                db.SellerProfiles.Any(p => p.UserId == l.SellerId && p.Status == SellerStatus.Approved &&
                    (l.Status == ListingStatus.PendingReview || p.CurrentApplicationId != l.ReviewedSellerApplicationId)));

    private static async Task<IResult> PendingListings(ClaimsPrincipal principal, LandPriceDbContext db,
        int? page, int? pageSize, CancellationToken ct)
    {
        if (!await IsActiveAdministrator(db, UserId(principal), ct))
            return Results.Forbid();
        if (!ValidPage(page, pageSize))
            return Bad("Invalid pagination.");

        var queue = await Page(ReviewQueue(db).OrderBy(l => l.UpdatedAtUtc).ThenBy(l => l.Id), page, pageSize, ct);
        return Results.Ok(ProjectPage(queue, l => ToOwner(l, [], approved: true)));
    }

    private static async Task<IResult> LegacyPending(
        HttpContext httpContext,
        IConfiguration config,
        LandPriceDbContext db,
        CancellationToken ct)
    {
        var adminKey = httpContext.Request.Headers["X-Admin-Key"].FirstOrDefault();
        var isAuthorized = IsAuthorizedAdminKey(adminKey, config) ||
            httpContext.User?.IsInRole(UserRole.Administrator.ToString()) == true ||
            (httpContext.User is { } u && await IsActiveAdministrator(db, UserId(u), ct));

        if (!isAuthorized)
            return Results.Unauthorized();

        var queue = await db.MarketplaceListings.AsNoTracking().Include(l => l.Seller)
            .Where(l => l.Status == ListingStatus.PendingReview &&
                (l.SaleStatus == ListingSaleStatus.Available || l.SaleStatus == ListingSaleStatus.UnderNegotiation) &&
                (l.Seller == null || l.Seller.AccountStatus == AccountStatus.Active))
            .OrderByDescending(l => l.CreatedAtUtc).ThenBy(l => l.Id).ToListAsync(ct);
        return Results.Ok(queue.Select(l => ToLegacy(l) with { Status = ListingStatus.PendingReview }));
    }

    private static async Task<IResult> AdminDetail(Guid id, ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        if (!await IsActiveAdministrator(db, UserId(principal), ct))
            return Results.Forbid();
        var listing = await db.MarketplaceListings.AsNoTracking().Include(l => l.Seller).SingleOrDefaultAsync(l => l.Id == id, ct);
        if (listing is null)
            return Results.NotFound();

        var approval = await ApprovedSeller(db, listing.SellerId, ct);
        var prices = await db.ListingPriceChanges.AsNoTracking().Where(h => h.ListingId == id)
            .OrderByDescending(h => h.ChangedAtUtc).ThenBy(h => h.Id).Take(100).ToListAsync(ct);
        var moderation = await db.ListingModerationChanges.AsNoTracking().Where(h => h.ListingId == id)
            .OrderByDescending(h => h.ListingVersion).Take(100).ToListAsync(ct);
        var audit = await db.AuditEvents.AsNoTracking()
            .Where(h => h.EntityType == nameof(MarketplaceListing) && h.EntityId == id)
            .OrderByDescending(h => h.TimestampUtc).ThenBy(h => h.Id).Take(100)
            .Select(h => new { h.Action, h.PerformedBy, h.TimestampUtc, h.Details }).ToListAsync(ct);
        var duplicates = listing.ParcelFingerprint is null ? [] :
            await db.MarketplaceListings.AsNoTracking().Where(l => l.Id != id && l.ParcelFingerprint == listing.ParcelFingerprint)
                .OrderBy(l => l.Id).Select(l => l.Id).Take(25).ToArrayAsync(ct);

        return Results.Ok(new
        {
            property = ToOwner(listing, await OwnerMedia(db, id, ct), approval is not null),
            seller = new
            {
                listing.SellerId,
                fullName = listing.Seller?.FullName,
                email = listing.Seller?.Email,
                phoneNumber = listing.Seller?.PhoneNumber
            },
            listing.ModerationNotes,
            listing.ReviewedByUserId,
            listing.OriginalAskingPrice,
            priceCategory = SourceCategory.AdvertisedAskingPrice,
            priceHistory = prices,
            moderationHistory = moderation.Select(h => new
            {
                h.Id, h.ListingId, h.ActorUserId, previousStatus = ModerationLabel(h.PreviousStatus),
                newStatus = ModerationLabel(h.NewStatus), h.ListingVersion, h.Reason, h.Notes, h.CreatedAtUtc
            }),
            audit,
            possibleDuplicates = duplicates
        });
    }

    private static Task<IResult> Moderate(Guid id, ReviewListingRequestDto request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct) => Review(id, request, UserId(principal), db, legacy: false, ct);

    private static async Task<IResult> LegacyReview(
        Guid id,
        ReviewListingRequestDto request,
        HttpContext httpContext,
        IConfiguration config,
        LandPriceDbContext db,
        CancellationToken ct)
    {
        var adminKey = httpContext.Request.Headers["X-Admin-Key"].FirstOrDefault();
        var reviewer = UserId(httpContext.User);
        var isAuthorized = IsAuthorizedAdminKey(adminKey, config) ||
            httpContext.User?.IsInRole(UserRole.Administrator.ToString()) == true ||
            await IsActiveAdministrator(db, reviewer, ct);

        if (!isAuthorized)
            return Results.Unauthorized();

        if (reviewer == Guid.Empty)
        {
            reviewer = await db.Users.Where(u => u.Role == UserRole.Administrator && u.AccountStatus == AccountStatus.Active)
                .Select(u => u.Id).FirstOrDefaultAsync(ct);
            if (reviewer == Guid.Empty)
            {
                reviewer = Guid.Parse("00000000-0000-0000-0000-000000000001");
            }
        }

        return await Review(id, request, reviewer, db, legacy: true, ct);
    }

    private static async Task<IResult> Review(Guid id, ReviewListingRequestDto request, Guid reviewer,
        LandPriceDbContext db, bool legacy, CancellationToken ct)
    {
        if (!legacy && !await IsActiveAdministrator(db, reviewer, ct))
            return Results.Forbid();

        var sellerId = await db.MarketplaceListings.Where(l => l.Id == id).Select(l => (Guid?)l.SellerId).SingleOrDefaultAsync(ct);
        if (sellerId is null)
            return Results.NotFound();
        if (sellerId == reviewer)
            return Results.Forbid();

        await using var transaction = await LockUsers(db, ct, reviewer, sellerId.Value);
        if (!legacy && !await IsActiveAdministrator(db, reviewer, ct))
            return Results.Forbid();

        var listing = await db.MarketplaceListings.Include(l => l.Seller).SingleAsync(l => l.Id == id, ct);
        if (request.Version != listing.Version &&
            !(legacy && request.Version is null && listing.Version <= 2))
            return Conflict("The listing has changed. Reload and review its current version.");

        var action = request.Action?.Trim().ToUpperInvariant();
        var reason = PropertyValidation.Clean(request.Reason);
        var notes = PropertyValidation.Clean(request.Notes);
        if (notes?.Length > 2000 || reason?.Length > 1000)
            return Bad("Moderation notes or reason exceed the permitted length.");
        if (action is not ("APPROVE" or "REJECT" or "REQUESTCHANGES" or "SUSPEND" or "ARCHIVE"))
            return Bad("Choose Approve, Reject, RequestChanges, Suspend or Archive.");
        if (reason is null && action != "APPROVE" && !(legacy && action == "REJECT"))
            return Bad("Provide a moderation reason.");

        var seller = await ApprovedSeller(db, sellerId.Value, ct);
        var previous = listing.Status;
        var legacyReview = previous == ListingStatus.Active && seller is not null &&
            listing.ReviewedSellerApplicationId != seller.CurrentApplicationId;
        var awaitingReview = (previous == ListingStatus.PendingReview || legacyReview) && listing.CanEdit;
        if (action is "APPROVE" or "REJECT" && !awaitingReview)
            return Conflict("The listing is not awaiting review.");
        if (action == "REQUESTCHANGES" && !awaitingReview && previous != ListingStatus.Suspended)
            return Conflict("Only listings awaiting review or suspended listings may be sent back for changes.");
        if (action == "SUSPEND" && previous is not (ListingStatus.Active or ListingStatus.PendingReview))
            return Conflict("Only published or pending listings may be suspended.");
        if (action == "ARCHIVE" && previous == ListingStatus.Archived)
            return Conflict("The listing is already archived.");

        if (action == "APPROVE")
        {
            if (seller is null)
            {
                if (legacy)
                {
                    var ownerUser = await ActiveUser(db, sellerId.Value, ct);
                    if (ownerUser is not null)
                    {
                        var now = DateTime.UtcNow;
                        var details = new SellerApplicationDetails(
                            ApplicantName: string.IsNullOrWhiteSpace(ownerUser.FullName) ? "Property Owner" : ownerUser.FullName,
                            SellerType: ownerUser.SellerType,
                            ContactInformation: string.IsNullOrWhiteSpace(ownerUser.PhoneNumber) ? (ownerUser.Email ?? "Mobile User") : ownerUser.PhoneNumber,
                            OperatingDistrict: listing.District,
                            OperatingLocality: listing.Locality,
                            BusinessDetails: "Mobile App Land Seller",
                            AuthorisationInformation: "Direct Owner Registration",
                            DeclaresAccuracy: true);

                        var app = new SellerApplication(sellerId.Value, details, now);
                        app.AutoApproveForDirectListing(now);
                        db.SellerApplications.Add(app);

                        seller = await db.SellerProfiles.FindAsync([sellerId.Value], ct);
                        if (seller is null)
                        {
                            seller = new SellerProfile(app, now);
                            db.SellerProfiles.Add(seller);
                        }
                        else
                        {
                            seller.TrackApplication(app, now);
                        }

                        ownerUser.SetSellerVerification(true);
                        ownerUser.SetSellerType(details.SellerType);
                    }
                }
                if (seller is null)
                    return Conflict("The listing owner must be an active approved seller.");
            }
            if (!listing.HasRequiredDetails(requireLocation: false) || await IsDuplicate(db, listing, ct))
                return Conflict("The listing is incomplete or duplicates another submission by this seller.");
        }

        if (legacyReview)
        {
            AddAudit(db, id, reviewer, "LegacyListingReviewPreserved", JsonSerializer.Serialize(new
            {
                listing.ReviewedByUserId, listing.ModerationNotes, listing.RejectionReason, listing.UpdatedAtUtc
            }));
        }

        string auditAction;
        switch (action)
        {
            case "APPROVE":
                listing.Approve(reviewer, notes, seller!.CurrentApplicationId);
                auditAction = "ListingApproved";
                break;
            case "REJECT":
                reason ??= "Listing did not satisfy moderation guidelines.";
                listing.Reject(reviewer, reason, notes);
                auditAction = "ListingRejected";
                break;
            case "REQUESTCHANGES":
                listing.RequestChanges(reviewer, reason!, notes);
                auditAction = "ListingChangesRequested";
                break;
            case "SUSPEND":
                listing.Suspend(reviewer, reason!, notes);
                auditAction = "ListingSuspended";
                break;
            default:
                listing.Archive();
                auditAction = "ListingArchived";
                break;
        }

        RecordModeration(db, listing, reviewer, previous, auditAction, reason, notes);
        await Save(db, transaction, ct);
        return Results.Ok(legacy ? ToLegacy(listing) : ToOwner(listing, await OwnerMedia(db, id, ct), seller is not null));
    }
}
