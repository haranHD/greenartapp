using System.Security.Claims;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.MarketResearch;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Greenart.Api.Pricing;

public static partial class PriceResearchEndpoints
{
    public static void MapPriceResearch(this WebApplication app,
        Func<string?, IConfiguration, ClaimsPrincipal?, bool> authorize)
    {
        MapMobileResearch(app);
        var admin = app.MapGroup("/api/v1/admin/price-research").WithTags("Price research")
            .AddEndpointFilter(async (context, next) =>
            {
                var http = context.HttpContext;
                if (!authorize(http.Request.Headers["X-Admin-Key"].FirstOrDefault(),
                    http.RequestServices.GetRequiredService<IConfiguration>(), http.User))
                    return Results.Unauthorized();
                try { return await next(context); }
                catch (ArgumentException e) { return Results.BadRequest(new { error = e.Message }); }
                catch (InvalidOperationException e) { return Results.Conflict(new { error = e.Message }); }
                catch (DbUpdateConcurrencyException) { return Results.Conflict(new { error = "This research changed. Reload before continuing." }); }
            });
        admin.MapGet("/providers", (ILandMarketResearchService service) => Results.Ok(new[] { new ResearchProviderStatus("Gemini extraction + source evidence review", service.IsConfigured) }));
        admin.MapGet("/", async (LandPriceDbContext db, string? district, string? taluk, string? village, int? landCategory,
            string? researchStatus, string? brokerStatus, DateTime? from, DateTime? to, CancellationToken ct) =>
        {
            var query = db.PriceResearch.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(district)) query = query.Where(x => x.District.ToLower().Contains(district.ToLower()));
            if (!string.IsNullOrWhiteSpace(taluk)) query = query.Where(x => x.Taluk.ToLower().Contains(taluk.ToLower()));
            if (!string.IsNullOrWhiteSpace(village)) query = query.Where(x => x.Locality.ToLower().Contains(village.ToLower()));
            if (landCategory.HasValue) query = query.Where(x => (int)x.LandUsage == landCategory.Value);
            if (!string.IsNullOrWhiteSpace(researchStatus)) query = query.Where(x => x.ResearchStatus == researchStatus);
            if (brokerStatus == "Reviewed") query = query.Where(x => x.BrokerReviewedAtUtc != null);
            if (brokerStatus == "Pending") query = query.Where(x => x.BrokerReviewedAtUtc == null);
            if (from.HasValue) query = query.Where(x => x.CreatedAtUtc >= DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc));
            if (to.HasValue) query = query.Where(x => x.CreatedAtUtc < DateTime.SpecifyKind(to.Value.Date.AddDays(1), DateTimeKind.Utc));
            return Results.Ok((await query.OrderByDescending(x => x.CreatedAtUtc).Take(200).ToListAsync(ct)).Select(AdminDto));
        });
        MapResearchDetails(app, admin);
        admin.MapPost("/", async (CreatePriceResearchRequest input, LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var item = new PriceResearch(input.Locality ?? "", input.District ?? "", input.Latitude, input.Longitude,
                input.LandUsage, input.CoverageRadiusMeters, input.RoadAccess ?? "", input.Context ?? "");
            decimal? areaSqFt = input.Area.HasValue ? MarketEvidenceValidator.AreaSqFt(input.Area.Value, input.AreaUnit ?? "") : null;
            item.ConfigureGroundedRequest(Guid.TryParse(Actor(user), out var requester) ? requester : null, input.Taluk ?? "", input.Area, input.AreaUnit ?? "", areaSqFt);
            db.PriceResearch.Add(item); Audit(db, item, "Created", user);
            await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });
        admin.MapPost("/{id:guid}/research", async (Guid id, ResearchVersionRequest input,
            LandPriceDbContext db, ILandMarketResearchService research, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound();
            CheckVersion(item, input.Version);
            if (!research.IsConfigured) return Results.Conflict(new { error = "Grounded Gemini research is not configured. Broker opinion review remains available separately." });
            if (!item.InputArea.HasValue) return Results.BadRequest(new { error = "Create a research request with a valid land area before calling Gemini." });
            item.StartResearch(); Audit(db, item, "ResearchStarted", user, "Draft");
            await db.SaveChangesAsync(ct); // Optimistic concurrency prevents duplicate paid starts.
            try
            {
                await RunGroundedResearch(item, research, db, ct);
                Audit(db, item, "ResearchCompleted", user, "Researching");
                await db.SaveChangesAsync(CancellationToken.None);
                return Results.Ok(AdminDto(item));
            }
            catch (OperationCanceledException)
            {
                item.FinishResearch(JsonSerializer.Serialize(new[] { new ModelPriceProposal("All", "", "Interrupted", null, null,
                    "Request interrupted; provider usage may have occurred. No automatic retry was made.", [], DateTime.UtcNow) }));
                await db.SaveChangesAsync(CancellationToken.None);
                throw;
            }
        });
        admin.MapPost("/{id:guid}/recover", async (Guid id, ResearchVersionRequest input,
            LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound(); CheckVersion(item, input.Version);
            if (item.Status != "Researching" || item.ResearchStartedAtUtc > DateTime.UtcNow.AddMinutes(-2))
                return Results.Conflict(new { error = "Only research interrupted for more than two minutes can be recovered." });
            item.FinishResearch(JsonSerializer.Serialize(new[] { new ModelPriceProposal("All", "", "Interrupted", null, null,
                "Recovered after interruption. Provider usage may have occurred; check provider billing before running again.", [], DateTime.UtcNow) }));
            Audit(db, item, "Recovered", user); await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });
        admin.MapPost("/{id:guid}/broker-review", async (Guid id, DetailedBrokerReviewRequest input,
            LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound(); CheckVersion(item, input.Version);
            var before = item.Status;
            if (!string.IsNullOrWhiteSpace(input.EvidenceType) && input.EvidenceType != "BrokerMarketOpinion")
                return Results.BadRequest(new { error = "Broker opinions cannot be promoted to completed transactions. Attach transaction documents using the existing verified-transaction workflow." });
            var originalResearch = ReadResearch(item);
            var observation = new BrokerMarketObservation(item, item.Version, input.BrokerName ?? "", input.BrokerId ?? "", input.ContactReference ?? "",
                input.BrokerLocality ?? item.Locality, input.Evidence ?? "", input.Familiarity ?? "NotProvided", input.DocumentReference ?? "",
                input.LowPerCent, input.TypicalPerCent, input.HighPerCent, input.ObservedAtUtc,
                originalResearch?.Status == "PassedEvidenceReview" ? originalResearch.TypicalPerCent : null, Actor(user), input.LandCategory);
            item.RecordBrokerReview(input.BrokerName ?? "", input.Evidence ?? "", input.ObservationCount, input.LowPerCent, input.HighPerCent, input.ObservedAtUtc);
            db.BrokerMarketObservations.Add(observation);
            Audit(db, item, "BrokerReviewed", user, before); await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });
        admin.MapPost("/{id:guid}/decision", async (Guid id, PriceApprovalRequest input,
            LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound(); CheckVersion(item, input.Version);
            var actor = Actor(user); var previous = item.Status;
            switch (input.Action)
            {
                case "Approve": item.Approve(input.LowPerCent, input.HighPerCent, input.ValidUntilUtc, input.Notes ?? "", actor); break;
                case "Reject": item.Reject(input.Notes ?? "", actor); break;
                case "RequestCorrection": item.RequestCorrection(input.Notes ?? "", actor); break;
                case "InsufficientEvidence": item.MarkInsufficient(input.Notes ?? "", actor); break;
                case "Withdraw": item.Withdraw(input.Notes ?? "", actor); break;
                default: return Results.BadRequest(new { error = "Action must be Approve, Reject, Withdraw, RequestCorrection or InsufficientEvidence." });
            }
            var broker = await db.BrokerMarketObservations.Where(x => x.ResearchId == item.Id).OrderByDescending(x => x.AssessmentDateUtc).FirstOrDefaultAsync(ct);
            if (broker != null && (input.Action is "Approve" or "Reject" or "Withdraw" or "RequestCorrection"))
                broker.Decide(input.Action == "RequestCorrection" ? "NeedsCorrection" : input.Action == "Approve" ? "Approved" : input.Action == "Reject" ? "Rejected" : "Withdrawn", actor);
            Audit(db, item, input.Action, user, previous); await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });

        app.MapGet("/api/v1/pricing/broker-range", async (double latitude, double longitude, LandUsageType landUsage,
            string? roadAccess, LandPriceDbContext db, CancellationToken ct) =>
        {
            if (!double.IsFinite(latitude) || !double.IsFinite(longitude) || latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98 || !Enum.IsDefined(landUsage))
                return Results.BadRequest(new { error = "Valid India coordinates and land type are required." });
            var now = DateTime.UtcNow;
            // Pre-filter geographically before distance checks. Never reuse an unrelated village range.
            var rows = await db.PriceResearch.AsNoTracking().Where(x => x.Status == "Approved" &&
                x.ValidUntilUtc > now && x.LandUsage == landUsage &&
                x.Latitude >= latitude - .02 && x.Latitude <= latitude + .02 &&
                x.Longitude >= longitude - .02 && x.Longitude <= longitude + .02)
                .OrderByDescending(x => x.ApprovedAtUtc).ToListAsync(ct);
            var target = new GeoCoordinate(latitude, longitude);
            var match = rows.Where(x => string.Equals(x.RoadAccess, roadAccess?.Trim(), StringComparison.OrdinalIgnoreCase))
                .Select(x => new { Item = x, Distance = target.DistanceToMeters(new GeoCoordinate(x.Latitude, x.Longitude)) })
                .Where(x => x.Distance <= x.Item.CoverageRadiusMeters).OrderBy(x => x.Distance).FirstOrDefault()?.Item;
            return Results.Ok(new { range = match == null ? null : PublicDto(match) });
        }).WithTags("Price research").RequireRateLimiting("EstimatesRateLimit");
        app.MapGet("/api/v1/pricing/market-range", async (double latitude, double longitude, LandUsageType landUsage,
            string? roadAccess, decimal? area, string? areaUnit, LandPriceDbContext db,
            [FromServices] ISurveyRequestService surveyService,
            IConfiguration config, CancellationToken ct) =>
        {
            if (!double.IsFinite(latitude) || !double.IsFinite(longitude) || latitude < 6 || latitude > 38 ||
                longitude < 68 || longitude > 98 || !Enum.IsDefined(landUsage))
                return Results.BadRequest(new { error = "Valid India coordinates and land type are required." });
            decimal? normalizedArea = null;
            try { if (area.HasValue) normalizedArea = MarketEvidenceValidator.AreaSqFt(area.Value, areaUnit ?? ""); }
            catch (ArgumentException e) { return Results.BadRequest(new { error = e.Message }); }

            var saved = await FindMarketRange(latitude, longitude, landUsage, roadAccess, db, ct, normalizedArea, ResearchCacheDays(config), ResearchSourceMaxAge(config));
            if (saved != null) return Results.Ok(new { range = saved });

            // Check if there is an indicative or confirmed survey for this location
            var surveys = await surveyService.GetAllSurveysAsync(ct: ct);
            var nearbySurvey = surveys.FirstOrDefault(s =>
                s.LandUsage == landUsage &&
                Math.Abs(s.Latitude - latitude) < 0.015 &&
                Math.Abs(s.Longitude - longitude) < 0.015);

            if (nearbySurvey != null)
            {
                decimal rateCent = nearbySurvey.Status == "Confirmed" && nearbySurvey.ConfirmedRatePerCent.HasValue
                    ? nearbySurvey.ConfirmedRatePerCent.Value
                    : nearbySurvey.EstimatedRatePerCent;
                decimal rateSqFt = nearbySurvey.Status == "Confirmed" && nearbySurvey.ConfirmedRatePerCent.HasValue
                    ? Math.Round(rateCent / 435.6m, 2)
                    : nearbySurvey.EstimatedRatePerSqFt;

                var surveyRange = new MarketPriceRangeDto(
                    ResearchId: nearbySurvey.Id,
                    Locality: nearbySurvey.Locality,
                    District: nearbySurvey.District,
                    LandUsage: nearbySurvey.LandUsage.ToString(),
                    RoadAccess: roadAccess ?? "Colony Road",
                    CoverageRadiusMeters: 1000,
                    LowPerCent: Math.Round(rateCent * 0.90m, 2),
                    HighPerCent: Math.Round(rateCent * 1.10m, 2),
                    LowPerSqFt: Math.Round(rateSqFt * 0.90m, 2),
                    HighPerSqFt: Math.Round(rateSqFt * 1.10m, 2),
                    Basis: "BrokerReviewed",
                    ObservationCount: 1,
                    ReviewedAtUtc: nearbySurvey.ConfirmedAtUtc,
                    GeneratedAtUtc: nearbySurvey.CreatedAtUtc,
                    ValidUntilUtc: DateTime.UtcNow.AddDays(30),
                    Providers: new[] { "LocalRateSurvey" },
                    Label: "Indicative Market Range",
                    Notice: "Prevailing market range based on local area benchmarks and micro-location factors."
                );
                return Results.Ok(new { range = surveyRange });
            }

            return Results.Ok(new { range = (MarketPriceRangeDto?)null });
        }).WithTags("Price research").RequireRateLimiting("EstimatesRateLimit");
    }
    // Read saved research only. This public lookup never starts provider calls or changes approval state.
    private static async Task<MarketPriceRangeDto?> FindMarketRange(double latitude, double longitude,
        LandUsageType landUsage, string? roadAccess, LandPriceDbContext db, CancellationToken ct, decimal? areaSqFt = null, int cacheDays = 14, int maxSourceAgeDays = 90)
    {
        var now = DateTime.UtcNow;
        var target = new GeoCoordinate(latitude, longitude);
        var rows = await db.PriceResearch.AsNoTracking().Where(x => x.LandUsage == landUsage &&
            x.Latitude >= latitude - .02 && x.Latitude <= latitude + .02 &&
            x.Longitude >= longitude - .02 && x.Longitude <= longitude + .02).ToListAsync(ct);
        var matching = rows.Where(x => string.Equals(x.RoadAccess, roadAccess?.Trim(), StringComparison.OrdinalIgnoreCase))
            .Select(x => new { Item = x, Distance = target.DistanceToMeters(new GeoCoordinate(x.Latitude, x.Longitude)) })
            .Where(x => x.Distance <= x.Item.CoverageRadiusMeters).ToList();
        var approved = matching.Where(x => x.Item.Status == "Approved" && x.Item.ValidUntilUtc > now)
            .OrderBy(x => x.Distance).ThenByDescending(x => x.Item.ApprovedAtUtc).FirstOrDefault()?.Item;
        if (approved != null)
            return new(approved.Id, approved.Locality, approved.District, approved.LandUsage.ToString(),
                approved.RoadAccess, approved.CoverageRadiusMeters, approved.LowPerCent!.Value, approved.HighPerCent!.Value,
                Math.Round(approved.LowPerCent.Value / 435.6m, 2), Math.Round(approved.HighPerCent.Value / 435.6m, 2),
                "BrokerReviewed", approved.ObservationCount, approved.BrokerReviewedAtUtc, null, approved.ValidUntilUtc!.Value,
                [], "Broker-Reviewed Market Opinion", "Administrator-entered independent broker opinion, approved for publication. It may be inaccurate and is not completed-sale evidence.",
                0, null, "HumanReviewed", "NotApplicable");

        // The newest exercise at the nearest location supersedes older suggestions, including rejection/withdrawal.
        var candidate = matching.Where(x => areaSqFt.HasValue && x.Item.AreaSqFt == areaSqFt).OrderBy(x => x.Distance).ThenByDescending(x => x.Item.CreatedAtUtc).FirstOrDefault()?.Item;
        if (candidate == null || (candidate.Status != "Draft" && candidate.Status != "BrokerReviewed")) return null;
        if (candidate.PipelineVersion != "GroundedGeminiV1" || areaSqFt == null || candidate.AreaSqFt != areaSqFt) return null;
        var assessment = ReadResearch(candidate); var review = ReadReview(candidate);
        if (assessment?.Status != "PassedEvidenceReview" || review?.Status != "PassedEvidenceReview" ||
            assessment.GroundingStatus != "AuthorizedSourcesRetrieved" || assessment.SourceCount < 3 || !assessment.LowPerCent.HasValue || !assessment.HighPerCent.HasValue || assessment.LowPerCent <= 0 ||
            assessment.HighPerCent < assessment.LowPerCent || assessment.ResearchTimestampUtc > now || assessment.ResearchTimestampUtc <= now.AddDays(-cacheDays)) return null;
        var acceptedEvidence = assessment.Evidence.Where(e => e.Status == "EligibleAskingObservation" && review.AcceptedEvidenceIds.Contains(e.Id)).ToArray();
        if (acceptedEvidence.Length < 3 || acceptedEvidence.Any(e => e.Observation.ObservationDate == null || e.Observation.ObservationDate.Value.Date > now.Date || e.Observation.ObservationDate.Value.Date < now.Date.AddDays(-maxSourceAgeDays))) return null;
        var evidenceExpiry = DateTime.SpecifyKind(acceptedEvidence.Min(e => e.Observation.ObservationDate!.Value).Date, DateTimeKind.Utc).AddDays(maxSourceAgeDays + 1);
        var cacheExpiry = assessment.ResearchTimestampUtc.AddDays(cacheDays);
        var validUntil = cacheExpiry < evidenceExpiry ? cacheExpiry : evidenceExpiry;
        return new(candidate.Id, candidate.Locality, candidate.District, candidate.LandUsage.ToString(), candidate.RoadAccess,
            candidate.CoverageRadiusMeters, assessment.LowPerCent!.Value, assessment.HighPerCent!.Value,
            Math.Round(assessment.LowPerCent.Value / 435.6m, 2), Math.Round(assessment.HighPerCent.Value / 435.6m, 2),
            "AiSuggested", 0, null, assessment.ResearchTimestampUtc, validUntil, ["Gemini"],
            "AI-Assisted Asking-Price Research", "Provisional asking-price research with AI evidence review. AI agreement is not independent market verification. Not a completed-sale valuation.",
            assessment.SourceCount, $"/api/v1/pricing/research/{candidate.Id}/evidence", review.Status, assessment.GroundingStatus, assessment.TypicalPerCent);
    }
    private static int ResearchSourceMaxAge(IConfiguration config) => int.TryParse(config["MARKET_RESEARCH_SOURCE_MAX_AGE_DAYS"], out var days) ? Math.Clamp(days, 1, 365) : 90;
    private static int ResearchCacheDays(IConfiguration config) => int.TryParse(config["MARKET_RESEARCH_CACHE_DAYS"], out var days) ? Math.Clamp(days, 1, 30) : 14;
    private static void CheckVersion(PriceResearch item, Guid version)
    {
        if (version != item.Version) throw new InvalidOperationException("This research changed. Reload before continuing.");
    }
    private static string Actor(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "AdminKey";
    private static void Audit(LandPriceDbContext db, PriceResearch item, string action, ClaimsPrincipal user, string? previousStatus = null) =>
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), "PriceResearch", item.Id, action, Actor(user),
            JsonSerializer.Serialize(new { previousStatus, newStatus = item.Status, item.Version, item.LowPerCent, item.HighPerCent, item.ReviewNotes })));
    private static BrokerPriceRangeDto PublicDto(PriceResearch item) => new(item.Id, item.Locality, item.District,
        item.LandUsage.ToString(), item.RoadAccess, item.CoverageRadiusMeters, item.LowPerCent!.Value, item.HighPerCent!.Value,
        Math.Round(item.LowPerCent.Value / 435.6m, 2), Math.Round(item.HighPerCent.Value / 435.6m, 2),
        item.ObservationCount, item.BrokerReviewedAtUtc!.Value, item.ValidUntilUtc!.Value);
    private static object AdminDto(PriceResearch item) => new
    {
        item.Id,
        item.Version,
        item.Locality,
        item.District,
        item.Taluk,
        item.InputArea,
        item.InputAreaUnit,
        item.AreaSqFt,
        item.PipelineVersion,
        item.ResearchStatus,
        item.AiReviewStatus,
        item.SupersedesResearchId,
        AuthorizedSources = ReadAuthorizedSources(item),
        Research = ReadResearch(item),
        EvidenceReview = ReadReview(item),
        item.Latitude,
        item.Longitude,
        item.LandUsage,
        item.CoverageRadiusMeters,
        item.RoadAccess,
        item.Context,
        item.Status,
        Proposals = JsonSerializer.Deserialize<ModelPriceProposal[]>(item.ProposalsJson),
        item.BrokerName,
        item.BrokerEvidence,
        item.BrokerLowPerCent,
        item.BrokerHighPerCent,
        item.ObservationCount,
        item.LowPerCent,
        item.HighPerCent,
        item.BrokerReviewedAtUtc,
        item.ApprovedAtUtc,
        item.ValidUntilUtc,
        item.ReviewNotes,
        item.ReviewedBy,
        item.CreatedAtUtc
    };
}
