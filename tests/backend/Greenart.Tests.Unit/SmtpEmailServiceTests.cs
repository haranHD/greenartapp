using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Greenart.Tests.Unit;

public class SmtpEmailServiceTests
{
    [Fact]
    public void SmtpEmailService_WhenCredentialsMissing_IsConfiguredReturnsFalse()
    {
        var settings = new Dictionary<string, string?>
        {
            ["EmailSettings:SmtpHost"] = "smtp.gmail.com",
            ["EmailSettings:SmtpPort"] = "587",
            ["EmailSettings:Username"] = "",
            ["EmailSettings:Password"] = ""
        };

        var config = new TestConfiguration(settings);
        var service = new SmtpEmailService(config, NullLogger<SmtpEmailService>.Instance);

        Assert.False(service.IsConfigured);
    }

    [Fact]
    public void SmtpEmailService_WhenCredentialsPresent_IsConfiguredReturnsTrue()
    {
        var settings = new Dictionary<string, string?>
        {
            ["EmailSettings:SmtpHost"] = "smtp.gmail.com",
            ["EmailSettings:SmtpPort"] = "587",
            ["EmailSettings:Username"] = "business@greenartproperties.com",
            ["EmailSettings:Password"] = "abcdefghijklmnop",
            ["EmailSettings:FromEmail"] = "business@greenartproperties.com",
            ["EmailSettings:FromName"] = "Greenart Properties"
        };

        var config = new TestConfiguration(settings);
        var service = new SmtpEmailService(config, NullLogger<SmtpEmailService>.Instance);

        Assert.True(service.IsConfigured);
    }

    [Fact]
    public async Task SendEmailAsync_WhenNotConfigured_ReturnsFalseGracefullyWithoutException()
    {
        var settings = new Dictionary<string, string?>
        {
            ["EmailSettings:Username"] = "",
            ["EmailSettings:Password"] = ""
        };

        var config = new TestConfiguration(settings);
        var service = new SmtpEmailService(config, NullLogger<SmtpEmailService>.Instance);

        var result = await service.SendOtpEmailAsync("buyer@example.com", "Ramesh Kumar", "654321");
        Assert.False(result);
    }

    [Fact]
    public async Task SendEmailAsync_WhenRecipientEmpty_ReturnsFalse()
    {
        var settings = new Dictionary<string, string?>
        {
            ["EmailSettings:Username"] = "business@greenartproperties.com",
            ["EmailSettings:Password"] = "abcdefghijklmnop"
        };

        var config = new TestConfiguration(settings);
        var service = new SmtpEmailService(config, NullLogger<SmtpEmailService>.Instance);

        var result = await service.SendEmailAsync("", "Test User", "Subject", "Body");
        Assert.False(result);
    }


