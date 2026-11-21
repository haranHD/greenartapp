using System.Security.Claims;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static Greenart.Api.Marketplace.MarketplaceAccess;

namespace Greenart.Api.Marketplace;

internal static partial class PropertyEndpoints
{
    private static async Task<IResult> CreateEnquiry(Guid id, SubmitEnquiryRequestDto request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        var message = PropertyValidation.Clean(request.Message);
        if (message is null || message.Length > 2000 ||
            request.OfferedPriceTotal is { } offer && !PropertyValidation.ValidPrice(offer))
            return Bad("Provide a message of up to 2000 characters and a valid optional offer.");

        var sellerId = await db.MarketplaceListings.Where(l => l.Id == id).Select(l => (Guid?)l.SellerId).SingleOrDefaultAsync(ct);
        if (sellerId is null)
            return Results.NotFound();

        await using var transaction = await LockUsers(db, ct, actor, sellerId.Value);
        var buyer = await ActiveUser(db, actor, ct);
        if (buyer is null)
            return Results.Forbid();
        var listing = await PublicListings(db).SingleOrDefaultAsync(l => l.Id == id, ct);
        if (listing is null)
            return Results.NotFound();
        if (actor == sellerId)
            return Bad("Sellers cannot enquire on their own listings.");

        var now = DateTime.UtcNow;
        var recent = db.ListingEnquiries.Where(e => e.BuyerUserId == actor && e.SubmittedAtUtc >= now.AddDays(-1));
        var normalized = message.ToLowerInvariant();
        if (await recent.AnyAsync(e => e.ListingId == id && e.Message.ToLower() == normalized, ct))
            return Conflict("You have already sent this enquiry.");
        if (await recent.CountAsync(e => e.SubmittedAtUtc >= now.AddHours(-1), ct) >= 5 ||
            await recent.AnyAsync(e => e.ListingId == id && e.SubmittedAtUtc >= now.AddMinutes(-5), ct))
            return Results.StatusCode(StatusCodes.Status429TooManyRequests);

        var enquiry = new ListingEnquiry(Guid.NewGuid(), id, actor, message,
            request.OfferedPriceTotal is { } offered ? Math.Round(offered, 2) : null,
            submittedAtUtc: now, shareContact: request.ShareContact);
        db.ListingEnquiries.Add(enquiry);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), nameof(ListingEnquiry), enquiry.Id, "EnquiryCreated",
            actor.ToString(), $"Enquiry submitted for listing {id}."));
        await Save(db, transaction, ct);
        return Results.Created("/api/v1/marketplace/enquiries/my", ToEnquiry(enquiry, buyerView: true));
    }

    private static async Task<IResult> LegacyBuyerEnquiries(ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();
        var rows = await EnquiryQuery(db).Where(e => e.BuyerUserId == actor)
            .OrderByDescending(e => e.SubmittedAtUtc).ThenBy(e => e.Id).ToListAsync(ct);
        return Results.Ok(rows.Select(e => ToEnquiry(e, buyerView: true)));
    }

    private static async Task<IResult> SellerEnquiries(ClaimsPrincipal principal, LandPriceDbContext db,
        int? page, int? pageSize, CancellationToken ct)
    {
        var actor = UserId(principal);
        if (await ApprovedSeller(db, actor, ct) is null)
            return Results.Forbid();
        if (!ValidPage(page, pageSize))
            return Bad("Invalid pagination.");
        var rows = await Page(EnquiryQuery(db).Where(e => e.Listing!.SellerId == actor)
            .OrderByDescending(e => e.SubmittedAtUtc).ThenBy(e => e.Id), page, pageSize, ct);
        return Results.Ok(ProjectPage(rows, e => ToEnquiry(e, buyerView: false)));
    }

    private static async Task<IResult> UpdateEnquiry(Guid id, PropertyEnquiryStatusRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        await using var transaction = await LockUsers(db, ct, actor);
        if (await ApprovedSeller(db, actor, ct) is null)
            return Results.Forbid();
        var enquiry = await db.ListingEnquiries.Include(e => e.Listing).Include(e => e.BuyerUser)
            .SingleOrDefaultAsync(e => e.Id == id && e.Listing!.SellerId == actor, ct);
        if (enquiry is null)
            return Results.NotFound();
        if (request.Status == enquiry.Status)
            return Results.Ok(ToEnquiry(enquiry, buyerView: false));
        if (enquiry.Status is EnquiryStatus.Closed or EnquiryStatus.Spam ||
            request.Status is not (EnquiryStatus.Contacted or EnquiryStatus.Closed))
            return Conflict("This enquiry cannot enter the requested status.");

        if (request.Status == EnquiryStatus.Contacted)
            enquiry.MarkContacted();
        else
            enquiry.Close();

        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), nameof(ListingEnquiry), enquiry.Id, "EnquiryStatusChanged",
            actor.ToString(), enquiry.Status.ToString()));
        await Save(db, transaction, ct);
        return Results.Ok(ToEnquiry(enquiry, buyerView: false));
    }

    private static async Task<IResult> AdminEnquiries(ClaimsPrincipal principal, LandPriceDbContext db,
        Guid? listingId, int? page, int? pageSize, CancellationToken ct)
    {
        if (!await IsActiveAdministrator(db, UserId(principal), ct))
            return Results.Forbid();
        if (!ValidPage(page, pageSize))
            return Bad("Invalid pagination.");

        var query = EnquiryQuery(db);
        if (listingId.HasValue)
            query = query.Where(e => e.ListingId == listingId);
        var rows = await Page(query.OrderByDescending(e => e.SubmittedAtUtc).ThenBy(e => e.Id), page, pageSize, ct);
        return Results.Ok(ProjectPage(rows, e => ToEnquiry(e, buyerView: false)));
    }

    private static IQueryable<ListingEnquiry> EnquiryQuery(LandPriceDbContext db) =>
        db.ListingEnquiries.AsNoTracking().Include(e => e.Listing).Include(e => e.BuyerUser);

    private static ListingEnquiryDto ToEnquiry(ListingEnquiry enquiry, bool buyerView)
    {
        var discloseContact = buyerView || enquiry.ShareContact;
        return new ListingEnquiryDto(enquiry.Id, enquiry.ListingId, enquiry.Listing?.Title ?? "Land Plot",
            enquiry.BuyerUserId, enquiry.BuyerUser?.FullName ?? "Prospective Buyer",
            discloseContact ? enquiry.BuyerUser?.Email ?? string.Empty : string.Empty,
            discloseContact ? enquiry.BuyerUser?.PhoneNumber : null, enquiry.OfferedPriceTotal,
            enquiry.Message, enquiry.Status, enquiry.SubmittedAtUtc, enquiry.UpdatedAtUtc);
    }

    private static async Task<IResult> AddFavourite(Guid id, ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        var seller = await db.MarketplaceListings.Where(l => l.Id == id).Select(l => (Guid?)l.SellerId).SingleOrDefaultAsync(ct);
        if (seller is null)
            return Results.NotFound();
        await using var transaction = await LockUsers(db, ct, actor, seller.Value);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();
        if (!await PublicListings(db).AnyAsync(l => l.Id == id, ct))
            return Results.NotFound();
        if (await db.ListingFavourites.FindAsync([actor, id], ct) is null)
        {
            db.ListingFavourites.Add(new ListingFavourite(actor, id, DateTime.UtcNow));
            await Save(db, transaction, ct);
        }
        return Results.NoContent();
    }

    private static async Task<IResult> RemoveFavourite(Guid id, ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        await using var transaction = await LockUsers(db, ct, actor);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();
        var stored = await db.ListingFavourites.FindAsync([actor, id], ct);
        if (stored is not null)
        {
            db.ListingFavourites.Remove(stored);
            await Save(db, transaction, ct);
        }
        return Results.NoContent();
    }

    private static async Task<IResult> Favourites(ClaimsPrincipal principal, LandPriceDbContext db,
        int? page, int? pageSize, CancellationToken ct)
    {
        var actor = UserId(principal);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();
        if (!ValidPage(page, pageSize))
            return Bad("Invalid pagination.");

        var query = from favourite in db.ListingFavourites.AsNoTracking()
                    join listing in PublicListings(db).AsNoTracking() on favourite.ListingId equals listing.Id
                    where favourite.UserId == actor
                    orderby favourite.CreatedAtUtc descending, listing.Id
                    select listing;
        var rows = await Page(query.Include(l => l.Seller), page, pageSize, ct);
        return Results.Ok(await PublicPage(rows, db, ct));
    }

    private static async Task<IResult> Report(Guid id, PropertyReportRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var reason = PropertyValidation.Clean(request.Reason);
        if (reason is null || reason.Length > 1000)
            return Bad("Provide a report reason of up to 1000 characters.");

        var actor = UserId(principal);
        var seller = await db.MarketplaceListings.Where(l => l.Id == id).Select(l => (Guid?)l.SellerId).SingleOrDefaultAsync(ct);
        if (seller is null)
            return Results.NotFound();

        await using var transaction = await LockUsers(db, ct, actor, seller.Value);
        if (await ActiveUser(db, actor, ct) is null)
            return Results.Forbid();
        if (!await PublicListings(db).AnyAsync(l => l.Id == id, ct))
            return Results.NotFound();
        if (actor == seller)
            return Bad("Sellers cannot report their own listings.");
        var reports = db.ListingReports.Where(r => r.ReporterUserId == actor);
        if (await reports.AnyAsync(r => r.ListingId == id, ct))
            return Conflict("You have already reported this listing.");

        var now = DateTime.UtcNow;
        if (await reports.CountAsync(r => r.CreatedAtUtc >= now.AddHours(-1), ct) >= 5)
            return Results.StatusCode(StatusCodes.Status429TooManyRequests);

        var report = new ListingReport(Guid.NewGuid(), id, actor, reason, now);
        db.ListingReports.Add(report);
        AddAudit(db, id, actor, "ListingReported", report.Id.ToString());
        await Save(db, transaction, ct);
        return Results.Json(new { report.Id }, statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> AdminReports(ClaimsPrincipal principal, LandPriceDbContext db,
        Guid? listingId, int? page, int? pageSize, CancellationToken ct)
    {
        if (!await IsActiveAdministrator(db, UserId(principal), ct))
            return Results.Forbid();
        if (!ValidPage(page, pageSize))
            return Bad("Invalid pagination.");
        var query = db.ListingReports.AsNoTracking().AsQueryable();
        if (listingId.HasValue)
            query = query.Where(r => r.ListingId == listingId);
        return Results.Ok(await Page(query.OrderByDescending(r => r.CreatedAtUtc).ThenBy(r => r.Id), page, pageSize, ct));
    }
}
