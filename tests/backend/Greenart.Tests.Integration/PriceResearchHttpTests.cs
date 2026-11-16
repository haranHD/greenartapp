using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Greenart.Tests.Integration;
public class PriceResearchHttpTests
{
    private const string AdminKey = "test-only-price-admin";
    private static WebApplicationFactory<Program> Factory() {
        var dbName = Guid.NewGuid().ToString();
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder => {
            builder.UseEnvironment("Testing"); builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "PriceResearchTestOnlySigningKeyWithMoreThan32Characters!");
            builder.UseSetting("ADMIN_API_KEY", AdminKey);
            builder.ConfigureServices(services => {
                services.RemoveAll<DbContextOptions<LandPriceDbContext>>();
                services.RemoveAll<LandPriceDbContext>();
                services.AddScoped(_ => new LandPriceDbContext(new DbContextOptionsBuilder<LandPriceDbContext>().UseInMemoryDatabase(dbName).Options));
                services.RemoveAll<IPriceResearchModels>(); services.AddSingleton<IPriceResearchModels, FakeModels>();
            });
        });
    }
    private static async Task<JsonElement> Send(HttpClient client, string path, object body) {
        using var response = await client.PostAsJsonAsync("/api/v1/admin/price-research/" + path, body);
        var json = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {json}");
        return JsonDocument.Parse(json).RootElement.Clone();
    }
    private static Task<JsonElement> Create(HttpClient client) => Send(client, "", new {
        locality = "Bhavani", district = "Erode", latitude = 11.4471, longitude = 77.684,
        landUsage = 1, coverageRadiusMeters = 500, roadAccess = "Layout Road", context = "Near schools" });
    private static string Version(JsonElement item) => item.GetProperty("version").GetString()!;
    private static string Id(JsonElement item) => item.GetProperty("id").GetString()!;
    private static async Task<JsonElement> Public(HttpClient client, string query = "") {
        var response = await client.GetAsync("/api/v1/pricing/broker-range?latitude=11.4471&longitude=77.684&landUsage=1&roadAccess=Layout%20Road" + query);
        response.EnsureSuccessStatusCode(); return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("range").Clone();
    }
    [Fact] public async Task ResearchRequiresAdminBeforeAnyProviderOrDatabaseAccess() {
        using var factory = Factory(); using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/admin/price-research/")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/admin/price-research/", new {})).StatusCode);
    }
    [Fact] public async Task BrokerReviewApprovalPublicationAndWithdrawal_ArePersistedAndAudited() {
        using var factory = Factory(); using var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var draft = await Create(client); Assert.Equal(JsonValueKind.Null, (await Public(client)).ValueKind);
        var id = Id(draft);
        using var premature = await client.PostAsJsonAsync($"/api/v1/admin/price-research/{id}/decision", new {
            version = Version(draft), action = "Approve", lowPerCent = 400000, highPerCent = 500000,
            validUntilUtc = DateTime.UtcNow.AddDays(30), notes = "Checked" });
        Assert.Equal(HttpStatusCode.Conflict, premature.StatusCode);
        var researched = await Send(client, id + "/research", new { version = Version(draft) });
        Assert.Equal(3, researched.GetProperty("proposals").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, (await Public(client)).ValueKind);
        var reviewed = await Send(client, id + "/broker-review", new { version = Version(researched), brokerName = "Internal Broker Name",
            evidence = "Private broker evidence with three documented local references.", observationCount = 3,
            lowPerCent = 400000, highPerCent = 500000, observedAtUtc = DateTime.UtcNow.AddDays(-1) });
        Assert.Equal(JsonValueKind.Null, (await Public(client)).ValueKind);
        var approved = await Send(client, id + "/decision", new { version = Version(reviewed), action = "Approve",
            lowPerCent = 410000, highPerCent = 490000, validUntilUtc = DateTime.UtcNow.AddDays(30), notes = "Checked and adjusted after broker review" });
        var range = await Public(client); Assert.Equal(410000, range.GetProperty("lowPerCent").GetDecimal());
        Assert.Equal(3, range.GetProperty("observationCount").GetInt32());
        Assert.DoesNotContain("Internal Broker Name", range.GetRawText()); Assert.DoesNotContain("Private broker evidence", range.GetRawText());
        Assert.False(range.TryGetProperty("proposals", out _));
        using (var wrongRoad = await client.GetAsync("/api/v1/pricing/broker-range?latitude=11.4471&longitude=77.684&landUsage=1&roadAccess=Highway"))
            Assert.Contains("\"range\":null", await wrongRoad.Content.ReadAsStringAsync());
        using (var outside = await client.GetAsync("/api/v1/pricing/broker-range?latitude=11.4571&longitude=77.684&landUsage=1&roadAccess=Layout%20Road"))
            Assert.Contains("\"range\":null", await outside.Content.ReadAsStringAsync());
        using (var wrongType = await client.GetAsync("/api/v1/pricing/broker-range?latitude=11.4471&longitude=77.684&landUsage=5&roadAccess=Layout%20Road"))
            Assert.Contains("\"range\":null", await wrongType.Content.ReadAsStringAsync());
        await Send(client, id + "/decision", new { version = Version(approved), action = "Withdraw", lowPerCent = 0, highPerCent = 0,
            validUntilUtc = DateTime.UtcNow, notes = "Conditions have changed" });
        Assert.Equal(JsonValueKind.Null, (await Public(client)).ValueKind);
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        Assert.Equal(0, await db.LandPriceRecords.CountAsync());
        Assert.Equal(6, await db.AuditEvents.CountAsync(x => x.EntityType == "PriceResearch"));
        Assert.Equal(400000, (await db.PriceResearch.SingleAsync()).BrokerLowPerCent);
    }
    [Fact] public async Task StaleVersionAndDuplicateResearch_AreRejectedWithoutRerunningModels() {
        using var factory = Factory(); using var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var draft = await Create(client); var id = Id(draft);
        var researched = await Send(client, id + "/research", new { version = Version(draft) });
        foreach (var version in new[] { Version(draft), Version(researched) }) {
            using var response = await client.PostAsJsonAsync($"/api/v1/admin/price-research/{id}/research", new { version });
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }
        var models = (FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>(); Assert.Equal(1, models.Calls);
    }
    [Fact] public async Task ExpiredApprovedRange_IsNeverPublished() {
        using var factory = Factory(); using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var item = new PriceResearch("Bhavani", "Erode", 11.4471, 77.684, Greenart.Domain.Enums.LandUsageType.Residential, 500, "Layout Road", "");
        item.RecordBrokerReview("Broker", "Reviewed against three local documented references", 3, 400000, 500000, DateTime.UtcNow.AddDays(-1));
        item.Approve(400000, 500000, DateTime.UtcNow.AddDays(1), "Checked", "admin");
        typeof(PriceResearch).GetProperty(nameof(PriceResearch.ValidUntilUtc))!.SetValue(item, DateTime.UtcNow.AddSeconds(-1));
        db.PriceResearch.Add(item); await db.SaveChangesAsync();
        Assert.Equal(JsonValueKind.Null, (await Public(client)).ValueKind);
    }
    private class FakeModels : IPriceResearchModels {
        public int Calls;
        public IReadOnlyList<ResearchProviderStatus> GetStatus() => [new("OpenAI", true), new("Claude", true), new("Gemini", true)];
        public Task<IReadOnlyList<ModelPriceProposal>> ResearchAsync(PriceResearch research, CancellationToken ct) {
            Interlocked.Increment(ref Calls);
            return Task.FromResult<IReadOnlyList<ModelPriceProposal>>(new[] { "OpenAI", "Claude", "Gemini" }.Select((p, i) =>
                new ModelPriceProposal(p, "test", "Proposed", 400000 + i * 50000, 500000 + i * 50000, "Unvalidated hypothesis", [], DateTime.UtcNow)).ToArray());
        }
    }
}
