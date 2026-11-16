using System.Net;
using Greenart.Application.Common.Exceptions;
using Greenart.Application.Estimation;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Repositories;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Infrastructure.Configuration;
using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Greenart.Tests.Unit;

public class LandLensClientTests
{
    private sealed class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responseFactory;
        public int CallCount { get; private set; }
        public HttpRequestMessage? LastRequest { get; private set; }

        public MockHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        {
            _responseFactory = responseFactory;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            CallCount++;
            LastRequest = request;
            return Task.FromResult(_responseFactory(request));
        }
    }

    private sealed class DummyChangeToken : IChangeToken
    {
        public bool HasChanged => false;
        public bool ActiveChangeCallbacks => false;
        public IDisposable RegisterChangeCallback(Action<object?> callback, object? state) => new DummyDisposable();
        private sealed class DummyDisposable : IDisposable { public void Dispose() { } }
    }

    private sealed class TestConfiguration : IConfiguration
    {
        private readonly Dictionary<string, string?> _data;
        public TestConfiguration(Dictionary<string, string?> data) => _data = data;
        public string? this[string key] { get => _data.TryGetValue(key, out var v) ? v : null; set => _data[key] = value; }
        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
        public IChangeToken GetReloadToken() => new DummyChangeToken();
        public IConfigurationSection GetSection(string key) => new TestConfigurationSection(key, _data);
    }

    private sealed class TestConfigurationSection : IConfigurationSection
    {
        private readonly string _path;
        private readonly Dictionary<string, string?> _data;
        public TestConfigurationSection(string path, Dictionary<string, string?> data)
        {
            _path = path;
            _data = data;
        }
        public string? this[string key] { get => _data.TryGetValue($"{_path}:{key}", out var v) ? v : null; set => _data[$"{_path}:{key}"] = value; }
        public string Key => _path.Split(':').Last();
        public string Path => _path;
        public string? Value { get => _data.TryGetValue(_path, out var v) ? v : null; set => _data[_path] = value; }
        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
        public IChangeToken GetReloadToken() => new DummyChangeToken();
        public IConfigurationSection GetSection(string key) => new TestConfigurationSection($"{_path}:{key}", _data);
    }

    private static (ILandLensClient client, MockHttpMessageHandler handler) CreateClient(
        Func<HttpRequestMessage, HttpResponseMessage> responseFactory,
        string apiKey = "llk_test_secret_key_12345",
        string baseUrl = "https://verified.realestate/api/v1")
    {
        var handler = new MockHttpMessageHandler(responseFactory);
        var httpClient = new HttpClient(handler);
        var config = new TestConfiguration(new Dictionary<string, string?>
        {
            ["LandLens:ApiKey"] = apiKey,
            ["LandLens:BaseUrl"] = baseUrl,
            ["LandLens:TimeoutSeconds"] = "5"
        });

        var client = new LandLensClient(httpClient, config, NullLogger<LandLensClient>.Instance);
        return (client, handler);
    }

    [Fact]
    public async Task Scenario1_ValidCredentials_SendsCorrectBearerHeader()
    {
        // 1. Valid credentials send correct Bearer header without leaking secrets
        var (client, handler) = CreateClient(req =>
        {
            Assert.NotNull(req.Headers.Authorization);
            Assert.Equal("Bearer", req.Headers.Authorization!.Scheme);
            Assert.Equal("llk_test_secret_key_12345", req.Headers.Authorization.Parameter);

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"credential\":\"greenart\",\"balance\":10,\"spent_today\":0}")
            };
        });

        var account = await client.GetAccountStatusAsync();
        Assert.NotNull(account);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Scenario2_ParseSuccessfulMeResponse()
    {
        // 2. Parse successful /me response
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"credential\":\"greenart\",\"balance\":42,\"spent_today\":15.50}")
        });

        var account = await client.GetAccountStatusAsync();
        Assert.NotNull(account);
        Assert.Equal("greenart", account!.Credential);
        Assert.Equal(42, account.Balance);
        Assert.Equal(15.50m, account.SpentToday);
    }

    [Fact]
    public async Task Scenario3_ParseToolsResponse()
    {
        // 3. Parse /tools response
        var json = @"[
            { ""name"": ""resolve_parcel"", ""summary"": ""Resolve GPS coordinate"", ""cost_credits"": 0, ""is_free"": true, ""category"": ""Land"" },
            { ""name"": ""pricemap"", ""summary"": ""Price Map report"", ""cost_credits"": 4, ""is_free"": false, ""category"": ""Valuation"" }
        ]";

        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json)
        });

        var tools = await client.GetToolsAsync();
        Assert.NotNull(tools);
        Assert.Equal(2, tools.Count);
        Assert.Equal("resolve_parcel", tools[0].Name);
        Assert.True(tools[0].IsFree);
        Assert.Equal(0, tools[0].CostCredits);
        Assert.Equal("pricemap", tools[1].Name);
        Assert.False(tools[1].IsFree);
        Assert.Equal(4, tools[1].CostCredits);
    }

    [Fact]
    public async Task Scenario4_Handle401Unauthorized()
    {
        // 4. Handle 401 Unauthorized
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));

        await Assert.ThrowsAsync<LandLensUpstreamException>(async () =>
        {
            await client.GetAccountStatusAsync();
        });
    }

    [Fact]
    public async Task Scenario5_Handle403Forbidden()
    {
        // 5. Handle 403 Forbidden
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.Forbidden));

        await Assert.ThrowsAsync<LandLensUpstreamException>(async () =>
        {
            await client.GetToolsAsync();
        });
    }

    [Fact]
    public async Task Scenario6_Handle429RateLimited()
    {
        // 6. Handle 429 Rate Limited gracefully
        var (client, _) = CreateClient(_ => new HttpResponseMessage((HttpStatusCode)429)
        {
            Content = new StringContent("{\"ok\":false,\"status\":\"RateLimited\"}")
        });

        var error = await Assert.ThrowsAsync<LandLensUpstreamException>(() => client.ResolveParcelAsync(11.0017, 77.0871));
        Assert.Equal(LandLensFailure.RateLimited, error.Failure);
    }

    [Fact]
    public async Task Scenario7_Handle500And503UpstreamFailures()
    {
        // 7. Handle 500 / 503 upstream failures
        var (client500, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var accountError = await Assert.ThrowsAsync<LandLensUpstreamException>(() => client500.GetAccountStatusAsync());
        Assert.Equal(LandLensFailure.Unavailable, accountError.Failure);

        var (client503, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var toolsError = await Assert.ThrowsAsync<LandLensUpstreamException>(() => client503.GetToolsAsync());
        Assert.Equal(LandLensFailure.Unavailable, toolsError.Failure);
    }

    [Fact]
    public async Task Scenario8_MalformedJsonResponse()
    {
        // 8. Handle malformed JSON response
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("<!DOCTYPE html><html><body>Error</body></html>")
        });

        var error = await Assert.ThrowsAsync<LandLensUpstreamException>(() => client.GetAccountStatusAsync());
        Assert.Equal(LandLensFailure.InvalidResponse, error.Failure);
    }

    [Fact]
    public async Task Scenario9_TimeoutAndCancellationPropagation()
    {
        // 9. Timeout / cancellation propagation
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.OK));
        using var cts = new CancellationTokenSource();
        cts.Cancel(); // Pre-canceled token

        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () =>
        {
            await client.GetAccountStatusAsync(cts.Token);
        });
    }

    [Fact]
    public async Task Scenario10_ConfirmZeroAutoRetriesOnPaidRequests()
    {
        // 10. Confirm zero auto-retries on paid pricemap requests
        int attempts = 0;
        var (client, handler) = CreateClient(req =>
        {
            attempts++;
            if (req.RequestUri?.AbsolutePath.EndsWith("me") == true)
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"credential\":\"greenart\",\"balance\":10,\"spent_today\":0}")
                };
            }
            // Fail the pricemap request with 500
            return new HttpResponseMessage(HttpStatusCode.InternalServerError);
        });

        var request = new PriceMapRequest(11.0017, 77.0871, "123/1");
        var error = await Assert.ThrowsAsync<LandLensUpstreamException>(() => client.RequestPriceMapAsync(request));
        Assert.True(error.ChargeOutcomeUnknown);
        // Ensure /me was called once to verify balance, and /pricemap was called exactly ONCE with ZERO auto-retries
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task Scenario11_DiagnosticEndpointsDoNotLeakCredentials()
    {
        // 11. Diagnostic endpoints do not leak credentials in DTO models
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"credential\":\"greenart\",\"balance\":10,\"spent_today\":0}")
        });

        var account = await client.GetAccountStatusAsync();
        Assert.NotNull(account);

        // Serialize account to JSON as returned by API
        var serialized = JsonSerializer.Serialize(account);
        Assert.DoesNotContain("llk_test_secret_key_12345", serialized);
        Assert.DoesNotContain("Bearer", serialized);
    }
    private static HttpResponseMessage JsonResponse(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
    };

    [Fact]
    public async Task AccountAndCatalog_ParseEnvelopes_AndDoNotCallUnknownPricingFree()
    {
        var (accountClient, _) = CreateClient(_ => JsonResponse("""
            {"ok":true,"data":{"credential":"greenart","balance":42,"spent_today":2.5}}
            """));
        Assert.Equal(42, (await accountClient.GetAccountStatusAsync())!.Balance);
        var (toolsClient, _) = CreateClient(_ => JsonResponse("""
            {"ok":true,"data":{"tools":[
              {"name":"free","credits":0},
              {"name":"variable","credits":0,"credits_max":5},
              {"name":"unknown"}]}}
            """));
        var tools = await toolsClient.GetToolsAsync();
        Assert.True(tools[0].IsFree);
        Assert.False(tools[1].IsFree);
        Assert.Equal(5, tools[1].MaxCostCredits);
        Assert.False(tools[2].IsFree);
        Assert.Null(tools[2].CostCredits);
    }

    [Fact]
    public async Task PriceMap_PreservesSnakeCaseBillingAndJobMetadata()
    {
        var (client, handler) = CreateClient(request => request.Method == HttpMethod.Get
            ? JsonResponse("""{"balance":20,"credential":"test"}""")
            : JsonResponse("""{"ok":true,"status":"queued","data":{"job_id":"job-test"},"credits_charged":4,"balance_after":16,"request_id":"request-test"}"""));
        var report = await client.RequestPriceMapAsync(new(11, 77, "65"));
        Assert.True(report.Initiated);
        Assert.Equal("job-test", report.JobId);
        Assert.Equal(4, report.CreditsCharged);
        Assert.Equal(16, report.BalanceAfter);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task FailedBalanceLookup_NeverStartsAPaidReport()
    {
        var (client, handler) = CreateClient(_ => new(HttpStatusCode.ServiceUnavailable));
        await Assert.ThrowsAsync<LandLensUpstreamException>(() => client.RequestPriceMapAsync(new(11, 77, "65")));
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Parcel_PreservesRevenueIdentityFlagsAndBoundaryGeometry()
    {
        var (client, _) = CreateClient(_ => JsonResponse("""
            {"ok":true,"data":{"found":true,"survey_number":"65","sub_division":"4B",
              "district_code":"03","taluk_code":"14","village_code":"196","extent_hectares":0.05,
              "identity_ambiguous":true,"identity_warning":"Map identity needs review","is_parcel":false,
              "land_data":{"geojson_geom":"{\"type\":\"Polygon\",\"coordinates\":[]}"}}}
            """));
        var parcel = await client.ResolveParcelAsync(12.84, 80.03);
        Assert.NotNull(parcel);
        Assert.Equal("03", parcel.DistrictCode);
        Assert.Equal("14", parcel.TalukCode);
        Assert.Equal("196", parcel.VillageCode);
        Assert.True(parcel.IdentityAmbiguous);
        Assert.False(parcel.IsParcel);
        Assert.True(parcel.ExtentSqFt > 5000);
        Assert.Equal("Polygon", ((JsonElement)parcel.BoundaryGeoJson!).GetProperty("type").GetString());
    }

    [Fact]
    public async Task ParcelNotFound_IsDifferentFromRateLimitAndPermissionFailure()
    {
        var (client, _) = CreateClient(_ => JsonResponse("""{"ok":true,"status":"not_found","data":{"found":false}}"""));
        Assert.Null(await client.ResolveParcelAsync(11, 77));
        var (forbidden, _) = CreateClient(_ => new(HttpStatusCode.Forbidden));
        var error = await Assert.ThrowsAsync<LandLensUpstreamException>(() => forbidden.ResolveParcelAsync(11, 77));
        Assert.Equal(LandLensFailure.PermissionDenied, error.Failure);
        Assert.DoesNotContain("llk_test_secret_key_12345", error.Message);
    }

    [Fact]
    public async Task Guideline_SelectsMatchingClassification_AndForwardsRevenueCodes()
    {
        string? body = null;
        var (client, _) = CreateClient(request =>
        {
            body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return JsonResponse("""
                {"ok":true,"data":{"found":true,"match_type":"igr_parcel","guideline":[
                  {"category_name":"Wet Special Type II","rate_per_sqft":103.31},
                  {"category_name":"Residential Class II","rate_per_sqft":2000}]}}
                """);
        });
        var result = await client.GetGuidelineValueAsync(new(RevDistrictCode:"03", RevTalukCode:"14", RevVillageCode:"196", LandUsage:LandUsageType.Residential));
        Assert.Equal(2000m, result!.GuidelineRatePerSqFt);
        Assert.Equal(871200m, result.GuidelineRatePerCent);
        using var sent = JsonDocument.Parse(body!);
        Assert.Equal("196", sent.RootElement.GetProperty("rev_village_code").GetString());
        Assert.Equal("igr_parcel", result.MatchType);
    }

    [Theory]
    [InlineData("{\"val_original\":4500000,\"unit\":\"Acre\"}")]
    [InlineData("{\"value_2024\":4500000}")]
    public async Task UnnormalizedGuidelineValue_IsNeverMislabelledPerSquareFoot(string rate)
    {
        var (client, _) = CreateClient(_ => JsonResponse("{\"ok\":true,\"data\":{\"guideline\":["+rate+"]}}"));
        Assert.Null(await client.GetGuidelineValueAsync(new()));
    }

    [Fact]
    public async Task MultipleGuidelineEntries_WithoutAClassificationMatch_AreNotGuessed()
    {
        var (client, _) = CreateClient(_ => JsonResponse("""
            {"ok":true,"data":{"guideline":[{"category_name":"Wet","rate_per_sqft":100},{"category_name":"Dry","rate_per_sqft":200}]}}
            """));
        Assert.Null(await client.GetGuidelineValueAsync(new(LandUsage:LandUsageType.Residential)));
        Assert.Null(await client.GetGuidelineValueAsync(new()));
    }

    [Fact]
    public async Task GuidelineHistory_PreservesRegisterUnitsWithoutInventingNormalizedRates()
    {
        var (client, _) = CreateClient(_ => JsonResponse("""
            {"ok":true,"data":{"found":true,"unit":"per unit (as registered)","classification":"Residential",
              "series":[{"year":2024,"value":3850},{"year":2023,"value":3500}]}}
            """));
        var history = await client.GetGuidelineHistoryAsync(new(Village:"Velachery", Street:"Test Street"));
        Assert.Equal(2, history!.Entries.Count);
        Assert.Equal(3850m, history.Entries[0].RegisteredValue);
        Assert.Equal("per unit (as registered)", history.Entries[0].RegisteredUnit);
        Assert.Null(history.Entries[0].RatePerSqFt);
    }

    [Fact]
    public async Task Estimation_ForwardsParcelIdentityAndDoesNotBlendGuidelineIntoMarketPrice()
    {
        string? guidelineBody = null;
        var (client, _) = CreateClient(request =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("resolve_parcel"))
                return JsonResponse("""{"ok":true,"data":{"survey_number":"65","sub_division":"4B","district_code":"03","taluk_code":"14","village_code":"196","village_name":"Test village","rural_urban":"rural"}}""");
            guidelineBody = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return JsonResponse("""{"ok":true,"data":{"guideline":[{"category_name":"Residential","rate_per_sqft":2000}]}}""");
        });
        var result = Assert.IsType<EstimateInsufficientDataResponse>(await new EstimationEngine(new CoimbatorePilotRepository(), client)
            .EstimateMarketPriceAsync(new(11.4471,77.6840)));
        Assert.Equal("InsufficientData", result.Status);
        Assert.Equal("Available", result.GuidelineLookupStatus);
        Assert.NotNull(result.GovernmentGuidelineReference);
        using var sent = JsonDocument.Parse(guidelineBody!);
        Assert.Equal("4B", sent.RootElement.GetProperty("sub_division").GetString());
        Assert.Equal("03", sent.RootElement.GetProperty("rev_district_code").GetString());
    }

    [Fact]
    public async Task Estimation_AmbiguousParcel_DoesNotStartAGuidelineLookup()
    {
        var (client, handler) = CreateClient(_ => JsonResponse("""{"ok":true,"data":{"survey_number":"65","identity_ambiguous":true}}"""));
        var result = Assert.IsType<EstimateInsufficientDataResponse>(await new EstimationEngine(new CoimbatorePilotRepository(), client)
            .EstimateMarketPriceAsync(new(11.4471,77.6840)));
        Assert.Null(result.GovernmentGuidelineReference);
        Assert.NotNull(result.GuidelineLookupMessage);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Estimation_ProviderFailureRemainsVisible_AndCallerCancellationPropagates()
    {
        var (client, _) = CreateClient(_ => new(HttpStatusCode.TooManyRequests));
        var engine = new EstimationEngine(new CoimbatorePilotRepository(), client);
        var result = Assert.IsType<EstimateInsufficientDataResponse>(await engine.EstimateMarketPriceAsync(new(11.4471,77.6840)));
        Assert.Equal("RateLimited", result.GuidelineLookupStatus);
        Assert.NotNull(result.GuidelineLookupMessage);
        using var cancel = new CancellationTokenSource();
        cancel.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => engine.EstimateMarketPriceAsync(new(11.4471,77.6840), cancel.Token));
    }

    [Fact]
    public async Task Account_ParsesCurrentCredentialSpendAndScope_WithoutReturningKeyPrefix()
    {
        var (client, _) = CreateClient(_ => JsonResponse("""
            {"ok":true,"balance":0,"spent_today_by_this_credential":7.5,
             "credential":{"name":"Integration","prefix":"llk_private_prefix","daily_credit_cap":20,"tools":["resolve_parcel","guideline_value"]}}
            """));
        var account = await client.GetAccountStatusAsync();
        Assert.Equal(7.5m, account!.SpentToday);
        Assert.Equal(20m, account.DailyCreditCap);
        Assert.Contains("guideline_value", account.AllowedTools!);
        Assert.DoesNotContain("llk_private_prefix", JsonSerializer.Serialize(account));
    }

    [Fact]
    public async Task ProviderTimeout_IsDistinctFromCallerCancellation()
    {
        var (client, _) = CreateClient(_ => throw new TaskCanceledException("simulated provider timeout"));
        var error = await Assert.ThrowsAsync<LandLensUpstreamException>(() => client.ResolveParcelAsync(11, 77));
        Assert.Equal(LandLensFailure.Timeout, error.Failure);
    }

    [Fact]
    public async Task NormalizedRateStrings_AreIndependentOfServerCulture()
    {
        var original = System.Globalization.CultureInfo.CurrentCulture;
        try
        {
            System.Globalization.CultureInfo.CurrentCulture = new("fr-FR");
            var (client, _) = CreateClient(_ => JsonResponse("""{"ok":true,"data":{"rate_per_sqft":"103.31"}}"""));
            var rate = await client.GetGuidelineValueAsync(new());
            Assert.Equal(103.31m, rate!.GuidelineRatePerSqFt);
        }
        finally { System.Globalization.CultureInfo.CurrentCulture = original; }
    }

}
