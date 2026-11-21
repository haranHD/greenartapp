using System.Security.Claims;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static Greenart.Api.Marketplace.MarketplaceAccess;

namespace Greenart.Api.Marketplace;

internal static class SellerEndpoints
{
    public static void MapSellers(this WebApplication app)
    {
        var sellers = app.MapGroup("/api/v1/sellers").RequireAuthorization().WithTags("Sellers");
        sellers.MapGet("/me", GetMine);
        sellers.MapPost("/apply", Apply).RequireRateLimiting("SellerApplicationRateLimit");
        sellers.MapPatch("/me/application", Correct).RequireRateLimiting("SellerApplicationRateLimit");

        var admin = app.MapGroup("/api/v1/admin/sellers")
            .RequireAuthorization("AdministratorPolicy").WithTags("Administration");
        admin.MapGet("/applications", Queue);
        admin.MapGet("/applications/{id:guid}", GetApplication);
        admin.MapPatch("/applications/{id:guid}", Review);
        admin.MapPatch("/{id:guid}/suspend", Suspend);
    }

    private static async Task<IResult> GetMine(ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var userId = UserId(principal);
        if (await ActiveUser(db, userId, ct) is null)
            return Results.Forbid();

        var row = await (from profile in db.SellerProfiles.AsNoTracking()
                         join application in db.SellerApplications.AsNoTracking()
                             on profile.CurrentApplicationId equals application.Id
                         where profile.UserId == userId
                         select new { profile, application }).SingleOrDefaultAsync(ct);
        return Results.Ok(ToStatus(row?.profile, row?.application));
    }

    private static async Task<IResult> Apply(SellerApplicationRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var userId = UserId(principal);
        await using var transaction = await LockUsers(db, ct, userId);
        if (await ActiveUser(db, userId, ct) is null)
            return Results.Forbid();

        var profile = await db.SellerProfiles.FindAsync([userId], ct);
        if (profile is not null && profile.Status != SellerStatus.Rejected)
            return Conflict("Your current seller status does not allow a new application.");

        if (Validate(request) is not { } details)
            return InvalidApplication();

        var now = DateTime.UtcNow;
        var previous = profile?.Status ?? SellerStatus.NotApplied;
        var application = new SellerApplication(userId, details, now);
        db.SellerApplications.Add(application);
        if (profile is null)
        {
            profile = new SellerProfile(application, now);
            db.SellerProfiles.Add(profile);
        }
        else
        {
            profile.TrackApplication(application, now);
        }

        AddAudit(db, application.Id, userId, "SellerApplicationSubmitted",
            previous, application.Status);
        if (!await Save(db, ct))
            return Conflict("Seller status has changed. Reload and try again.");
        if (transaction is not null)
            await transaction.CommitAsync(ct);

        return Results.Created("/api/v1/sellers/me", ToStatus(profile, application));
    }

    private static async Task<IResult> Correct(SellerApplicationRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var userId = UserId(principal);
        await using var transaction = await LockUsers(db, ct, userId);
        if (await ActiveUser(db, userId, ct) is null)
            return Results.Forbid();

        var profile = await db.SellerProfiles.FindAsync([userId], ct);
        if (profile?.Status != SellerStatus.NeedsInformation)
            return Conflict("This application is not awaiting corrections.");

        var application = await db.SellerApplications.FindAsync([profile.CurrentApplicationId], ct);
        if (application?.Status != SellerStatus.NeedsInformation || request.Version != application.Version)
            return Conflict("The application has changed. Reload before resubmitting.");
        if (Validate(request) is not { } details)
            return InvalidApplication();

        var now = DateTime.UtcNow;
        application.Resubmit(details, now);
        profile.TrackApplication(application, now);
        AddAudit(db, application.Id, userId, "SellerApplicationCorrected", SellerStatus.NeedsInformation, application.Status);
        if (!await Save(db, ct))
            return Conflict("The application has changed. Reload before resubmitting.");
        if (transaction is not null)
            await transaction.CommitAsync(ct);

        return Results.Ok(ToStatus(profile, application));
    }

