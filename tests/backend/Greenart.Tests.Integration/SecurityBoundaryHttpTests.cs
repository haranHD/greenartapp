using System.Net;
using System.Net.Http.Json;
using Greenart.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Greenart.Tests.Integration;

public class SecurityBoundaryHttpTests
{
    private static WebApplicationFactory<Program> CreateFactory(string origins = "https://client.example") =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "SecurityBoundaryTestOnlySigningKeyWith32Characters!");
            builder.UseSetting("ALLOWED_CORS_ORIGINS", origins);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<LandPriceDbContext>();
                // Deliberately unavailable persistence, without contacting any database.
                services.AddScoped(_ => new LandPriceDbContext(new DbContextOptions<LandPriceDbContext>()));
            });
        });

    [Theory]
    [InlineData("https://client.example", true)]
    [InlineData("https://untrusted.example", false)]
    public async Task Cors_OnlyAllowsConfiguredOrigin(string origin, bool allowed)
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/auth/login");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed)
            Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task Cors_WithoutProductionConfiguration_DoesNotAllowBrowserOrigins()
    {
        using var factory = CreateFactory("");
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1");
        request.Headers.Add("Origin", "http://localhost:5173");
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task DatabaseFailure_ReturnsGenericErrorWithConfiguredCors_WithoutFixtureData()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/land-records");
        request.Headers.Add("Origin", "https://client.example");
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("An error occurred while processing your request.", body);
        Assert.DoesNotContain("provider", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("detail", body);
        Assert.DoesNotContain("Kannampalayam", body);
        Assert.Equal("https://client.example", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task AuthenticationEndpoints_ShareAnIpAttemptLimit()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        for (var attempt = 0; attempt < 10; attempt++)
        {
            using var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        using var limited = await client.PostAsJsonAsync("/api/v1/auth/register/verify-otp", new { });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
    }
}
