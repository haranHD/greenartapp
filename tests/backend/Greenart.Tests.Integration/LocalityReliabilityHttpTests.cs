using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Greenart.Api.Configuration;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Infrastructure.Repositories;
using Greenart.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;

namespace Greenart.Tests.Integration;

public class LocalityReliabilityHttpTests
{
    private static WebApplicationFactory<Program> CreateFactory(HttpStatusCode status = HttpStatusCode.OK, bool configured = true) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "LocalityTestOnlySigningKeyWithMoreThan32Characters!");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IGeocodingService>();
                services.AddScoped<IGeocodingService>(_ => new GooglePlacesGeocodingService(
                    new HttpClient(new FakeGoogle(status)), new MemoryCache(new MemoryCacheOptions()),
                    new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
                    { ["GEOCODING_API_KEY"] = configured ? "test-only-google-key" : "" }).Build(),
                    NullLogger<GooglePlacesGeocodingService>.Instance));
                services.RemoveAll<ILandLensClient>();
                services.AddSingleton<ILandLensClient, DisabledLandLensClient>();
                services.RemoveAll<ILandPriceRepository>();
                services.AddScoped<ILandPriceRepository, CoimbatorePilotRepository>();
            });
        });

    [Theory]
    [InlineData(403, 502, "permissiondenied")]
    [InlineData(429, 503, "ratelimited")]
    [InlineData(500, 502, "unavailable")]
    public async Task SearchProviderFailure_IsNotAnEmpty200Response(int upstream, int expected, string reason)
    {
        using var factory = CreateFactory((HttpStatusCode)upstream);
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/localities/search?q=Bhavani");
        Assert.Equal(expected, (int)response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("geocoding_" + reason, body);
        Assert.DoesNotContain("test-only-google-key", body);
        Assert.DoesNotContain("private-provider-response", body);
    }

    [Fact]
    public async Task MissingConfiguration_ReturnsServiceUnavailableInsteadOfNoMatches()
    {
        using var factory = CreateFactory(configured: false);
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/localities/search?q=Bhavani");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("geocoding_notconfigured", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task SearchDetailsAndValuation_PreserveTheSelectedBhavaniPoint()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        var suggestions = await client.GetFromJsonAsync<List<LocalitySuggestionDto>>("/api/v1/localities/search?q=Bhavani");
        Assert.Single(suggestions!);
        var place = await client.GetFromJsonAsync<LocalityDetailsDto>("/api/v1/localities/details?placeId=" + suggestions![0].PlaceId);
        Assert.Equal("Bhavani", place!.Name);
        Assert.Equal("Erode", place.District);
        using var response = await client.PostAsJsonAsync("/api/v1/estimates/calculate", new CalculateEstimateRequest(
            place.Latitude, place.Longitude, Locality: place.Name, District: place.District));
        var result = await response.Content.ReadFromJsonAsync<EstimateInsufficientDataResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(11.4471, result!.TargetCoordinates.Latitude, 4);
        Assert.Equal(77.684, result.TargetCoordinates.Longitude, 4);
        Assert.Equal("InsufficientData", result.Status);
    }

    [Fact]
    public async Task LateEnvironmentValues_AreVisibleWithoutChangingConfigurationPrecedence()
    {
        var prefix = "GREENART_CONFIG_TEST_" + Guid.NewGuid().ToString("N") + "_";
        var config = new ConfigurationBuilder().AddEnvironmentVariables(prefix)
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ExplicitSetting"] = "higher-priority" }).Build();
        using var configLifetime = (IDisposable)config;
        try
        {
            Assert.Null(config["GEOCODING_API_KEY"]);
            Environment.SetEnvironmentVariable(prefix + "GEOCODING_API_KEY", "late-loaded-test-key");
            Environment.SetEnvironmentVariable(prefix + "ExplicitSetting", "environment-value");
            EnvironmentConfiguration.RefreshEnvironmentProviders(config);
            Assert.Equal("late-loaded-test-key", config["GEOCODING_API_KEY"]);
            Assert.Equal("higher-priority", config["ExplicitSetting"]);
            var service = new GooglePlacesGeocodingService(new HttpClient(new FakeGoogle(HttpStatusCode.OK)),
                new MemoryCache(new MemoryCacheOptions()), config, NullLogger<GooglePlacesGeocodingService>.Instance);
            Assert.Single(await service.SearchLocalitiesAsync("Bhavani"));
        }
        finally
        {
            Environment.SetEnvironmentVariable(prefix + "GEOCODING_API_KEY", null);
            Environment.SetEnvironmentVariable(prefix + "ExplicitSetting", null);
        }
    }

    private sealed class FakeGoogle(HttpStatusCode status) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            string body = "private-provider-response";
            if (status == HttpStatusCode.OK)
                body = request.Method == HttpMethod.Post ? """
                    {"suggestions":[{"placePrediction":{"placeId":"bhavani-test","structuredFormat":{"mainText":{"text":"Bhavani"},"secondaryText":{"text":"Erode, Tamil Nadu"}}}}]}
                    """ : """
                    {"id":"bhavani-test","displayName":{"text":"Bhavani"},"location":{"latitude":11.4471,"longitude":77.684},"addressComponents":[{"longText":"Bhavani","types":["locality"]},{"longText":"Erode","types":["administrative_area_level_2"]},{"longText":"Tamil Nadu","types":["administrative_area_level_1"]},{"longText":"India","types":["country"]}]}
                    """;
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") });
        }
    }
}