    private static async Task<IResult> Queue(SellerStatus? status, int? page, int? pageSize,
        ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        if (!await IsActiveAdministrator(db, UserId(principal), ct))
            return Results.Forbid();
        if (page is < 1 or > 10000 || pageSize is < 1 or > 100 || (status.HasValue && !Enum.IsDefined(status.Value)))
            return Results.BadRequest(new { error = "Invalid status or pagination." });

        var size = pageSize ?? 25;
        var number = page ?? 1;
        var query = from profile in db.SellerProfiles.AsNoTracking()
                    join application in db.SellerApplications.AsNoTracking() on profile.CurrentApplicationId equals application.Id
                    where !status.HasValue || profile.Status == status.Value
                    orderby application.SubmittedAtUtc descending, application.Id
                    select new { profile, application };

        var rows = await query.Skip((number - 1) * size).Take(size + 1).ToListAsync(ct);
        return Results.Ok(new
        {
            page = number,
            pageSize = size,
            hasMore = rows.Count > size,
            items = rows.Take(size).Select(row => new
            {
                row.application.Id,
                row.application.UserId,
                row.application.Details.ApplicantName,
                row.application.Details.SellerType,
                row.application.SubmittedAtUtc,
                row.profile.Status,
                row.application.Version
            })
        });
    }

    private static async Task<IResult> GetApplication(Guid id, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        if (!await IsActiveAdministrator(db, UserId(principal), ct))
            return Results.Forbid();

        var application = await db.SellerApplications.FindAsync([id], ct);
        if (application is null)
            return Results.NotFound();

        var profile = await db.SellerProfiles.FindAsync([application.UserId], ct);
        var history = await db.AuditEvents.AsNoTracking()
            .Where(e => e.EntityType == nameof(SellerApplication) && e.EntityId == id)
            .OrderBy(e => e.TimestampUtc).ThenBy(e => e.Id)
            .Select(e => new { e.Action, e.PerformedBy, e.TimestampUtc, e.Details })
            .ToListAsync(ct);
        return Results.Ok(new
        {
            application = ToApplication(application),
            sellerStatus = profile?.Status,
            application.ReviewedByUserId,
            application.ReviewNotes,
            profile?.SuspensionReason,
            history
        });
    }

    private static async Task<IResult> Review(Guid id, ReviewSellerApplicationRequest request,
        ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var adminId = UserId(principal);
        if (!await IsActiveAdministrator(db, adminId, ct))
            return Results.Forbid();

        var ownerId = await db.SellerApplications.Where(a => a.Id == id).Select(a => (Guid?)a.UserId)
            .SingleOrDefaultAsync(ct);
        if (ownerId is null)
            return Results.NotFound();
        if (ownerId == adminId)
            return Results.Forbid();

        await using var transaction = await LockUsers(db, ct, adminId, ownerId.Value);
        if (!await IsActiveAdministrator(db, adminId, ct))
            return Results.Forbid();

        var application = await db.SellerApplications.FindAsync([id], ct);
        var profile = await db.SellerProfiles.FindAsync([ownerId.Value], ct);
        if (application?.Status != SellerStatus.PendingReview || profile?.Status != SellerStatus.PendingReview ||
            profile.CurrentApplicationId != id || request.Version != application.Version)
            return Conflict("The application is no longer pending at this version.");

        var feedback = Clean(request.ApplicantFeedback);
        var notes = Clean(request.ReviewNotes);
        if (request.Decision is not (SellerStatus.Approved or SellerStatus.Rejected or SellerStatus.NeedsInformation) ||
            feedback?.Length > 1000 || notes?.Length > 2000 ||
            (feedback is null && request.Decision != SellerStatus.Approved))
            return Results.BadRequest(new { error = "Provide a valid decision and feedback for rejection or corrections." });

        var seller = await ActiveUser(db, ownerId.Value, ct);
        if (seller is null && request.Decision == SellerStatus.Approved)
            return Conflict("Only an active account can be approved.");

        var now = DateTime.UtcNow;
        application.Review(adminId, request.Decision, feedback, notes, now);
        profile.TrackApplication(application, now);
        if (seller is not null)
        {
            seller.SetSellerVerification(request.Decision == SellerStatus.Approved);
            if (request.Decision == SellerStatus.Approved)
                seller.SetSellerType(application.Details.SellerType);
        }

        AddAudit(db, id, adminId, "SellerApplicationReviewed", SellerStatus.PendingReview, application.Status, feedback);
        if (!await Save(db, ct))
            return Conflict("The application has changed. Reload before reviewing.");
        if (transaction is not null)
            await transaction.CommitAsync(ct);

        return Results.Ok(ToStatus(profile, application));
    }

