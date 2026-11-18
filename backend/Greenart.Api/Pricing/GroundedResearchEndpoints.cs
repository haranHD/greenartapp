using System.Security.Claims;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Greenart.Api.Pricing;

public static partial class PriceResearchEndpoints
{
    private static readonly JsonSerializerOptions ResearchJson = new() { PropertyNameCaseInsensitive = true };
    private static GroundedMarketAssessment? ReadResearch(PriceResearch item) {
        if (item.PipelineVersion != "GroundedGeminiV1" || item.ResearchResultJson == "{}") return null;
        try { return JsonSerializer.Deserialize<GroundedMarketAssessment>(item.ResearchResultJson, ResearchJson); } catch (JsonException) { return null; }
    }
    private static MarketEvidenceReview? ReadReview(PriceResearch item) {
        if (item.PipelineVersion != "GroundedGeminiV1" || item.ReviewResultJson == "{}") return null;
        try { return JsonSerializer.Deserialize<MarketEvidenceReview>(item.ReviewResultJson, ResearchJson); } catch (JsonException) { return null; }
    }
    private static AuthorizedMarketSourceInput[] ReadAuthorizedSources(PriceResearch item) {
        try { return JsonSerializer.Deserialize<AuthorizedMarketSourceInput[]>(item.AuthorizedSourcesJson, ResearchJson) ?? []; }
        catch (JsonException) { return []; }
    }
    private static async Task RunGroundedResearch(PriceResearch item, ILandMarketResearchService service, LandPriceDbContext db, CancellationToken ct) {
        var outcome = await service.AnalyzeAsync(new LandResearchInput(item.Id, item.Latitude, item.Longitude, item.Locality,
            item.District, item.Taluk, item.LandUsage, item.InputArea ?? 0, item.InputAreaUnit, item.CoverageRadiusMeters,
            item.RoadAccess, item.Context, ReadAuthorizedSources(item)), ct);
        var a = outcome.Research;
        var proposal = new ModelPriceProposal("Gemini", a.ModelName, a.Status == "PassedEvidenceReview" ? "Proposed" : a.Status,
            a.LowPerCent, a.HighPerCent, string.Join(" ", a.Limitations), a.Evidence.Where(e => e.Status == "EligibleAskingObservation").Select(e => e.ResolvedUrl).ToArray(), a.ResearchTimestampUtc);
        item.FinishGroundedResearch(JsonSerializer.Serialize(a), JsonSerializer.Serialize(outcome.Review), JsonSerializer.Serialize(new[] { proposal }), a.Status, outcome.Review.Status);
        foreach (var e in a.Evidence) {
            var o = e.Observation;
            db.MarketResearchEvidence.Add(new MarketResearchEvidence(item.Id, e.Id, o.SourceName ?? "", e.ResolvedUrl ?? "", o.ObservationDate,
                e.RetrievedAtUtc, o.AskingPrice, o.Area, o.AreaUnit ?? "", e.AreaSqFt, e.RatePerCent, e.RatePerSqFt,
                o.Latitude, o.Longitude, e.Status, JsonSerializer.Serialize(e.Checks)));
        }
    }
    private static void MapResearchDetails(WebApplication app, RouteGroupBuilder admin) {
        admin.MapGet("/statistics", async (LandPriceDbContext db, CancellationToken ct) => Results.Ok(new {
            totalRequests = await db.PriceResearch.CountAsync(ct),
            groundedResults = await db.PriceResearch.CountAsync(x => x.PipelineVersion == "GroundedGeminiV1" && x.ResearchStatus == "PassedEvidenceReview", ct),
            insufficient = await db.PriceResearch.CountAsync(x => x.ResearchStatus == "InsufficientEvidence", ct),
            brokerOpinions = await db.BrokerMarketObservations.CountAsync(ct),
            approvedBrokerOpinions = await db.BrokerMarketObservations.CountAsync(x => x.VerificationStatus == "Approved", ct),
            askingObservations = await db.MarketResearchEvidence.CountAsync(x => x.Status == "EligibleAskingObservation", ct),
            transactionEvidencePolicy = "Research and broker opinions do not create verified transaction records.",
            usage = (await db.PriceResearch.AsNoTracking().Where(x => x.PipelineVersion == "GroundedGeminiV1").ToListAsync(ct))
                .Select(x => new { x.Id, x.CreatedAtUtc, research = ReadResearch(x), review = ReadReview(x) })
                .Select(x => new { x.Id, x.CreatedAtUtc, calls = (x.research?.AttemptedCalls ?? 0) + (x.review?.AttemptedCalls ?? 0),
                    inputTokens = (x.research?.InputTokens ?? 0) + (x.review?.InputTokens ?? 0), outputTokens = (x.research?.OutputTokens ?? 0) + (x.review?.OutputTokens ?? 0),
                    totalTokens = (x.research?.TotalTokens ?? 0) + (x.review?.TotalTokens ?? 0) })
        }));
        admin.MapGet("/{id:guid}", async (Guid id, LandPriceDbContext db, CancellationToken ct) => {
            var item = await db.PriceResearch.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item == null) return Results.NotFound();
            return Results.Ok(new { item = AdminDto(item),
                brokerObservations = await db.BrokerMarketObservations.AsNoTracking().Where(x => x.ResearchId == id).OrderByDescending(x => x.AssessmentDateUtc).ToListAsync(ct),
                history = await db.AuditEvents.AsNoTracking().Where(x => x.EntityType == "PriceResearch" && x.EntityId == id).OrderBy(x => x.TimestampUtc).ToListAsync(ct) });
        });
        admin.MapPost("/{id:guid}/sources", async (Guid id, AuthorizedMarketSourcesRequest request, LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) => {
            var original = await db.PriceResearch.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (original == null) return Results.NotFound(); CheckVersion(original, request.Version);
            if (request.Sources == null || request.Sources.Length < 3 || request.Sources.Length > 8)
                return Results.BadRequest(new { error = "Supply 3–8 distinct source references with retrieval/storage/display permission." });
            foreach (var source in request.Sources) {
                if (source == null || string.IsNullOrWhiteSpace(source.Name) || source.Name.Length > 300 ||
                    !Greenart.Infrastructure.Services.SafeMarketEvidenceRetriever.IsPublicUrl(source.Url) ||
                    string.IsNullOrWhiteSpace(source.RightsReference) || source.RightsReference.Trim().Length < 20 || source.RightsReference.Length > 1000 ||
                    !source.RetrievalAndStorageAuthorized || !source.PublicDisplayAuthorized)
                    return Results.BadRequest(new { error = "Every source needs a public HTTPS URL, name and documented permission for retrieval, storage and public evidence display. Do not enter private URLs or credentials." });
            }
            if (request.Sources.Select(s => Greenart.Application.MarketResearch.MarketEvidenceValidator.CanonicalUrl(s.Url)).Distinct().Count() != request.Sources.Length)
                return Results.BadRequest(new { error = "Source references must be distinct." });
            var item = original;
            if (original.ProposalsJson != "[]" || original.ResearchResultJson != "{}" || original.Status != "Draft") {
                if (!original.InputArea.HasValue) return Results.Conflict(new { error = "Legacy inputs have no land area. Create a complete new research request." });
                var already = await db.PriceResearch.AsNoTracking().FirstOrDefaultAsync(x => x.SupersedesResearchId == original.Id, ct);
                if (already != null) return Results.Conflict(new { error = "A follow-up already exists. Select that exercise before registering different sources." });
                item = new PriceResearch(original.Locality, original.District, original.Latitude, original.Longitude, original.LandUsage, original.CoverageRadiusMeters, original.RoadAccess, original.Context);
                item.ConfigureGroundedRequest(original.RequestedByUserId, original.Taluk, original.InputArea, original.InputAreaUnit, original.AreaSqFt, original.Id);
                db.PriceResearch.Add(item);
            }
            item.SetAuthorizedSources(JsonSerializer.Serialize(request.Sources.Select(s => s with { RegisteredForResearchId = item.Id, RegisteredBy = Actor(user), RegisteredAtUtc = DateTime.UtcNow })));
            Audit(db, item, "AuthorizedSourcesRegistered", user, original.Status);
            await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });
        admin.MapPost("/{id:guid}/refresh", async (Guid id, ResearchVersionRequest request, LandPriceDbContext db,
            ILandMarketResearchService service, ClaimsPrincipal user, CancellationToken ct) => {
            var original = await db.PriceResearch.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (original == null) return Results.NotFound(); CheckVersion(original, request.Version);
            if (original.Status == "Researching") return Results.Conflict(new { error = "Research is already running. Refresh the queue or use recovery after an interruption." });
            if (!original.InputArea.HasValue || !service.IsConfigured) return Results.Conflict(new { error = "A valid land area and configured grounded Gemini are required. Create a complete new request if legacy inputs are missing." });
            PriceResearch item;
            await MobileResearchGate.WaitAsync(ct);
            try {
                await using var transaction = db.Database.IsNpgsql() ? await db.Database.BeginTransactionAsync(ct) : null;
                if (transaction != null) await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(74268153)", ct);
                var already = await db.PriceResearch.AsNoTracking().Where(x => x.SupersedesResearchId == original.Id).FirstOrDefaultAsync(ct);
                if (already != null) return Results.Ok(AdminDto(already));
                item = new PriceResearch(original.Locality, original.District, original.Latitude, original.Longitude,
                    original.LandUsage, original.CoverageRadiusMeters, original.RoadAccess, original.Context);
                item.ConfigureGroundedRequest(original.RequestedByUserId, original.Taluk, original.InputArea, original.InputAreaUnit, original.AreaSqFt, original.Id);
                item.SetAuthorizedSources(original.AuthorizedSourcesJson);
                item.StartResearch(); db.PriceResearch.Add(item); Audit(db, item, "RefreshResearchStarted", user, "Draft"); await db.SaveChangesAsync(ct);
                if (transaction != null) await transaction.CommitAsync(ct);
            } finally { MobileResearchGate.Release(); }
            try { await RunGroundedResearch(item, service, db, ct); }
            catch (OperationCanceledException) {
                item.FinishResearch(JsonSerializer.Serialize(new[] { new ModelPriceProposal("Gemini", "", "Interrupted", null, null, "Research interrupted. Provider usage may have occurred.", [], DateTime.UtcNow) }));
            }
            Audit(db, item, "RefreshResearchCompleted", user, "Researching"); await db.SaveChangesAsync(CancellationToken.None); return Results.Ok(AdminDto(item));
        });
        app.MapGet("/api/v1/pricing/research/{id:guid}/evidence", async (Guid id, LandPriceDbContext db, IConfiguration config, CancellationToken ct) => {
            var item = await db.PriceResearch.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (item == null) return Results.NotFound();
            var assessment = ReadResearch(item); var review = ReadReview(item);
            var now = DateTime.UtcNow;
            var accepted = assessment?.Evidence.Where(e => e.Status == "EligibleAskingObservation" && review != null && review.AcceptedEvidenceIds.Contains(e.Id)).ToArray() ?? [];
            var visible = (item.Status is "Draft" or "BrokerReviewed" or "Approved") && assessment?.Status == "PassedEvidenceReview" && review?.Status == "PassedEvidenceReview"
                && assessment.GroundingStatus == "AuthorizedSourcesRetrieved" && assessment.ResearchTimestampUtc <= now
                && assessment.ResearchTimestampUtc > now.AddDays(-ResearchCacheDays(config)) && accepted.Length >= 3
                && accepted.All(e => e.Observation.ObservationDate.HasValue && e.Observation.ObservationDate.Value.Date <= now.Date
                    && e.Observation.ObservationDate.Value.Date >= now.Date.AddDays(-ResearchSourceMaxAge(config)));
            return Results.Ok(new { researchId = id, locality = item.Locality, district = item.District,
                researchStatus = assessment?.Status ?? "InsufficientEvidence", reviewStatus = review?.Status ?? "NotReviewed",
                groundingStatus = assessment?.GroundingStatus ?? "Unavailable", sourceCategory = "AdvertisedAskingPrice",
                searchAttributionHtml = visible ? assessment!.SearchAttributionHtml : "",
                evidence = visible ? assessment!.Evidence.Where(e => e.Status == "EligibleAskingObservation" && review!.AcceptedEvidenceIds.Contains(e.Id)).Select(e => new {
                    e.Id, e.Observation.SourceName, sourceUrl = e.ResolvedUrl, e.Observation.ObservationDate, e.RetrievedAtUtc,
                    e.Observation.LocationDescription, landCategory = e.Observation.LandCategory, e.DistanceMeters,
                    originalArea = e.Observation.Area, originalAreaUnit = e.Observation.AreaUnit, originalAskingPrice = e.Observation.AskingPrice,
                    e.AreaSqFt, e.RatePerCent, e.RatePerSqFt, e.Observation.SourceCategory, verificationStatus = "SourceCheckedAskingObservation"
                }).ToArray() : [],
                limitations = visible ? assessment!.Limitations : new List<string> { "No currently publishable, evidence-reviewed asking observations. Broker notes and contact information remain private." }
            });
        }).RequireRateLimiting("EstimatesRateLimit").WithTags("Price research");
    }
}
