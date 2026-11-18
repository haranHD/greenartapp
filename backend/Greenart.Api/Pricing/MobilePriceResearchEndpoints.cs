using System.Security.Claims;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.MarketResearch;
using Greenart.Application.Estimation;
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
        LandPriceDbContext db, ILandMarketResearchService research, IConfiguration config, ILandPriceRepository repository, CancellationToken ct)
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
                input.LandUsage, 500, input.RoadAccess ?? "", "Requested from mobile. Grounded asking-price research, not a completed transaction.");
            if (!input.Area.HasValue) return Results.BadRequest(new { error = "Enter land area before requesting grounded research." });
            var areaSqFt = MarketEvidenceValidator.AreaSqFt(input.Area.Value, input.AreaUnit ?? "");
            item.ConfigureGroundedRequest(userId, input.Taluk ?? "", input.Area, input.AreaUnit ?? "", areaSqFt);
        } catch (ArgumentException e) { return Results.BadRequest(new { error = e.Message }); }

        if (!TamilNaduGeoBounds.IsValidTamilNaduDistrict(input.District) || !TamilNaduGeoBounds.IsWithinTamilNadu(input.Latitude, input.Longitude))
            return Results.BadRequest(new { error = "Select a locality with a known district before grounded research." });
        // Reuse the transaction engine's eligibility rules and radius, without invoking external guideline providers.
        var transactions = await repository.GetNearbyComparableAsync(input.Latitude, input.Longitude, EstimationEngine.DefaultRadiusMeters, input.LandUsage, ct);
        var transactionTarget = new GeoCoordinate(input.Latitude, input.Longitude);
        if (transactions.Count(x => transactionTarget.DistanceToMeters(new GeoCoordinate(x.Latitude, x.Longitude)) <= EstimationEngine.DefaultRadiusMeters &&
            x.IsEligibleForMarketEstimation(DateTime.UtcNow, EstimationEngine.MaxRecordAgeMonths)) >= EstimationEngine.MinimumRecordThreshold)
            return Results.Ok(new { range = (MarketPriceRangeDto?)null, status = "VerifiedTransactionsAvailable", cached = true,
                message = "Verified completed-sale evidence is available. Recalculate the transaction-based estimate; no Gemini call was made." });

        var sourceDonors = await db.PriceResearch.AsNoTracking().Where(x => x.PipelineVersion == "GroundedGeminiV1" && x.AuthorizedSourcesJson != "[]" && x.Status != "Rejected" && x.Status != "Withdrawn" && x.Status != "NeedsCorrection" &&
            x.LandUsage == input.LandUsage && x.AreaSqFt == item.AreaSqFt && x.Latitude >= input.Latitude - .02 && x.Latitude <= input.Latitude + .02 &&
            x.Longitude >= input.Longitude - .02 && x.Longitude <= input.Longitude + .02).OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        var donor = sourceDonors.FirstOrDefault(x => string.Equals(x.RoadAccess, input.RoadAccess?.Trim(), StringComparison.OrdinalIgnoreCase) &&
            new GeoCoordinate(input.Latitude, input.Longitude).DistanceToMeters(new GeoCoordinate(x.Latitude, x.Longitude)) <= x.CoverageRadiusMeters);
        if (donor != null) item.SetAuthorizedSources(donor.AuthorizedSourcesJson);

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
            var cached = await FindMarketRange(input.Latitude, input.Longitude, input.LandUsage, input.RoadAccess, db, ct, item.AreaSqFt, ResearchCacheDays(config), ResearchSourceMaxAge(config));
            if (cached != null) return Results.Ok(new { range = cached, status = "Saved", cached = true, message = "Showing saved pricing. No new provider call was made." });
            if (repeated) return Results.Ok(new { range = (MarketPriceRangeDto?)null, status = "AlreadyRequested", cached = true,
                message = "This request was already submitted. Refresh pricing or ask the admin to check its saved research; it was not charged again." });

            var now = DateTime.UtcNow;
            var recent = await db.PriceResearch.AsNoTracking().Where(x => x.LandUsage == input.LandUsage && x.AreaSqFt == item.AreaSqFt && x.AuthorizedSourcesJson == item.AuthorizedSourcesJson &&
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
                    : ReadResearch(existing)?.GroundingStatus == "AuthorizedSourcesMissing" ? "Waiting for an admin to register authorized source references. No new Gemini call was made."
                    : ReadResearch(existing)?.Status == "ProviderError" ? "Gemini could not complete the last request. Ask the admin to check provider access or billing. No duplicate call was made."
                    : "Recent research returned no defensible range. Results are saved for admin review; no duplicate call was made." });
            if (!research.IsConfigured)
                return Results.Json(new { error = "Gemini evidence research is unavailable. Ask the admin to check its key, model and source configuration." }, statusCode: 503);
            var today = now.Date;
            var starts = db.AuditEvents.Where(x => x.Action == MobileStarted && x.TimestampUtc >= today);
            if (await starts.CountAsync(x => x.PerformedBy == actor, ct) >= DailyLimit(config, "PRICE_RESEARCH_DAILY_USER_LIMIT", 3) ||
                await starts.CountAsync(ct) >= DailyLimit(config, "PRICE_RESEARCH_DAILY_GLOBAL_LIMIT", 30))
                return Results.Json(new { error = "The daily AI research allowance has been reached. Saved prices remain available. Try tomorrow." }, statusCode: 429);
            item.StartResearch(); db.PriceResearch.Add(item);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), "PriceResearch", item.Id, MobileStarted, actor,
                JsonSerializer.Serialize(new { requestId = input.RequestId, previousStatus = "Draft", newStatus = "Researching", item.Version })));
            await db.SaveChangesAsync(ct);
            if (transaction != null) await transaction.CommitAsync(ct);
        } finally { MobileResearchGate.Release(); }

        // Once started, save the outcome even if the phone navigates away or loses its connection.
        // Each adapter retains its existing 35-second budget and performs no automatic retries.
        try {
            await RunGroundedResearch(item, research, db, CancellationToken.None);
        } catch (Exception) {
            item.FinishResearch(JsonSerializer.Serialize(new[] { new ModelPriceProposal("All", "", "Interrupted", null, null,
                "Research was interrupted. Provider usage may have occurred; check before retrying.", [], DateTime.UtcNow) }));
        }
        Audit(db, item, "MobileResearchCompleted", user, "Researching");
        await db.SaveChangesAsync(CancellationToken.None);
        var range = await FindMarketRange(input.Latitude, input.Longitude, input.LandUsage, input.RoadAccess, db, CancellationToken.None, item.AreaSqFt, ResearchCacheDays(config), ResearchSourceMaxAge(config));
        return Results.Ok(new { range, researchId = item.Id, status = range == null ? "NoEstimate" : "Saved", cached = false,
            message = range == null ? ReadResearch(item)?.GroundingStatus == "AuthorizedSourcesMissing" ? "Insufficient Evidence: an admin must register authorized source references. Request saved for review; no Gemini call was made." : "Insufficient Evidence: no defensible asking-price range passed source checks and AI review. Research is saved for admin/broker review."
                : "AI-assisted asking-price research saved for admin review. AI review is not independent market verification." });
    }
}
