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

