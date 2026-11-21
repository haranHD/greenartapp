using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using SkiaSharp;

namespace Greenart.Tests.Integration;

public class PropertyWorkflowHttpTests
{
    private const string Properties = "/api/v1/properties";
    private const string Owner = "/api/v1/sellers/me";
    private const string Admin = "/api/v1/admin/properties";
    private const string TestDatabaseKey = "GREENART_PHASE3_TEST_DB";

    // A one-pixel RGB photo with a tEXt metadata chunk, generated solely as a test fixture.
    private static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAD3RFWHRDb21tZW50AFBSSVZBVEV/qbl9AAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC");

    [PostGisFact]
    public async Task DraftsAreVersionedOwnedAndReviewedAndAskingPricesStayOutsideValuation()
    {
        using var factory = CreateFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var (seller, other, buyer, admin) = await Seed(db);
        using var sellerClient = Client(factory, seller);
        using var otherClient = Client(factory, other);
        using var buyerClient = Client(factory, buyer);
        using var adminClient = Client(factory, admin);
        using var anonymous = factory.CreateClient();

        await Post(anonymous, Properties, new { }, HttpStatusCode.Unauthorized);
        await Post(buyerClient, Properties, new { }, HttpStatusCode.Forbidden);
        var requestId = Guid.NewGuid();
        var draft = await Post(sellerClient, Properties, new { requestId }, HttpStatusCode.Created);
        var id = Id(draft);
        Assert.Equal(id, Id(await Post(sellerClient, Properties, new { requestId }, HttpStatusCode.OK)));
        Assert.Equal("Draft", draft.GetProperty("moderationStatus").GetString());
        await Post(sellerClient, $"{Properties}/{id}/submit", new { version = 1 }, HttpStatusCode.BadRequest);
        await Patch(otherClient, $"{Properties}/{id}", Revision("Other", version: 1), HttpStatusCode.NotFound);
        await Patch(sellerClient, $"{Properties}/{id}", Revision("Draft plot", version: 0), HttpStatusCode.Conflict);

        var revision = Revision("Draft plot", version: 1);
        var attempts = await Task.WhenAll(sellerClient.PatchAsJsonAsync($"{Properties}/{id}", revision),
            sellerClient.PatchAsJsonAsync($"{Properties}/{id}", revision));
        using var written = Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.OK);
        using var stale = Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.Conflict);
        var edited = await written.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(435.6m, edited.GetProperty("listing").GetProperty("extentSqFt").GetDecimal());
        Assert.Equal(500000m, edited.GetProperty("listing").GetProperty("askingRatePerCent").GetDecimal());
        Assert.Equal(50000000m, edited.GetProperty("listing").GetProperty("askingRatePerAcre").GetDecimal());
        Assert.Equal("AdvertisedAskingPrice", edited.GetProperty("listing").GetProperty("priceCategory").GetString());
        var pending = await Submit(sellerClient, id, Version(edited));
        await Get(anonymous, $"{Properties}/{id}", HttpStatusCode.NotFound);
        await Patch(otherClient, $"{Admin}/{id}/moderation", new { action = "Approve", version = Version(pending) }, HttpStatusCode.Forbidden);
        await Patch(adminClient, $"{Admin}/{id}/moderation", new { action = "Approve", version = Version(edited) }, HttpStatusCode.Conflict);
        await Post(adminClient, $"/api/v1/admin/marketplace/listings/{id}/review", new { action = "Approve" }, HttpStatusCode.Conflict);

        var changes = await Patch(adminClient, $"{Admin}/{id}/moderation",
            new { action = "RequestChanges", reason = "Clarify road access.", version = Version(pending) }, HttpStatusCode.OK);
        Assert.Equal("NeedsChanges", changes.GetProperty("moderationStatus").GetString());
        var revised = await Patch(sellerClient, $"{Properties}/{id}", Revision("Road access confirmed", 600000, Version(changes)),
            HttpStatusCode.OK);
        var published = await Publish(adminClient, id, Version(await Submit(sellerClient, id, Version(revised))));
        var publiclyVisible = await Get(anonymous, $"{Properties}/{id}");
        Assert.Equal(600000m, publiclyVisible.GetProperty("askingPriceTotal").GetDecimal());
        Assert.Equal(11.45, publiclyVisible.GetProperty("latitude").GetDouble());
        Assert.DoesNotContain("PRIVATE-SURVEY", publiclyVisible.GetRawText());
        Assert.False(publiclyVisible.TryGetProperty("sellerPhone", out _));
        Assert.False(publiclyVisible.TryGetProperty("privateDetails", out _));

        var duplicate = await Post(sellerClient, Properties, Revision("Same parcel"), HttpStatusCode.Created);
        await Post(sellerClient, $"{Properties}/{Id(duplicate)}/submit", new { version = Version(duplicate) }, HttpStatusCode.Conflict);
        var changed = await Patch(sellerClient, $"{Properties}/{id}", Revision("Price changed", 700000, Version(published)),
            HttpStatusCode.OK);
        await Get(anonymous, $"{Properties}/{id}", HttpStatusCode.NotFound);
        var republished = await Publish(adminClient, id, Version(await Submit(sellerClient, id, Version(changed))));
        var negotiating = await Patch(sellerClient, $"{Owner}/properties/{id}/sale-status",
            new { version = Version(republished), saleStatus = "UnderNegotiation" }, HttpStatusCode.OK);
        await Get(anonymous, $"{Properties}/{id}");
        var sold = await Patch(sellerClient, $"{Owner}/properties/{id}/sale-status",
            new { version = Version(negotiating), saleStatus = "Sold" }, HttpStatusCode.OK);
        Assert.Equal("Published", sold.GetProperty("moderationStatus").GetString());
        Assert.Equal("Sold", sold.GetProperty("saleStatus").GetString());
        await Get(anonymous, $"{Properties}/{id}", HttpStatusCode.NotFound);
        await Patch(sellerClient, $"{Owner}/properties/{id}/sale-status", new { version = Version(sold), saleStatus = "Available" },
            HttpStatusCode.Conflict);

        var review = await Get(adminClient, $"{Admin}/{id}");
        Assert.Equal(500000m, review.GetProperty("originalAskingPrice").GetDecimal());
        var history = review.GetProperty("priceHistory").EnumerateArray().Select(entry => entry.GetProperty("newPrice").GetDecimal());
        Assert.Equal(new[] { 700000m, 600000m, 500000m }, history.ToArray());
        Assert.Contains(review.GetProperty("moderationHistory").EnumerateArray(), entry =>
            entry.GetProperty("actorUserId").GetGuid() == admin.Id);
        var anchor = await Post(sellerClient, "/api/v1/marketplace/listings", new
        {
            title = "Unresolved regional anchor", locality = "Bhavani", district = "Erode",
            latitude = 11.0168, longitude = 76.9558, landUsage = "Residential", extentCent = 1, askingPriceTotal = 800000
        }, HttpStatusCode.Created);
        Assert.Equal("PendingReview", anchor.GetProperty("status").GetString());
        await Patch(adminClient, $"{Admin}/{Id(anchor)}/moderation",
            new { action = "Approve", version = Version(anchor) }, HttpStatusCode.Conflict);
        Assert.Empty(await db.LandPriceRecords.ToListAsync());
        Assert.Empty(await db.MarketResearchEvidence.ToListAsync());
    }

    [PostGisFact]
    public async Task PhotosRequireReviewAndDocumentsRemainPrivateAndDownloadsAreBoundToListing()
    {
        using var factory = CreateFactory();
        using var scope = factory.Services.CreateScope();
        var (seller, other, _, admin) = await Seed(scope.ServiceProvider.GetRequiredService<LandPriceDbContext>());
        using var sellerClient = Client(factory, seller);
        using var otherClient = Client(factory, other);
        using var adminClient = Client(factory, admin);
        using var anonymous = factory.CreateClient();

        var draft = await Post(sellerClient, Properties, Revision("Media plot"), HttpStatusCode.Created);
        var id = Id(draft);
        await Upload(otherClient, id, 1, "Photo", Png, "image/png", HttpStatusCode.NotFound);
        await Upload(sellerClient, id, 1, "Photo", new byte[5 * 1024 * 1024 + 1], "image/png", HttpStatusCode.RequestEntityTooLarge);
        await Upload(sellerClient, id, 1, "Photo", "bad image"u8.ToArray(), "image/png", HttpStatusCode.BadRequest);
        await Upload(sellerClient, id, 1, "Photo", Png, "image/svg+xml", HttpStatusCode.UnsupportedMediaType);
        var first = await Upload(sellerClient, id, 1, "Photo", Png, "image/png", HttpStatusCode.Created);
        var photo = first.GetProperty("media");
        var photoUrl = photo.GetProperty("url").GetString()!;
        await Get(anonymous, photoUrl, HttpStatusCode.NotFound);
        await Get(otherClient, photoUrl, HttpStatusCode.NotFound);
        using var jpegBitmap = new SKBitmap(2, 1);
        jpegBitmap.Erase(SKColors.Red);
        using var jpeg = jpegBitmap.Encode(SKEncodedImageFormat.Jpeg, 90);
        var second = await Upload(sellerClient, id, Version(first), "Photo", jpeg.ToArray(), "image/jpeg", HttpStatusCode.Created);
        var cover = Id(second.GetProperty("media"));
        var ordered = await Patch(sellerClient, $"{Properties}/{id}/media",
            new { version = Version(second), coverId = cover, photoIds = new[] { cover, Id(photo) } }, HttpStatusCode.OK);
        var pdf = "%PDF-1.4\nfixture\n%%EOF\n"u8.ToArray();
        var document = await Upload(sellerClient, id, Version(ordered), "VerificationDocument", pdf, "application/pdf", HttpStatusCode.Created);
        var documentUrl = document.GetProperty("media").GetProperty("url").GetString()!;
        await Get(otherClient, documentUrl, HttpStatusCode.NotFound);
        using var adminDownload = await adminClient.GetAsync(documentUrl);
        Assert.Equal(HttpStatusCode.OK, adminDownload.StatusCode);
        Assert.Equal("attachment", adminDownload.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("application/octet-stream", adminDownload.Content.Headers.ContentType?.MediaType);

        var published = await Publish(adminClient, id, Version(await Submit(sellerClient, id, Version(document))));
        var detail = await Get(anonymous, $"{Properties}/{id}");
        Assert.Equal(cover, Id(detail.GetProperty("photos")[0]));
        Assert.Equal(2, detail.GetProperty("photos").GetArrayLength());
        var jpegUrl = detail.GetProperty("photos")[0].GetProperty("url").GetString()!;
        using var jpegDownload = await anonymous.GetAsync(jpegUrl);
        Assert.Equal(HttpStatusCode.OK, jpegDownload.StatusCode);
        Assert.Equal("image/jpeg", jpegDownload.Content.Headers.ContentType?.MediaType);
        await Get(anonymous, documentUrl, HttpStatusCode.NotFound);
        await Get(anonymous, $"{Properties}/{Guid.NewGuid()}/media/{Id(photo)}", HttpStatusCode.NotFound);
        using var download = await anonymous.GetAsync(photoUrl);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("image/png", download.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain("PRIVATE", Encoding.ASCII.GetString(await download.Content.ReadAsByteArrayAsync()));
        Assert.True(download.Headers.CacheControl?.NoStore);

        await Send(sellerClient.DeleteAsync($"{Properties}/{id}/media/{cover}?version={Version(published)}"), HttpStatusCode.OK);
        await Get(anonymous, photoUrl, HttpStatusCode.NotFound);
        await Get(anonymous, $"{Properties}/{id}", HttpStatusCode.NotFound);
        var owned = await Get(sellerClient, $"{Owner}/properties/{id}");
        Assert.True(owned.GetProperty("listing").GetProperty("photos")[0].GetProperty("isCover").GetBoolean());
    }

    [PostGisFact]
    public async Task MapFiltersOnlyPublicCoordinatesAndBuyerActionsArePrivateAndRateLimited()
    {
        using var factory = CreateFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LandPriceDbContext>();
        var (seller, other, buyer, admin) = await Seed(db);
        using var sellerClient = Client(factory, seller);
        using var otherClient = Client(factory, other);
        using var buyerClient = Client(factory, buyer);
        using var adminClient = Client(factory, admin);
        using var anonymous = factory.CreateClient();

        var district = $"Map test {seller.Id:N}";
        var draft = await Post(sellerClient, Properties, Revision("Nearby test", 900000, district: district), HttpStatusCode.Created);
        var id = Id(draft);
        var distant = await Post(sellerClient, Properties, Revision("Distant test", district: district, latitude: 12.25,
            survey: "DISTANT"), HttpStatusCode.Created);
        var distantId = Id(distant);
        await Publish(adminClient, id, Version(await Submit(sellerClient, id, Version(draft))));
        await Publish(adminClient, distantId, Version(await Submit(sellerClient, distantId, Version(distant))));
        var filter = $"district={Uri.EscapeDataString(district)}";
        var discovery = await Get(anonymous, $"{Properties}?{filter}&sort=PriceAscending&pageSize=1");
        Assert.Equal(distantId, Id(discovery.GetProperty("items")[0]));
        Assert.True(discovery.GetProperty("hasMore").GetBoolean());
        Assert.Equal(id, Id((await Get(anonymous, $"{Properties}?{filter}&sort=PriceAscending&pageSize=1&page=2"))
            .GetProperty("items")[0]));
        Assert.Empty((await Get(anonymous, $"{Properties}?{filter}&maxAreaCent=0.5")).GetProperty("items").EnumerateArray());
        Assert.Empty((await Get(anonymous, $"{Properties}?{filter}&search=PRIVATE-SURVEY")).GetProperty("items").EnumerateArray());

        var approximate = await Get(anonymous,
            $"{Properties}/map?{filter}&latitude=11.45&longitude=77.68&radiusMeters=50");
        Assert.Equal(id, Id(Assert.Single(approximate.GetProperty("items").EnumerateArray())));
        var exact = await Get(anonymous,
            $"{Properties}/map?{filter}&latitude=11.44819&longitude=77.68423&radiusMeters=50");
        Assert.Empty(exact.GetProperty("items").EnumerateArray());

        await Post(anonymous, $"{Properties}/{id}/enquiries", new { message = "Hello" }, HttpStatusCode.Unauthorized);
        var enquiry = await Post(buyerClient, $"{Properties}/{id}/enquiries", new { message = "Hello" }, HttpStatusCode.Created);
        await Post(buyerClient, $"/api/v1/marketplace/listings/{id}/enquiries", new { message = "hello" }, HttpStatusCode.Conflict);
        await Post(buyerClient, $"{Properties}/{id}/enquiries", new { message = "Another question" }, HttpStatusCode.TooManyRequests);
        var visible = Assert.Single((await Get(sellerClient, $"{Owner}/enquiries")).GetProperty("items").EnumerateArray());
        Assert.Equal(Id(enquiry), Id(visible));
        Assert.Equal("", visible.GetProperty("buyerEmail").GetString());
        Assert.Equal(JsonValueKind.Null, visible.GetProperty("buyerPhone").ValueKind);
        Assert.Empty((await Get(otherClient, $"{Owner}/enquiries")).GetProperty("items").EnumerateArray());
        await Patch(otherClient, $"{Owner}/enquiries/{Id(enquiry)}", new { status = "Contacted" }, HttpStatusCode.NotFound);
        await Patch(sellerClient, $"{Owner}/enquiries/{Id(enquiry)}", new { status = "Contacted" }, HttpStatusCode.OK);
        await Post(buyerClient, $"{Properties}/{distantId}/enquiries",
            new { message = "Please contact me.", shareContact = true }, HttpStatusCode.Created);
        Assert.Contains((await Get(sellerClient, $"{Owner}/enquiries")).GetProperty("items").EnumerateArray(),
            row => row.GetProperty("buyerEmail").GetString() == buyer.Email);

        await Post(buyerClient, $"{Properties}/{id}/favourite", new { }, HttpStatusCode.NoContent);
        await Post(buyerClient, $"{Properties}/{id}/favourite", new { }, HttpStatusCode.NoContent);
        Assert.Single((await Get(buyerClient, "/api/v1/users/me/favourites")).GetProperty("items").EnumerateArray());
        Assert.Empty((await Get(otherClient, "/api/v1/users/me/favourites")).GetProperty("items").EnumerateArray());
        await Post(buyerClient, $"{Properties}/{id}/reports", new { reason = "Check this listing." }, HttpStatusCode.Created);
        await Post(buyerClient, $"{Properties}/{id}/reports", new { reason = "Duplicate" }, HttpStatusCode.Conflict);
        Assert.Single((await Get(adminClient, $"{Admin}/reports?listingId={id}")).GetProperty("items").EnumerateArray());

        await Patch(adminClient, $"/api/v1/admin/sellers/{seller.Id}/suspend", new { reason = "Review verification." }, HttpStatusCode.OK);
        await Get(anonymous, $"{Properties}/{id}", HttpStatusCode.NotFound);
        await Post(buyerClient, $"{Properties}/{id}/enquiries", new { message = "Still visible?" }, HttpStatusCode.NotFound);
        Assert.Empty((await Get(buyerClient, "/api/v1/users/me/favourites")).GetProperty("items").EnumerateArray());
        await Post(sellerClient, Properties, new { }, HttpStatusCode.Forbidden);
    }

    private static async Task<(User Seller, User Other, User Buyer, User Admin)> Seed(LandPriceDbContext db)
    {
        var seller = UserFor(UserRole.Customer);
        var other = UserFor(UserRole.Customer);
        var buyer = UserFor(UserRole.Customer);
        var admin = UserFor(UserRole.Administrator);
        db.AddRange(seller, other, buyer, admin);
        foreach (var user in new[] { seller, other })
        {
            var now = DateTime.UtcNow;
            var details = new SellerApplicationDetails("Seller", SellerType.IndividualOwner, user.Email, "Erode", null, null, null, true);
            var application = new SellerApplication(user.Id, details, now);
            var profile = new SellerProfile(application, now);
            application.Review(admin.Id, SellerStatus.Approved, null, null, now);
            profile.TrackApplication(application, now);
            db.AddRange(application, profile);
        }
        await db.SaveChangesAsync();
        return (seller, other, buyer, admin);
    }

    private static WebApplicationFactory<Program> CreateFactory()
    {
        var connection = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable(TestDatabaseKey)!);
        if (!connection.Host!.StartsWith("/tmp/greenart-phase2.", StringComparison.Ordinal) ||
            connection.Database != "greenart_phase3_test")
            throw new InvalidOperationException("Use the disposable PostGIS database for Phase 3 integration tests.");

        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "PropertyWorkflowTestOnlySigningKeyWithMoreThan32Characters!");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<LandPriceDbContext>();
                services.AddScoped(_ => new LandPriceDbContext(new DbContextOptionsBuilder<LandPriceDbContext>()
                    .UseNpgsql(connection.ConnectionString, o => o.UseNetTopologySuite()).Options));
            });
        });
    }

    private sealed class PostGisFactAttribute : FactAttribute
    {
        public PostGisFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(TestDatabaseKey)))
                Skip = "Requires the disposable, migrated Phase 3 PostGIS database.";
        }
    }

    private static User UserFor(UserRole role)
    {
        var id = Guid.NewGuid();
        return new User(id, $"{id}@example.test", "Property Test Account", id.ToString(), phoneNumber: "5550100", role: role);
    }

    private static HttpClient Client(WebApplicationFactory<Program> factory, User user)
    {
        var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<ITokenService>().GenerateAccessToken(user);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static PropertyDraftRequest Revision(string title, decimal price = 500000, int? version = null,
        string district = "Erode", double latitude = 11.44819, string survey = "PRIVATE-SURVEY") =>
        new(Title: title, Description: "A reference plot for integration testing.", District: district, Locality: "Bhavani",
            Latitude: latitude, Longitude: 77.68423, StreetAddress: "Private address", SurveyNumber: survey,
            LandUsage: LandUsageType.Residential, SellerRelationship: "Owner", Area: 1, AreaUnit: AreaUnit.Cent,
            AskingPriceTotal: price, Version: version);

    private static Task<JsonElement> Submit(HttpClient client, Guid id, int version) =>
        Post(client, $"{Properties}/{id}/submit", new { version }, HttpStatusCode.OK);

    private static Task<JsonElement> Publish(HttpClient client, Guid id, int version) =>
        Patch(client, $"{Admin}/{id}/moderation", new { action = "Approve", version }, HttpStatusCode.OK);

    private static async Task<JsonElement> Upload(HttpClient client, Guid id, int version, string kind,
        byte[] bytes, string type, HttpStatusCode expected)
    {
        using var body = new ByteArrayContent(bytes);
        body.Headers.ContentType = new MediaTypeHeaderValue(type);
        return await Send(client.PostAsync($"{Properties}/{id}/media?version={version}&kind={kind}", body), expected);
    }

    private static Guid Id(JsonElement value) => value.GetProperty("id").GetGuid();
    private static int Version(JsonElement value) => value.GetProperty("version").GetInt32();

    private static Task<JsonElement> Get(HttpClient client, string route, HttpStatusCode status = HttpStatusCode.OK) =>
        Send(client.GetAsync(route), status);

    private static Task<JsonElement> Post(HttpClient client, string route, object body, HttpStatusCode status) =>
        Send(client.PostAsJsonAsync(route, body), status);

    private static Task<JsonElement> Patch(HttpClient client, string route, object body, HttpStatusCode status) =>
        Send(client.PatchAsJsonAsync(route, body), status);

    private static async Task<JsonElement> Send(Task<HttpResponseMessage> task, HttpStatusCode status)
    {
        using var response = await task;
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == status, $"Expected {status}, got {response.StatusCode}. {body}");
        if (body.Length == 0 || !response.IsSuccessStatusCode)
            return default;
        using var json = JsonDocument.Parse(body);
        return json.RootElement.Clone();
    }
}