    private static async Task<IResult> Suspend(Guid id, SuspendSellerRequest request,
        ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var adminId = UserId(principal);
        if (adminId == id || !await IsActiveAdministrator(db, adminId, ct))
            return Results.Forbid();

        await using var transaction = await LockUsers(db, ct, adminId, id);
        if (!await IsActiveAdministrator(db, adminId, ct))
            return Results.Forbid();

        var reason = Clean(request.Reason);
        if (reason is null || reason.Length > 1000)
            return Results.BadRequest(new { error = "A suspension reason of up to 1000 characters is required." });

        var profile = await db.SellerProfiles.FindAsync([id], ct);
        if (profile is null)
            return Results.NotFound();
        if (profile.Status != SellerStatus.Approved)
            return Conflict("Only an approved seller can be suspended.");

        var seller = await db.Users.FindAsync([id], ct);
        var application = await db.SellerApplications.FindAsync([profile.CurrentApplicationId], ct);
        profile.Suspend(reason, DateTime.UtcNow);
        seller!.SetSellerVerification(false);
        AddAudit(db, profile.CurrentApplicationId, adminId, "SellerSuspended", SellerStatus.Approved, profile.Status, reason);
        if (!await Save(db, ct))
            return Conflict("Seller status has changed. Reload and try again.");
        if (transaction is not null)
            await transaction.CommitAsync(ct);

        return Results.Ok(ToStatus(profile, application));
    }

    private static SellerApplicationDetails? Validate(SellerApplicationRequest request)
    {
        var name = Clean(request.ApplicantName);
        var contact = Clean(request.ContactInformation);
        var district = Clean(request.OperatingDistrict);
        var locality = Clean(request.OperatingLocality);
        var business = Clean(request.BusinessDetails);
        var authorisation = Clean(request.AuthorisationInformation);
        if (name is null || name.Length > 150 || contact is null || contact.Length > 250 ||
            district is null || district.Length > 100 || locality?.Length > 150 || business?.Length > 1000 ||
            authorisation?.Length > 2000 || !request.DeclaresAccuracy ||
            request.SellerType is not (SellerType.IndividualOwner or SellerType.LicensedAgent) ||
            (request.SellerType == SellerType.LicensedAgent && authorisation is null))
            return null;

        return new(name, request.SellerType, contact, district, locality, business, authorisation, request.DeclaresAccuracy);
    }

    private static string? Clean(string? input) => string.IsNullOrWhiteSpace(input) ? null : input.Trim();

    private static IResult InvalidApplication() => Results.BadRequest(new
    {
        error = "Provide a name, contact information, district, seller type and declaration. Agents must provide authorisation information."
    });

    private static IResult Conflict(string error) => Results.Conflict(new { error });

    private static SellerApplicationDto ToApplication(SellerApplication application) => new(
        application.Id, application.UserId, application.Details, application.Status, application.ApplicantFeedback,
        application.CreatedAtUtc, application.SubmittedAtUtc, application.UpdatedAtUtc, application.ReviewedAtUtc, application.Version);

    private static SellerStatusDto ToStatus(SellerProfile? profile, SellerApplication? application) => new(
        profile?.Status ?? SellerStatus.NotApplied, application is null ? null : ToApplication(application),
        profile?.ApprovedAtUtc, profile?.SuspendedAtUtc, profile?.SuspensionReason);

    private static void AddAudit(LandPriceDbContext db, Guid id, Guid actor, string action,
        SellerStatus previous, SellerStatus current, string? feedback = null) =>
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), nameof(SellerApplication), id, action, actor.ToString(),
            System.Text.Json.JsonSerializer.Serialize(new { previous = previous.ToString(), current = current.ToString(), feedback })));

    private static async Task<bool> Save(LandPriceDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }
}
