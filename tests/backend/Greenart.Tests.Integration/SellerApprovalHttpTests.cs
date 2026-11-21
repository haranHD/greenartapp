using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace Greenart.Tests.Integration;

public class SellerApprovalHttpTests
{
    private const string Listings = "/api/v1/marketplace/listings";
    private const string ReviewListings = "/api/v1/admin/marketplace/listings";
    private const string Apply = "/api/v1/sellers/apply";
    private const string Mine = "/api/v1/sellers/me";
    private const string Applications = "/api/v1/admin/sellers/applications";
    private const string AdminKey = "phase-two-test-only-key";

    [PostgreSqlFact]
    public async Task LegacyMarketplaceRequiresSellerApprovalAndFreshModerationAndHidesSuspendedSellers()
    {
        using var factory = CreateFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var seller = NewUser(legacyVerified: true);
        var buyer = NewUser();
        var admin = NewUser(UserRole.Administrator);
        var legacy = new MarketplaceListing(Guid.NewGuid(), "Legacy listing", "", seller.Id, "Bhavani", "Erode",
            "Tamil Nadu", new GeoCoordinate(11.44819, 77.68423), LandUsageType.Residential, 1, 435.6m,
            500000, 500000, 1147.84m, status: ListingStatus.Active, reviewedByUserId: admin.Id,
            streetAddress: "Private address", surveyNumber: "PRIVATE-SURVEY", moderationNotes: "Prior review notes");
        var enquiry = new ListingEnquiry(Guid.NewGuid(), legacy.Id, buyer.Id, "Existing message",
            submittedAtUtc: DateTime.UtcNow.AddDays(-2));
        var historicAudit = new AuditEvent(Guid.NewGuid(), "MarketplaceListing", legacy.Id, "ListingApproved", "Historical", "");
        db.AddRange(seller, buyer, admin, legacy, enquiry, historicAudit);
        await db.SaveChangesAsync();

        using var sellerClient = Client(factory, seller);
        using var buyerClient = Client(factory, buyer);
        using var adminClient = Client(factory, admin);
        using var anonymous = factory.CreateClient();
        using var keyOnly = factory.CreateClient();
        keyOnly.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        using var noAuth = await anonymous.PostAsJsonAsync(Listings, Listing());
        Assert.Equal(HttpStatusCode.Unauthorized, noAuth.StatusCode);
        Assert.Equal("NotApplied", (await Get(sellerClient, Mine)).GetProperty("status").GetString());
        await Post(sellerClient, Listings, Listing(), HttpStatusCode.Forbidden);
        await Post(keyOnly, $"{ReviewListings}/{legacy.Id}/review", new { action = "Approve" }, HttpStatusCode.Unauthorized);
        await Post(adminClient, $"{ReviewListings}/{legacy.Id}/review", new { action = "Approve" }, HttpStatusCode.Conflict);
        await AssertHidden(anonymous, buyerClient, legacy.Id);

        var application = await Post(sellerClient, Apply, Application(), HttpStatusCode.Created);
        var (id, version) = ApplicationId(application);
        await Post(sellerClient, Apply, Application(), HttpStatusCode.Conflict);
        await Post(sellerClient, Listings, Listing(), HttpStatusCode.Forbidden);
        var queue = await Get(adminClient, $"{Applications}?status=PendingReview");
        Assert.Single(queue.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetGuid() == id);
        await Patch(adminClient, $"{Applications}/{id}", new { decision = "Approved", version }, HttpStatusCode.OK);
        await AssertHidden(anonymous, buyerClient, legacy.Id);
        var reReview = Assert.Single((await Get(adminClient, $"{ReviewListings}/pending")).EnumerateArray(),
            item => item.GetProperty("id").GetGuid() == legacy.Id);
        Assert.Equal("PendingReview", reReview.GetProperty("status").GetString());

        seller.UpdateAccountStatus(AccountStatus.Suspended);
        await db.SaveChangesAsync();
        await Post(sellerClient, Listings, Listing(), HttpStatusCode.Forbidden);
        seller.UpdateAccountStatus(AccountStatus.Active);
        await db.SaveChangesAsync();

        var pending = await Post(sellerClient, Listings, Listing(), HttpStatusCode.Created);
        var pendingId = pending.GetProperty("id").GetGuid();
        Assert.Equal(seller.Id, pending.GetProperty("sellerId").GetGuid());
        Assert.Equal("PendingReview", pending.GetProperty("status").GetString());
        await AssertHidden(anonymous, buyerClient, pendingId);

        await Post(adminClient, $"{ReviewListings}/{legacy.Id}/review", new { action = "Approve", notes = "Updated review" },
            HttpStatusCode.OK);
        var publicListing = await Get(anonymous, $"{Listings}/{legacy.Id}");
        Assert.Equal(JsonValueKind.Null, publicListing.GetProperty("sellerPhone").ValueKind);
        Assert.Equal(JsonValueKind.Null, publicListing.GetProperty("surveyNumber").ValueKind);
        Assert.Equal(JsonValueKind.Null, publicListing.GetProperty("streetAddress").ValueKind);
        Assert.Equal(11.45, publicListing.GetProperty("latitude").GetDouble());
        Assert.Empty((await Get(anonymous, $"{Listings}?search=PRIVATE-SURVEY")).EnumerateArray());
        await Post(buyerClient, $"{Listings}/{legacy.Id}/enquiries", new { message = "Is it available?" }, HttpStatusCode.Created);

        await Patch(adminClient, $"/api/v1/admin/sellers/{seller.Id}/suspend",
            new { reason = "Verification expired." }, HttpStatusCode.OK);
        Assert.Equal("Suspended", (await Get(sellerClient, Mine)).GetProperty("status").GetString());
        await Post(sellerClient, Listings, Listing(), HttpStatusCode.Forbidden);
        await Post(adminClient, $"{ReviewListings}/{pendingId}/review", new { action = "Approve" }, HttpStatusCode.Conflict);
        await AssertHidden(anonymous, buyerClient, legacy.Id);
        Assert.Equal(2, (await Get(sellerClient, $"{Listings}/my")).GetArrayLength());

        db.ChangeTracker.Clear();
        var stored = await db.MarketplaceListings.FindAsync(legacy.Id);
        Assert.Equal(ListingStatus.Active, stored!.Status);
        Assert.Equal(admin.Id, stored.ReviewedByUserId);
        Assert.Equal(id, stored.ReviewedSellerApplicationId);
        Assert.NotNull(await db.ListingEnquiries.FindAsync(enquiry.Id));
        Assert.NotNull(await db.AuditEvents.FindAsync(historicAudit.Id));
        var legacyReview = await db.AuditEvents.SingleAsync(e => e.EntityId == legacy.Id && e.Action == "LegacyListingReviewPreserved");
        Assert.Contains("Prior review notes", legacyReview.Details);
        Assert.Equal(0, await db.LandPriceRecords.CountAsync());
    }

