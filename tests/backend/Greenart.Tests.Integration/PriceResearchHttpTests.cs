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
    private static WebApplicationFactory<Program> Factory(int userLimit = 3, int globalLimit = 30) {
        var dbName = Guid.NewGuid().ToString();
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder => {
            builder.UseEnvironment("Testing"); builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "PriceResearchTestOnlySigningKeyWithMoreThan32Characters!");
            builder.UseSetting("ADMIN_API_KEY", AdminKey);
            builder.UseSetting("PRICE_RESEARCH_DAILY_USER_LIMIT", userLimit.ToString());
            builder.UseSetting("PRICE_RESEARCH_DAILY_GLOBAL_LIMIT", globalLimit.ToString());
            builder.ConfigureServices(services => {
                services.RemoveAll<DbContextOptions<LandPriceDbContext>>();
                services.RemoveAll<LandPriceDbContext>();
                services.AddScoped(_ => new LandPriceDbContext(new DbContextOptionsBuilder<LandPriceDbContext>().UseInMemoryDatabase(dbName).Options));
                services.RemoveAll<IPriceResearchModels>(); services.RemoveAll<ILandMarketResearchService>();
                services.RemoveAll<ILandPriceRepository>();
                services.AddScoped<ILandPriceRepository>(sp => new ResearchTestRepository(sp.GetRequiredService<LandPriceDbContext>(), sp.GetRequiredService<FakeModels>()));
                services.AddSingleton<FakeModels>(); services.AddSingleton<IPriceResearchModels>(sp => sp.GetRequiredService<FakeModels>());
                services.AddSingleton<ILandMarketResearchService>(sp => sp.GetRequiredService<FakeModels>());
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
        landUsage = 1, coverageRadiusMeters = 500, roadAccess = "Layout Road", context = "Near schools", area = 5, areaUnit = "Cent", taluk = "Bhavani" });
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
        Assert.Equal(1, researched.GetProperty("proposals").GetArrayLength());
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
    private static async Task<JsonElement> Market(HttpClient client, string? query = null) {
        var response = await client.GetAsync("/api/v1/pricing/market-range?" + (query ?? "latitude=11.4471&longitude=77.684&landUsage=1&roadAccess=Layout%20Road&area=5&areaUnit=Cent"));
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("range").Clone();
    }
    [Fact] public async Task MarketRange_ShowsSavedAiBeforeApproval_ThenPrefersApprovedBrokerRange() {
        using var factory = Factory(); using var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var draft = await Create(client); var id = Id(draft);
        Assert.Equal(JsonValueKind.Null, (await Market(client)).ValueKind);
        var researched = await Send(client, id + "/research", new { version = Version(draft) });
        var ai = await Market(client);
        Assert.Equal("AiSuggested", ai.GetProperty("basis").GetString());
        Assert.Equal(400000, ai.GetProperty("lowPerCent").GetDecimal());
        Assert.Equal(600000, ai.GetProperty("highPerCent").GetDecimal());
        Assert.Equal(Math.Round(400000m / 435.6m, 2), ai.GetProperty("lowPerSqFt").GetDecimal());
        Assert.Equal(0, ai.GetProperty("observationCount").GetInt32());
        Assert.Equal(1, ai.GetProperty("providers").GetArrayLength());
        Assert.Equal("AI-Assisted Asking-Price Research", ai.GetProperty("label").GetString());
        Assert.False(ai.TryGetProperty("proposals", out _)); Assert.False(ai.TryGetProperty("brokerEvidence", out _));
        Assert.Equal(JsonValueKind.Null, (await Public(client)).ValueKind); // Approval-only contract remains intact.
        var reviewed = await Send(client, id + "/broker-review", new { version = Version(researched), brokerName = "Private Broker",
            evidence = "Private evidence confirming the local price range.", observationCount = 2,
            lowPerCent = 430000, highPerCent = 470000, observedAtUtc = DateTime.UtcNow.AddDays(-1) });
        Assert.Equal("AiSuggested", (await Market(client)).GetProperty("basis").GetString());
        var approved = await Send(client, id + "/decision", new { version = Version(reviewed), action = "Approve",
            lowPerCent = 430000, highPerCent = 470000, validUntilUtc = DateTime.UtcNow.AddDays(20), notes = "Broker checked" });
        // A new AI exercise must not replace an existing approved range.
        var next = await Create(client); await Send(client, Id(next) + "/research", new { version = Version(next) });
        var published = await Market(client);
        Assert.Equal("BrokerReviewed", published.GetProperty("basis").GetString());
        Assert.Equal(430000, published.GetProperty("lowPerCent").GetDecimal());
        Assert.DoesNotContain("Private", published.GetRawText());
        Assert.Equal(2, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
        using var scope = factory.Services.CreateScope();
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<LandPriceDbContext>().LandPriceRecords.CountAsync());
    }
    [Fact] public async Task MarketRange_RespectsLocationLandRoadAndRejection_WithoutStartingProviders() {
        using var factory = Factory(); using var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var draft = await Create(client); var id = Id(draft);
        var researched = await Send(client, id + "/research", new { version = Version(draft) });
        foreach (var query in new[] {
            "latitude=11.4571&longitude=77.684&landUsage=1&roadAccess=Layout%20Road",
            "latitude=11.4471&longitude=77.684&landUsage=5&roadAccess=Layout%20Road",
            "latitude=11.4471&longitude=77.684&landUsage=1&roadAccess=Highway" })
            Assert.Equal(JsonValueKind.Null, (await Market(client, query)).ValueKind);
        await Send(client, id + "/decision", new { version = Version(researched), action = "Reject",
            lowPerCent = 0, highPerCent = 0, validUntilUtc = DateTime.UtcNow, notes = "Broker reports that the AI proposal is inaccurate" });
        Assert.Equal(JsonValueKind.Null, (await Market(client)).ValueKind);
        Assert.Equal(1, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    [Theory]
    [InlineData("Stale")]
    [InlineData("Future")]
    [InlineData("Failed")]
    [InlineData("Malformed")]
    [InlineData("InvalidRange")]
    public async Task MarketRange_NeverDisplaysUnusableProposals(string scenario) {
        using var factory = Factory(); using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var item = new PriceResearch("Bhavani", "Erode", 11.4471, 77.684, Greenart.Domain.Enums.LandUsageType.Residential, 500, "Layout Road", "");
        item.StartResearch();
        item.FinishResearch(scenario == "Malformed" ? "invalid-json" : JsonSerializer.Serialize(new[] {
            new ModelPriceProposal("OpenAI", "test", scenario == "Failed" ? "Failed" : "Proposed",
                scenario == "InvalidRange" ? -1 : 400000, 500000, "Private research", [],
                scenario == "Stale" ? DateTime.UtcNow.AddDays(-15) : scenario == "Future" ? DateTime.UtcNow.AddDays(1) : DateTime.UtcNow) }));
        db.PriceResearch.Add(item); await db.SaveChangesAsync();
        Assert.Equal(JsonValueKind.Null, (await Market(client)).ValueKind);
        Assert.Equal(0, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    private static async Task SignInCustomer(WebApplicationFactory<Program> factory, HttpClient client) {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var account = new User(Guid.NewGuid(), "customer-" + Guid.NewGuid() + "@example.test", "Test Customer", "test-subject-" + Guid.NewGuid(), isEmailVerified: true);
        db.Users.Add(account); await db.SaveChangesAsync();
        var token = scope.ServiceProvider.GetRequiredService<ITokenService>().GenerateAccessToken(account);
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    }
    private static object MobileRequest(Guid? requestId = null, double latitude = 11.4471) => new {
        requestId = requestId ?? Guid.NewGuid(), locality = "Bhavani", district = "Erode", latitude, longitude = 77.684,
        landUsage = 1, roadAccess = "Layout Road", area = 5, areaUnit = "Cent", taluk = "Bhavani" };
    [Fact] public async Task MobileGeneration_RequiresAuthentication_AndMakesNoAnonymousCalls() {
        using var factory = Factory(); using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest())).StatusCode);
        Assert.Equal(0, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    [Fact] public async Task MobileGeneration_SavesForAdminReview_AndReusesCacheAndRequestId() {
        using var factory = Factory(); using var client = factory.CreateClient(); await SignInCustomer(factory, client);
        var request = MobileRequest();
        using var first = await client.PostAsJsonAsync("/api/v1/pricing/research", request);
        first.EnsureSuccessStatusCode(); var data = JsonDocument.Parse(await first.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("AiSuggested", data.GetProperty("range").GetProperty("basis").GetString());
        Assert.False(data.GetProperty("cached").GetBoolean());
        foreach (var retry in new[] { request, MobileRequest() }) {
            using var response = await client.PostAsJsonAsync("/api/v1/pricing/research", retry);
            response.EnsureSuccessStatusCode(); Assert.True(JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("cached").GetBoolean());
        }
        Assert.Equal(1, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        Assert.Equal("Draft", (await db.PriceResearch.SingleAsync()).Status);
        Assert.Equal(1, JsonSerializer.Deserialize<ModelPriceProposal[]>((await db.PriceResearch.SingleAsync()).ProposalsJson)!.Length);
        Assert.Equal(1, await db.AuditEvents.CountAsync(x => x.Action == "MobileResearchStarted"));
        Assert.Equal(0, await db.LandPriceRecords.CountAsync());
    }
    [Fact] public async Task MobileGeneration_ConcurrentRequestsShareOneDurableStart() {
        using var factory = Factory(); using var client = factory.CreateClient(); await SignInCustomer(factory, client);
        var models = (FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>();
        models.Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        var first = client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest());
        await models.Started.Task.WaitAsync(TimeSpan.FromSeconds(10));
        using var second = await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest());
        second.EnsureSuccessStatusCode();
        Assert.Equal("Researching", JsonDocument.Parse(await second.Content.ReadAsStringAsync()).RootElement.GetProperty("status").GetString());
        models.Release.SetResult(true); using var completed = await first; completed.EnsureSuccessStatusCode();
        Assert.Equal(1, models.Calls);
    }
    [Fact] public async Task MobileGeneration_EnforcesDailyQuotaButStillServesCachedPrices() {
        using var factory = Factory(userLimit: 1); using var client = factory.CreateClient(); await SignInCustomer(factory, client);
        using var first = await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest()); first.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest(latitude: 11.55))).StatusCode);
        using var cached = await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest()); cached.EnsureSuccessStatusCode();
        Assert.Equal(1, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    [Fact] public async Task MobileGeneration_NoEstimateIsSavedAndCooledDownWithoutDuplicateCharges() {
        using var factory = Factory(); using var client = factory.CreateClient(); await SignInCustomer(factory, client);
        var models = (FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>(); models.NoEstimate = true;
        var request = MobileRequest();
        foreach (var input in new[] { request, request, MobileRequest() }) {
            using var response = await client.PostAsJsonAsync("/api/v1/pricing/research", input); response.EnsureSuccessStatusCode();
            Assert.Equal(JsonValueKind.Null, JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("range").ValueKind);
        }
        Assert.Equal(1, models.Calls);
    }
    [Fact] public async Task MobileGeneration_DisabledProvidersAndInvalidPinsNeverStartResearch() {
        using var factory = Factory(); using var client = factory.CreateClient(); await SignInCustomer(factory, client);
        var models = (FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>(); models.Enabled = false;
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest(latitude: 0))).StatusCode);
        Assert.Equal(0, models.Calls);
        using var scope = factory.Services.CreateScope(); Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<LandPriceDbContext>().PriceResearch.CountAsync());
    }
    [Fact] public async Task MobileGeneration_GlobalAllowanceAppliesAcrossAccounts() {
        using var factory = Factory(globalLimit: 1); using var first = factory.CreateClient(); using var second = factory.CreateClient();
        await SignInCustomer(factory, first); await SignInCustomer(factory, second);
        using var generated = await first.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest()); generated.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.TooManyRequests, (await second.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest(latitude: 11.55))).StatusCode);
        Assert.Equal(1, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    [Fact] public async Task MobileGeneration_UnverifiedEmailAccountCannotSpendCredits() {
        using var factory = Factory(); using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var account = new User(Guid.NewGuid(), "unverified@example.test", "Unverified", "email:unverified@example.test");
        db.Users.Add(account); await db.SaveChangesAsync();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",
            scope.ServiceProvider.GetRequiredService<ITokenService>().GenerateAccessToken(account));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/v1/pricing/research", MobileRequest())).StatusCode);
        Assert.Equal(0, ((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task PublicEvidenceHidesExpiredResearchButAdminRetainsHistory(bool expireResearch) {
        using var factory = Factory(); using var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var draft = await Create(client); var id = Id(draft);
        await Send(client, id + "/research", new { version = Version(draft) });
        using (var scope = factory.Services.CreateScope()) {
            var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
            var item = await db.PriceResearch.SingleAsync();
            var assessment = JsonSerializer.Deserialize<GroundedMarketAssessment>(item.ResearchResultJson)!;
            if (expireResearch) assessment.ResearchTimestampUtc = DateTime.UtcNow.AddDays(-15);
            else foreach (var evidence in assessment.Evidence) evidence.Observation.ObservationDate = DateTime.UtcNow.AddDays(-91);
            typeof(PriceResearch).GetProperty(nameof(PriceResearch.ResearchResultJson))!.SetValue(item, JsonSerializer.Serialize(assessment));
            await db.SaveChangesAsync();
        }
        var publicEvidence = JsonDocument.Parse(await client.GetStringAsync("/api/v1/pricing/research/" + id + "/evidence")).RootElement;
        Assert.Equal(0, publicEvidence.GetProperty("evidence").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, (await Market(client)).ValueKind);
        var details = await client.GetStringAsync("/api/v1/admin/price-research/" + id);
        Assert.Contains("Public listing 1", details);
    }
    [Fact] public async Task GroundedResearchDetailsProtectBrokerContactsAndRetainOriginalAiWithAuditableDecisions() {
        using var factory = Factory(); using var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var draft = await Create(client); var id = Id(draft);
        var researched = await Send(client, id+"/research", new { version=Version(draft) });
        var originalAi = researched.GetProperty("research").GetRawText();
        var reviewed = await Send(client, id+"/broker-review", new { version=Version(researched), brokerName="Private Broker", brokerId="b1",
            contactReference="private-contact-123", brokerLocality="Bhavani", evidence="Independent local opinion from documented broker consultation.",
            observationCount=3, lowPerCent=400000, typicalPerCent=550000, highPerCent=650000, observedAtUtc=DateTime.UtcNow.AddDays(-1), evidenceType="BrokerMarketOpinion", landCategory=1 });
        var approved = await Send(client,id+"/decision",new {version=Version(reviewed),action="Approve",lowPerCent=400000,highPerCent=650000,validUntilUtc=DateTime.UtcNow.AddDays(20),notes="Reviewed as a broker opinion, not as a completed sale"});
        Assert.Equal(originalAi,approved.GetProperty("research").GetRawText());
        var details=JsonDocument.Parse(await client.GetStringAsync("/api/v1/admin/price-research/"+id)).RootElement;
        var broker=details.GetProperty("brokerObservations")[0];Assert.Equal("BrokerMarketOpinion",broker.GetProperty("sourceCategory").GetString());
        Assert.Equal(9.09m,broker.GetProperty("differencePercentage").GetDecimal());Assert.Equal("Approved",broker.GetProperty("verificationStatus").GetString());
        Assert.Contains("previousStatus",details.GetProperty("history").GetRawText());
        using var anonymous=factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync("/api/v1/admin/price-research/"+id)).StatusCode);
        var evidence=await anonymous.GetStringAsync("/api/v1/pricing/research/"+id+"/evidence");
        Assert.DoesNotContain("private-contact-123",evidence);Assert.DoesNotContain("Private Broker",evidence);
        Assert.Equal(3,JsonDocument.Parse(evidence).RootElement.GetProperty("evidence").GetArrayLength());
        var filtered=JsonDocument.Parse(await client.GetStringAsync("/api/v1/admin/price-research/?district=Erode&taluk=Bhavani&brokerStatus=Reviewed")).RootElement;
        Assert.Equal(1,filtered.GetArrayLength());
        using var scope=factory.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        Assert.Equal(3,await db.MarketResearchEvidence.CountAsync());Assert.Equal(0,await db.LandPriceRecords.CountAsync());
    }
    [Fact] public async Task CorrectionAndInsufficientDecisionsAreVersionedAndNeverPublishPrices() {
        using var factory=Factory();using var client=factory.CreateClient();client.DefaultRequestHeaders.Add("X-Admin-Key",AdminKey);
        var draft=await Create(client);var id=Id(draft);
        var corrected=await Send(client,id+"/decision",new{version=Version(draft),action="RequestCorrection",lowPerCent=0,highPerCent=0,validUntilUtc=DateTime.UtcNow,notes="Obtain reliable source dates and precise location evidence"});
        Assert.Equal("NeedsCorrection",corrected.GetProperty("status").GetString());
        var insufficient=await Send(client,id+"/decision",new{version=Version(corrected),action="InsufficientEvidence",lowPerCent=0,highPerCent=0,validUntilUtc=DateTime.UtcNow,notes="No adequate independent supporting evidence"});
        Assert.Equal("InsufficientEvidence",insufficient.GetProperty("status").GetString());Assert.Equal(JsonValueKind.Null,(await Market(client)).ValueKind);
    }
    [Fact] public async Task EligibleCompletedTransactionsPreventBillableFallbackResearch() {
        using var factory=Factory();using var client=factory.CreateClient();await SignInCustomer(factory,client);
        using(var scope=factory.Services.CreateScope()){
            var records=((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Transactions;
            for(var i=0;i<3;i++)records.Add(new LandPriceRecord(Guid.NewGuid(),"India","Tamil Nadu","Erode","Bhavani","Bhavani",null,"42/"+i,
                new Greenart.Domain.ValueObjects.GeoCoordinate(11.4471+i*.0001,77.684),Greenart.Domain.Enums.LandUsageType.Residential,
                new Greenart.Domain.ValueObjects.LandArea(5,Greenart.Domain.Enums.AreaUnit.Cent),2500000,Greenart.Domain.Enums.SourceCategory.VerifiedTransaction,
                "Registered conveyance evidence "+i,DateTime.UtcNow.AddDays(-30),Greenart.Domain.Enums.VerificationStatus.Verified));
        }
        using var response=await client.PostAsJsonAsync("/api/v1/pricing/research",MobileRequest());response.EnsureSuccessStatusCode();
        Assert.Equal("VerifiedTransactionsAvailable",JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("status").GetString());
        Assert.Equal(0,((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    [Fact] public async Task AuthorizedSourcesRequireAdminAndExplicitRights_AndDoNotRunGemini() {
        using var factory=Factory();using var client=factory.CreateClient();client.DefaultRequestHeaders.Add("X-Admin-Key",AdminKey);
        var draft=await Create(client);var id=Id(draft);
        object Sources(bool permission) => new { version=Version(draft), sources=Enumerable.Range(1,3).Select(i=>new { name="Client listing "+i,url="https://listings.example.com/plot-"+i,
            rightsReference="private client contract allowing retrieval storage and display",retrievalAndStorageAuthorized=permission,publicDisplayAuthorized=true }).ToArray() };
        using var anonymous=factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.PostAsJsonAsync("/api/v1/admin/price-research/"+id+"/sources",Sources(true))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsJsonAsync("/api/v1/admin/price-research/"+id+"/sources",Sources(false))).StatusCode);
        var registered=await Send(client,id+"/sources",Sources(true));
        Assert.Equal(3,registered.GetProperty("authorizedSources").GetArrayLength());
        Assert.Equal(id,registered.GetProperty("authorizedSources")[0].GetProperty("registeredForResearchId").GetString());
        Assert.Equal(0,((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
        var evidence=await anonymous.GetStringAsync("/api/v1/pricing/research/"+id+"/evidence");
        Assert.DoesNotContain("private client contract",evidence);
    }
    [Fact] public async Task NewSourceReferencesPreserveAlreadyAnalysedOriginalResults() {
        using var factory=Factory();using var client=factory.CreateClient();client.DefaultRequestHeaders.Add("X-Admin-Key",AdminKey);
        var draft=await Create(client);var id=Id(draft);var researched=await Send(client,id+"/research",new{version=Version(draft)});
        var original=researched.GetProperty("research").GetRawText();
        var followup=await Send(client,id+"/sources",new{version=Version(researched),sources=Enumerable.Range(1,3).Select(i=>new { name="Client source "+i,url="https://listings.example.com/plot-"+i,
            rightsReference="Client permission reference for retrieval storage analysis and public display",retrievalAndStorageAuthorized=true,publicDisplayAuthorized=true }).ToArray()});
        Assert.NotEqual(id,Id(followup));Assert.Equal(id,followup.GetProperty("supersedesResearchId").GetString());
        var details=JsonDocument.Parse(await client.GetStringAsync("/api/v1/admin/price-research/"+id)).RootElement;
        Assert.Equal(original,details.GetProperty("item").GetProperty("research").GetRawText());
        Assert.Equal(1,((FakeModels)factory.Services.GetRequiredService<IPriceResearchModels>()).Calls);
    }
    private class ResearchTestRepository(LandPriceDbContext db, FakeModels models) : Greenart.Infrastructure.Repositories.EfLandPriceRepository(db), ILandPriceRepository {
        public new Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, Greenart.Domain.Enums.LandUsageType usage, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<LandPriceRecord>>(models.Transactions.Where(x => x.LandUsage == usage && new Greenart.Domain.ValueObjects.GeoCoordinate(latitude, longitude).DistanceToMeters(x.Coordinates) <= radiusMeters).ToArray());
    }
    private class FakeModels : IPriceResearchModels, ILandMarketResearchService {
        public bool IsConfigured => Enabled;
        public List<LandPriceRecord> Transactions = [];
        public int Calls;
        public bool Enabled = true;
        public bool NoEstimate;
        public TaskCompletionSource<bool> Started = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource<bool>? Release;
        public IReadOnlyList<ResearchProviderStatus> GetStatus() => [new("OpenAI", Enabled), new("Claude", Enabled), new("Gemini", Enabled)];
        public async Task<GroundedResearchOutcome> AnalyzeAsync(LandResearchInput input, CancellationToken ct) {
            await ResearchAsync(new PriceResearch(input.Locality, input.District, input.Latitude, input.Longitude, input.LandUsage, input.RadiusMeters, input.RoadAccess, input.Context), ct);
            var a = new GroundedMarketAssessment { ResearchId = input.ResearchId, ModelName = "test-grounded-gemini", GroundingStatus = "AuthorizedSourcesRetrieved",
                Status = NoEstimate ? "InsufficientEvidence" : "PassedEvidenceReview", SourceCount = NoEstimate ? 0 : 3,
                LowPerCent = NoEstimate ? null : 400000m, HighPerCent = NoEstimate ? null : 600000m, TypicalPerCent = NoEstimate ? null : 500000m,
                TypicalPerSqFt = NoEstimate ? null : Math.Round(500000m/435.6m,2), AttemptedCalls = 1 };
            if (!NoEstimate) a.Evidence = Enumerable.Range(1,3).Select(i => new MarketEvidenceAssessment { Id = "e"+i,
                Observation = new MarketEvidenceCandidate { SourceCategory="AdvertisedAskingPrice", Currency="INR", SourceName="Public listing "+i, SourceUrl="https://example.com/listing-"+i,
                    LandCategory=1, Area=5, AreaUnit="Cent", AskingPrice=2500000, ObservationDate=DateTime.UtcNow.AddDays(-1), LocationDescription="Bhavani, Erode" },
                ResolvedUrl="https://example.com/listing-"+i, Status="EligibleAskingObservation", RetrievalStatus="Retrieved", RetrievedAtUtc=DateTime.UtcNow,
                AreaSqFt=2178, RatePerCent=500000, RatePerSqFt=Math.Round(500000m/435.6m,2) }).ToList();
            return new(a, new MarketEvidenceReview { ResearchId=input.ResearchId, Status=NoEstimate?"InsufficientEvidence":"PassedEvidenceReview", ReviewerModel="test-review",
                AcceptedEvidenceIds=NoEstimate?[]:["e1","e2","e3"], AttemptedCalls=NoEstimate?0:1 });
        }
        public async Task<IReadOnlyList<ModelPriceProposal>> ResearchAsync(PriceResearch research, CancellationToken ct) {
            Interlocked.Increment(ref Calls); Started.TrySetResult(true);
            if (Release != null) await Release.Task;
            return new[] { "OpenAI", "Claude", "Gemini" }.Select((p, i) =>
                new ModelPriceProposal(p, "test", NoEstimate ? "NoEstimate" : "Proposed", NoEstimate ? null : 400000 + i * 50000, NoEstimate ? null : 500000 + i * 50000, "Unvalidated hypothesis", [], DateTime.UtcNow)).ToArray();
        }
    }
}
