using System.Net;
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

        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
        {
            await client.GetAccountStatusAsync();
        });
    }

    [Fact]
    public async Task Scenario5_Handle403Forbidden()
    {
        // 5. Handle 403 Forbidden
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.Forbidden));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
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

        var result = await client.ResolveParcelAsync(11.0017, 77.0871);
        Assert.Null(result);
    }

    [Fact]
    public async Task Scenario7_Handle500And503UpstreamFailures()
    {
        // 7. Handle 500 / 503 upstream failures
        var (client500, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var account = await client500.GetAccountStatusAsync();
        Assert.Null(account);

        var (client503, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var tools = await client503.GetToolsAsync();
        Assert.Empty(tools);
    }

    [Fact]
    public async Task Scenario8_MalformedJsonResponse()
    {
        // 8. Handle malformed JSON response
        var (client, _) = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("<!DOCTYPE html><html><body>Error</body></html>")
        });

        var account = await client.GetAccountStatusAsync();
        Assert.Null(account);
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
        var result = await client.RequestPriceMapAsync(request);

        Assert.False(result.Initiated);
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
}