    [PostgreSqlFact]
    public async Task SellerDecisionsUseCurrentAdminIdentityAndVersionAndKeepPrivateNotesPrivate()
    {
        using var factory = CreateFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var applicant = NewUser(UserRole.Administrator);
        var admin = NewUser(UserRole.Administrator);
        var demoted = NewUser(UserRole.Administrator);
        var suspended = NewUser(UserRole.Administrator, accountStatus: AccountStatus.Suspended);
        var customer = NewUser();
        db.AddRange(applicant, admin, demoted, suspended, customer);
        await db.SaveChangesAsync();

        using var applicantClient = Client(factory, applicant);
        using var adminClient = Client(factory, admin);
        using var staleAdminClient = Client(factory, demoted);
        using var suspendedAdminClient = Client(factory, suspended);
        using var customerClient = Client(factory, customer);
        using var keyOnly = factory.CreateClient();
        keyOnly.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        demoted.UpdateRole(UserRole.Customer);
        await db.SaveChangesAsync();

        var (id, version) = ApplicationId(await Post(applicantClient, Apply, Application(), HttpStatusCode.Created));
        var approve = new { decision = "Approved", version };
        var path = $"{Applications}/{id}";
        await Patch(applicantClient, path, approve, HttpStatusCode.Forbidden);
        await Patch(customerClient, path, approve, HttpStatusCode.Forbidden);
        await Patch(staleAdminClient, path, approve, HttpStatusCode.Forbidden);
        await Patch(suspendedAdminClient, path, approve, HttpStatusCode.Forbidden);
        await Patch(keyOnly, path, approve, HttpStatusCode.Unauthorized);
        await Patch(customerClient, $"{Mine}/application", Application(version), HttpStatusCode.Conflict);

        await Patch(adminClient, path, new
        {
            decision = "NeedsInformation", version, applicantFeedback = "Confirm district", reviewNotes = "Internal note"
        }, HttpStatusCode.OK);
        var mine = await Get(applicantClient, Mine);
        Assert.Equal("NeedsInformation", mine.GetProperty("status").GetString());
        Assert.DoesNotContain("Internal note", mine.GetRawText());
        Assert.Equal(admin.Id, (await Get(adminClient, path)).GetProperty("reviewedByUserId").GetGuid());
        await Patch(applicantClient, $"{Mine}/application", Application(version), HttpStatusCode.Conflict);
        var (_, correctedVersion) = ApplicationId(await Patch(applicantClient, $"{Mine}/application",
            Application(version + 1), HttpStatusCode.OK));
        await Patch(adminClient, path, approve, HttpStatusCode.Conflict);

        await Patch(adminClient, path, new { decision = "Rejected", version = correctedVersion, applicantFeedback = "Insufficient information" },
            HttpStatusCode.OK);
        var (newId, _) = ApplicationId(await Post(applicantClient, Apply, Application(), HttpStatusCode.Created));
        Assert.NotEqual(id, newId);
        var historical = await Get(adminClient, path);
        Assert.Equal("Rejected", historical.GetProperty("application").GetProperty("status").GetString());
        var decisions = historical.GetProperty("history").EnumerateArray()
            .Where(entry => entry.GetProperty("action").GetString() == "SellerApplicationReviewed").ToArray();
        Assert.Equal(2, decisions.Length);
        Assert.All(decisions, entry => Assert.Equal(admin.Id.ToString(), entry.GetProperty("performedBy").GetString()));
    }