    [Fact]
    public async Task Resend_UsesConfiguredDomainSender_InsteadOfSilentlyUsingTestDomain()
    {
        string? sender = null;
        var handler = new CapturingEmailHandler(request =>
        {
            var body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            using var json = System.Text.Json.JsonDocument.Parse(body);
            sender = json.RootElement.GetProperty("from").GetString();
            return new(System.Net.HttpStatusCode.OK) { Content = new StringContent("{\"id\":\"test-email\"}") };
        });
        var service = CreateResendService("otp@example.com", handler);
        Assert.True(await service.SendOtpEmailAsync("buyer@example.net", "Buyer", "654321"));
        Assert.Contains("otp@example.com", sender);
        Assert.DoesNotContain("resend.dev", sender);
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task Resend_GmailSenderFailsClearly_WithoutSendingOrSubstitutingOnboarding()
    {
        var handler = new CapturingEmailHandler(_ => new(System.Net.HttpStatusCode.OK));
        var service = CreateResendService("business@gmail.com", handler);
        Assert.False(await service.SendOtpEmailAsync("buyer@example.net", "Buyer", "654321"));
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task Resend_TestDomainIsOnlyUsedWhenExplicitlyConfigured()
    {
        var handler = new CapturingEmailHandler(request =>
        {
            Assert.Contains("onboarding@resend.dev", request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
            return new(System.Net.HttpStatusCode.OK);
        });
        Assert.True(await CreateResendService("onboarding@resend.dev", handler)
            .SendOtpEmailAsync("account-owner@example.net", "Owner", "654321"));
    }

    [Fact]
    public async Task Resend_ProviderRejectionIsNotReportedAsSuccessfulDispatch()
    {
        var handler = new CapturingEmailHandler(_ => new(System.Net.HttpStatusCode.Forbidden));
        Assert.False(await CreateResendService("otp@example.com", handler)
            .SendOtpEmailAsync("buyer@example.net", "Buyer", "654321"));
    }


    [Fact]
    public void ExplicitSmtpSelection_IsNotOverriddenByAnExistingResendKey()
    {
        var service = new SmtpEmailService(new TestConfiguration(new Dictionary<string, string?>
        {
            ["EMAIL_PROVIDER"] = "SMTP",
            ["EmailSettings:ResendApiKey"] = "test-key",
            ["EmailSettings:Username"] = "sender@gmail.com",
            ["EmailSettings:Password"] = "test-app-password",
            ["EmailSettings:FromEmail"] = "sender@gmail.com"
        }), NullLogger<SmtpEmailService>.Instance);
        Assert.Equal("Smtp", service.Provider);
        Assert.True(service.IsConfigured);
    }

    [Fact]
    public void InvalidExplicitProvider_DoesNotSilentlyFallBack()
    {
        var service = new SmtpEmailService(new TestConfiguration(new Dictionary<string, string?>
        { ["EMAIL_PROVIDER"] = "Typo", ["EmailSettings:ResendApiKey"] = "test-key" }), NullLogger<SmtpEmailService>.Instance);
        Assert.Equal("Invalid", service.Provider);
        Assert.False(service.IsConfigured);
    }

    private static SmtpEmailService CreateResendService(string sender, CapturingEmailHandler handler) =>
        new(new TestConfiguration(new Dictionary<string, string?>
        {
            ["EmailSettings:ResendApiKey"] = "test-only-resend-key",
            ["EmailSettings:ResendFromEmail"] = sender
        }), NullLogger<SmtpEmailService>.Instance, new HttpClient(handler));

    private sealed class CapturingEmailHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        { Calls++; return Task.FromResult(response(request)); }
    }

    private sealed class TestConfiguration : IConfiguration
    {
        private readonly IDictionary<string, string?> _data;

        public TestConfiguration(IDictionary<string, string?> data) => _data = data;

        public string? this[string key]
        {
            get => _data.TryGetValue(key, out var val) ? val : null;
            set => _data[key] = value;
        }

        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();

        public IChangeToken GetReloadToken() => new TestChangeToken();

        public IConfigurationSection GetSection(string key) => new TestConfigurationSection(this, key);
    }

    private sealed class TestConfigurationSection : IConfigurationSection
    {
        private readonly IConfiguration _root;

        public TestConfigurationSection(IConfiguration root, string key)
        {
            _root = root;
            Key = key;
            Path = key;
        }

        public string? this[string key]
        {
            get => _root[$"{Path}:{key}"];
            set => _root[$"{Path}:{key}"] = value;
        }

        public string Key { get; }
        public string Path { get; }
        public string? Value
        {
            get => _root[Path];
            set => _root[Path] = value;
        }

        public IEnumerable<IConfigurationSection> GetChildren() => Enumerable.Empty<IConfigurationSection>();
        public IChangeToken GetReloadToken() => new TestChangeToken();
        public IConfigurationSection GetSection(string key) => new TestConfigurationSection(_root, $"{Path}:{key}");
    }

    private sealed class TestChangeToken : IChangeToken
    {
        public bool HasChanged => false;
        public bool ActiveChangeCallbacks => false;
        public IDisposable RegisterChangeCallback(Action<object?> callback, object? state) => new NullDisposable();

        private sealed class NullDisposable : IDisposable
        {
            public void Dispose() { }
        }
    }
}

