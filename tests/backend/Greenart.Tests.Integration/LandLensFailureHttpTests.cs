using System.Net;
using System.Net.Http.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;

namespace Greenart.Tests.Integration;

public class LandLensFailureHttpTests
{
    private static WebApplicationFactory<Program> CreateFactory(HttpStatusCode upstream, string body) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "LandLensTestOnlySigningKeyWithMoreThan32Characters!");
            builder.UseSetting("ADMIN_API_KEY", "landlens-test-admin");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ILandLensClient>();
                services.AddScoped<ILandLensClient>(_ => new LandLensClient(
                    new HttpClient(new MockProvider(upstream, body)),
                    new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
                    { ["LandLens:ApiKey"] = "llk_mock_key_only" }).Build(),
                    NullLogger<LandLensClient>.Instance));
            });
        });

    [Theory]
    [InlineData(403, 502, "permissiondenied")]
    [InlineData(401, 502, "authentication")]
    [InlineData(429, 503, "ratelimited")]
    [InlineData(500, 502, "unavailable")]
    public async Task ProviderFailure_IsNotReportedAsMissingParcelOrCustomerAuthenticationFailure(
        int upstream, int expected, string code)
    {
        using var factory = CreateFactory((HttpStatusCode)upstream, "upstream-private-error-llk_secret");
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", "landlens-test-admin");
        using var response = await client.PostAsJsonAsync("/api/v1/integrations/landlens/resolve-parcel", new { lat=11.44, lng=77.68 });
        Assert.Equal(expected, (int)response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("landlens_"+code, body);
        Assert.DoesNotContain("llk_secret", body);
        Assert.DoesNotContain("llk_mock_key_only", body);
        if (upstream == 429) Assert.Equal(TimeSpan.FromSeconds(60), response.Headers.RetryAfter!.Delta);
    }

    [Fact]
    public async Task DocumentedNotFound_Remains404()
    {
        using var factory = CreateFactory(HttpStatusCode.OK, """{"ok":true,"status":"not_found","data":{"found":false}}""");
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", "landlens-test-admin");
        using var response = await client.PostAsJsonAsync("/api/v1/integrations/landlens/resolve-parcel", new { lat=11.44, lng=77.68 });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MissingAdministratorCredential_IsRejectedBeforeProviderCall()
    {
        using var factory = CreateFactory(HttpStatusCode.OK, "{}");
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/integrations/landlens/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed class MockProvider(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var response = new HttpResponseMessage(status) { Content = new StringContent(body) };
            if (status == HttpStatusCode.TooManyRequests)
                response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(60));
            return Task.FromResult(response);
        }
    }
}