    [PostgreSqlFact]
    public async Task ConcurrentApplicationsAndDecisionsCommitOnceOnPostgreSql()
    {
        using var factory = CreateFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var applicant = NewUser();
        var admin = NewUser(UserRole.Administrator);
        db.AddRange(applicant, admin);
        await db.SaveChangesAsync();
        using var sellerClient = Client(factory, applicant);
        using var adminClient = Client(factory, admin);

        var applyResults = await Task.WhenAll(sellerClient.PostAsJsonAsync(Apply, Application()),
            sellerClient.PostAsJsonAsync(Apply, Application()));
        try
        {
            Assert.Single(applyResults, result => result.StatusCode == HttpStatusCode.Created);
            Assert.Single(applyResults, result => result.StatusCode == HttpStatusCode.Conflict);
        }
        finally
        {
            foreach (var result in applyResults)
                result.Dispose();
        }

        var (id, version) = ApplicationId(await Get(sellerClient, Mine));
        var approve = new { decision = "Approved", version };
        var reviews = await Task.WhenAll(adminClient.PatchAsJsonAsync($"{Applications}/{id}", approve),
            adminClient.PatchAsJsonAsync($"{Applications}/{id}", approve));
        try
        {
            Assert.Single(reviews, result => result.StatusCode == HttpStatusCode.OK);
            Assert.Single(reviews, result => result.StatusCode == HttpStatusCode.Conflict);
        }
        finally
        {
            foreach (var result in reviews)
                result.Dispose();
        }
        Assert.Equal(1, await db.SellerApplications.CountAsync(a => a.UserId == applicant.Id));
        Assert.Equal(1, await db.AuditEvents.CountAsync(a => a.EntityId == id && a.Action == "SellerApplicationReviewed"));
    }

