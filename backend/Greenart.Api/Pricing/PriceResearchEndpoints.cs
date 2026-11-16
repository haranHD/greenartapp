using System.Security.Claims;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Greenart.Api.Pricing;

public static class PriceResearchEndpoints
{
    public static void MapPriceResearch(this WebApplication app,
        Func<string?, IConfiguration, ClaimsPrincipal?, bool> authorize)
    {
        var admin = app.MapGroup("/api/v1/admin/price-research").WithTags("Price research")
            .AddEndpointFilter(async (context, next) => {
                var http = context.HttpContext;
                if (!authorize(http.Request.Headers["X-Admin-Key"].FirstOrDefault(),
                    http.RequestServices.GetRequiredService<IConfiguration>(), http.User))
                    return Results.Unauthorized();
                try { return await next(context); }
                catch (ArgumentException e) { return Results.BadRequest(new { error = e.Message }); }
                catch (InvalidOperationException e) { return Results.Conflict(new { error = e.Message }); }
                catch (DbUpdateConcurrencyException) { return Results.Conflict(new { error = "This research changed. Reload before continuing." }); }
            });
        admin.MapGet("/providers", (IPriceResearchModels models) => Results.Ok(models.GetStatus()));
        admin.MapGet("/", async (LandPriceDbContext db, CancellationToken ct) =>
            Results.Ok((await db.PriceResearch.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).Take(200).ToListAsync(ct)).Select(AdminDto)));
        admin.MapPost("/", async (CreatePriceResearchRequest input, LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) => {
            var item = new PriceResearch(input.Locality ?? "", input.District ?? "", input.Latitude, input.Longitude,
                input.LandUsage, input.CoverageRadiusMeters, input.RoadAccess ?? "", input.Context ?? "");
            db.PriceResearch.Add(item); Audit(db, item, "Created", user);
            await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });
        admin.MapPost("/{id:guid}/research", async (Guid id, ResearchVersionRequest input,
            LandPriceDbContext db, IPriceResearchModels models, ClaimsPrincipal user, CancellationToken ct) => {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound();
            CheckVersion(item, input.Version);
            if (!models.GetStatus().Any(x => x.Configured)) return Results.Conflict(new { error = "No AI providers are enabled. Configure server-side keys and model names first. Broker review is available without AI." });
            item.StartResearch(); Audit(db, item, "ResearchStarted", user);
            await db.SaveChangesAsync(ct); // Optimistic concurrency prevents duplicate paid starts.
            try {
                var proposals = await models.ResearchAsync(item, ct);
                item.FinishResearch(JsonSerializer.Serialize(proposals));
                Audit(db, item, "ResearchCompleted", user);
                await db.SaveChangesAsync(CancellationToken.None);
                return Results.Ok(AdminDto(item));
            } catch (OperationCanceledException) {
                item.FinishResearch(JsonSerializer.Serialize(new[] { new ModelPriceProposal("All", "", "Interrupted", null, null,
                    "Request interrupted; provider usage may have occurred. No automatic retry was made.", [], DateTime.UtcNow) }));
                await db.SaveChangesAsync(CancellationToken.None);
                throw;
            }
        });
        admin.MapPost("/{id:guid}/recover", async (Guid id, ResearchVersionRequest input,
            LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) => {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound(); CheckVersion(item, input.Version);
            if (item.Status != "Researching" || item.ResearchStartedAtUtc > DateTime.UtcNow.AddMinutes(-2))
                return Results.Conflict(new { error = "Only research interrupted for more than two minutes can be recovered." });
            item.FinishResearch(JsonSerializer.Serialize(new[] { new ModelPriceProposal("All", "", "Interrupted", null, null,
                "Recovered after interruption. Provider usage may have occurred; check provider billing before running again.", [], DateTime.UtcNow) }));
            Audit(db, item, "Recovered", user); await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });
        admin.MapPost("/{id:guid}/broker-review", async (Guid id, BrokerPriceReviewRequest input,
            LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) => {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound(); CheckVersion(item, input.Version);
            item.RecordBrokerReview(input.BrokerName ?? "", input.Evidence ?? "", input.ObservationCount,
                input.LowPerCent, input.HighPerCent, input.ObservedAtUtc);
            Audit(db, item, "BrokerReviewed", user); await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });
        admin.MapPost("/{id:guid}/decision", async (Guid id, PriceApprovalRequest input,
            LandPriceDbContext db, ClaimsPrincipal user, CancellationToken ct) => {
            var item = await db.PriceResearch.FindAsync([id], ct);
            if (item == null) return Results.NotFound(); CheckVersion(item, input.Version);
            var actor = Actor(user);
            switch (input.Action) {
                case "Approve": item.Approve(input.LowPerCent, input.HighPerCent, input.ValidUntilUtc, input.Notes ?? "", actor); break;
                case "Reject": item.Reject(input.Notes ?? "", actor); break;
                case "Withdraw": item.Withdraw(input.Notes ?? "", actor); break;
                default: return Results.BadRequest(new { error = "Action must be Approve, Reject or Withdraw." });
            }
            Audit(db, item, input.Action, user); await db.SaveChangesAsync(ct); return Results.Ok(AdminDto(item));
        });

        app.MapGet("/api/v1/pricing/broker-range", async (double latitude, double longitude, LandUsageType landUsage,
            string? roadAccess, LandPriceDbContext db, CancellationToken ct) => {
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
    }
    private static void CheckVersion(PriceResearch item, Guid version) {
        if (version != item.Version) throw new InvalidOperationException("This research changed. Reload before continuing.");
    }
    private static string Actor(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "AdminKey";
    private static void Audit(LandPriceDbContext db, PriceResearch item, string action, ClaimsPrincipal user) =>
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), "PriceResearch", item.Id, action, Actor(user),
            JsonSerializer.Serialize(new { item.Status, item.Version, item.LowPerCent, item.HighPerCent, item.ReviewNotes })));
    private static BrokerPriceRangeDto PublicDto(PriceResearch item) => new(item.Id, item.Locality, item.District,
        item.LandUsage.ToString(), item.RoadAccess, item.CoverageRadiusMeters, item.LowPerCent!.Value, item.HighPerCent!.Value,
        Math.Round(item.LowPerCent.Value / 435.6m, 2), Math.Round(item.HighPerCent.Value / 435.6m, 2),
        item.ObservationCount, item.BrokerReviewedAtUtc!.Value, item.ValidUntilUtc!.Value);
    private static object AdminDto(PriceResearch item) => new {
        item.Id, item.Version, item.Locality, item.District, item.Latitude, item.Longitude, item.LandUsage,
        item.CoverageRadiusMeters, item.RoadAccess, item.Context, item.Status,
        Proposals = JsonSerializer.Deserialize<ModelPriceProposal[]>(item.ProposalsJson),
        item.BrokerName, item.BrokerEvidence, item.BrokerLowPerCent, item.BrokerHighPerCent, item.ObservationCount, item.LowPerCent, item.HighPerCent,
        item.BrokerReviewedAtUtc, item.ApprovedAtUtc, item.ValidUntilUtc, item.ReviewNotes, item.ReviewedBy, item.CreatedAtUtc
    };
}
