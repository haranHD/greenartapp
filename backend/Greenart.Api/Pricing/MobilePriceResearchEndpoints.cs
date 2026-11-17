using System.Security.Claims;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Greenart.Api.Pricing;

public static partial class PriceResearchEndpoints
{
    private static readonly SemaphoreSlim MobileResearchGate = new(1, 1);
    private const string MobileStarted = "MobileResearchStarted";

    private static void MapMobileResearch(WebApplication app) =>
        app.MapPost("/api/v1/pricing/research", GenerateMobileResearch)
            .RequireAuthorization("CustomerPolicy").RequireRateLimiting("IntegrationsRateLimit")
            .WithTags("Price research");

    private static int DailyLimit(IConfiguration config, string name, int fallback) =>
        int.TryParse(config[name], out var value) ? Math.Clamp(value, 0, 1000) : fallback;

    private static async Task<IResult> GenerateMobileResearch(MobilePriceResearchRequest input, ClaimsPrincipal user,
        LandPriceDbContext db, IPriceResearchModels models, IConfiguration config, CancellationToken ct)
    {
        if (!Guid.TryParse(Actor(user), out var userId)) return Results.Unauthorized();
        var account = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct);
        // Existing Google accounts may predate the email-verification flag; Google login
        // already validates email_verified and binds this immutable subject server-side.
        var verifiedIdentity = account != null && (account.IsEmailVerified ||
            (!string.IsNullOrWhiteSpace(account.GoogleSubjectId) && !account.GoogleSubjectId.StartsWith("email:", StringComparison.OrdinalIgnoreCase)));
        if (account == null || account.AccountStatus != AccountStatus.Active || !verifiedIdentity)
            return Results.Json(new { error = "Sign in with an active, verified account to generate research." }, statusCode: 403);
        if (input.RequestId == Guid.Empty) return Results.BadRequest(new { error = "A request ID is required." });
        PriceResearch item;
        try {
            item = new PriceResearch(input.Locality ?? "", input.District ?? "", input.Latitude, input.Longitude,
                input.LandUsage, 500, input.RoadAccess ?? "", "Requested from the mobile app. Unverified AI research for admin review.");
        } catch (ArgumentException e) { return Results.BadRequest(new { error = e.Message }); }

        await MobileResearchGate.WaitAsync(ct);
        try {
            // Short transaction locks the cache/quota check and durable start across server instances.
            // Provider calls happen after committing and releasing this lock.
            await using var transaction = db.Database.IsNpgsql() ? await db.Database.BeginTransactionAsync(ct) : null;
            if (transaction != null) await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(74268153)", ct);
            var actor = userId.ToString();
            var requestMarker = $"\"requestId\":\"{input.RequestId}\"";
            var repeated = await db.AuditEvents.AsNoTracking().AnyAsync(x => x.Action == MobileStarted &&
                x.PerformedBy == actor && x.Details.Contains(requestMarker), ct);
            var cached = await FindMarketRange(input.Latitude, input.Longitude, input.LandUsage, input.RoadAccess, db, ct);
            if (cached != null) return Results.Ok(new { range = cached, status = "Saved", cached = true, message = "Showing saved pricing. No new provider call was made." });
            if (repeated) return Results.Ok(new { range = (MarketPriceRangeDto?)null, status = "AlreadyRequested", cached = true,
                message = "This request was already submitted. Refresh pricing or ask the admin to check its saved research; it was not charged again." });

            var now = DateTime.UtcNow;
            var recent = await db.PriceResearch.AsNoTracking().Where(x => x.LandUsage == input.LandUsage &&
                x.Latitude >= input.Latitude - .02 && x.Latitude <= input.Latitude + .02 &&
                x.Longitude >= input.Longitude - .02 && x.Longitude <= input.Longitude + .02 &&
                (x.Status == "Researching" || (x.CreatedAtUtc > now.AddHours(-1) && x.ProposalsJson != "[]" && x.Status == "Draft")))
                .ToListAsync(ct);
            var target = new GeoCoordinate(input.Latitude, input.Longitude);
            var existing = recent.Where(x => string.Equals(x.RoadAccess, input.RoadAccess?.Trim(), StringComparison.OrdinalIgnoreCase) &&
                target.DistanceToMeters(new GeoCoordinate(x.Latitude, x.Longitude)) <= x.CoverageRadiusMeters)
                .OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault();
            if (existing != null) return Results.Ok(new { range = (MarketPriceRangeDto?)null,
                status = existing.Status == "Researching" ? "Researching" : "NoEstimate", cached = true,
                message = existing.Status == "Researching" ? "Research is already running or needs admin recovery. Refresh shortly; no duplicate call was made."
                    : "Recent research returned no usable range. Results are saved for admin review. Try again after one hour." });
            if (!models.GetStatus().Any(x => x.Configured))
                return Results.Json(new { error = "AI research is not available. Ask the admin to check provider configuration." }, statusCode: 503);
            var today = now.Date;
            var starts = db.AuditEvents.Where(x => x.Action == MobileStarted && x.TimestampUtc >= today);
            if (await starts.CountAsync(x => x.PerformedBy == actor, ct) >= DailyLimit(config, "PRICE_RESEARCH_DAILY_USER_LIMIT", 3) ||
                await starts.CountAsync(ct) >= DailyLimit(config, "PRICE_RESEARCH_DAILY_GLOBAL_LIMIT", 30))
                return Results.Json(new { error = "The daily AI research allowance has been reached. Saved prices remain available. Try tomorrow." }, statusCode: 429);
            item.StartResearch(); db.PriceResearch.Add(item);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), "PriceResearch", item.Id, MobileStarted, actor,
                JsonSerializer.Serialize(new { requestId = input.RequestId, item.Version })));
            await db.SaveChangesAsync(ct);
            if (transaction != null) await transaction.CommitAsync(ct);
        } finally { MobileResearchGate.Release(); }

        // Once started, save the outcome even if the phone navigates away or loses its connection.
        // Each adapter retains its existing 35-second budget and performs no automatic retries.
        try {
            item.FinishResearch(JsonSerializer.Serialize(await models.ResearchAsync(item, CancellationToken.None)));
        } catch (Exception) {
            item.FinishResearch(JsonSerializer.Serialize(new[] { new ModelPriceProposal("All", "", "Interrupted", null, null,
                "Research was interrupted. Provider usage may have occurred; check before retrying.", [], DateTime.UtcNow) }));
        }
        Audit(db, item, "MobileResearchCompleted", user);
        await db.SaveChangesAsync(CancellationToken.None);
        var range = await FindMarketRange(input.Latitude, input.Longitude, input.LandUsage, input.RoadAccess, db, CancellationToken.None);
        return Results.Ok(new { range, researchId = item.Id, status = range == null ? "NoEstimate" : "Saved", cached = false,
            message = range == null ? "No usable AI range was returned. Results are saved for admin review."
                : "AI suggestion saved for admin review. It is not yet verified." });
    }
}