    private sealed class PostgreSqlFactAttribute : FactAttribute
    {
        public PostgreSqlFactAttribute()
        {
            if (Environment.GetEnvironmentVariable("GREENART_PHASE2_TEST_DB") is null)
                Skip = "Requires the migrated disposable Phase 2 PostgreSQL database.";
        }
    }

    private static WebApplicationFactory<Program> CreateFactory()
    {
        var testConnection = Environment.GetEnvironmentVariable("GREENART_PHASE2_TEST_DB");
        if (testConnection is not null)
        {
            var connection = new NpgsqlConnectionStringBuilder(testConnection);
            if (!connection.Host!.StartsWith("/tmp/greenart-phase2.", StringComparison.Ordinal) ||
                connection.Database != "greenart_phase2_test")
                throw new InvalidOperationException("Phase 2 database tests require the disposable PostgreSQL cluster.");
        }

        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "SellerApprovalTestOnlySigningKeyWithMoreThan32Characters!");
            builder.UseSetting("ADMIN_API_KEY", AdminKey);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<LandPriceDbContext>();
                services.AddScoped(_ =>
                {
                    var options = new DbContextOptionsBuilder<LandPriceDbContext>();
                    options.UseNpgsql(testConnection!, o => o.UseNetTopologySuite());
                    return new LandPriceDbContext(options.Options);
                });
            });
        });
    }

    private static User NewUser(UserRole role = UserRole.Customer, bool legacyVerified = false,
        AccountStatus accountStatus = AccountStatus.Active)
    {
        var id = Guid.NewGuid();
        return new User(id, $"{id}@example.test", "Test account", id.ToString(), phoneNumber: "5550100",
            role: role, accountStatus: accountStatus, isSellerVerified: legacyVerified);
    }

    private static HttpClient Client(WebApplicationFactory<Program> factory, User user)
    {
        var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenService.GenerateAccessToken(user));
        return client;
    }

    private static object Application(int? version = null) => new
    {
        applicantName = "Test applicant", sellerType = "IndividualOwner", contactInformation = "seller@example.test",
        operatingDistrict = "Erode", declaresAccuracy = true, version
    };

    private static object Listing() => new
    {
        title = "Test listing", description = "Test property", locality = "Bhavani", district = "Erode",
        latitude = 11.44819, longitude = 77.68423, landUsage = "Residential", extentCent = 1, askingPriceTotal = 500000
    };

    private static (Guid Id, int Version) ApplicationId(JsonElement result)
    {
        var application = result.GetProperty("application");
        return (application.GetProperty("id").GetGuid(), application.GetProperty("version").GetInt32());
    }

    private static async Task AssertHidden(HttpClient anonymous, HttpClient buyer, Guid id)
    {
        using var detail = await anonymous.GetAsync($"{Listings}/{id}");
        Assert.Equal(HttpStatusCode.NotFound, detail.StatusCode);
        Assert.DoesNotContain((await Get(anonymous, Listings)).EnumerateArray(), item => item.GetProperty("id").GetGuid() == id);
        await Post(buyer, $"{Listings}/{id}/enquiries", new { message = "Is it available?" }, HttpStatusCode.NotFound);
    }

    private static Task<JsonElement> Get(HttpClient client, string path) =>
        Read(client.GetAsync(path), HttpStatusCode.OK);

    private static Task<JsonElement> Post(HttpClient client, string path, object input, HttpStatusCode expected) =>
        Read(client.PostAsJsonAsync(path, input), expected);

    private static Task<JsonElement> Patch(HttpClient client, string path, object input, HttpStatusCode expected) =>
        Read(client.PatchAsJsonAsync(path, input), expected);

    private static async Task<JsonElement> Read(Task<HttpResponseMessage> responseTask, HttpStatusCode expected)
    {
        using var response = await responseTask;
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expected, $"Expected {expected}, got {response.StatusCode}. {body}");
        if (!response.IsSuccessStatusCode)
            return default;
        using var json = JsonDocument.Parse(body);
        return json.RootElement.Clone();
    }
}
