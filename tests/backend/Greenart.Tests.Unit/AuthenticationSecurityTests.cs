using System.Security.Claims;
using Greenart.Application.Common.Interfaces;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Primitives;
using Xunit;

namespace Greenart.Tests.Unit;

public class AuthenticationSecurityTests
{
    private readonly IConfiguration _config;
    private readonly TokenService _tokenService;

    public AuthenticationSecurityTests()
    {
        var settings = new Dictionary<string, string?>
        {
            ["Authentication:Jwt:SigningKey"] = "SuperSecretKeyForTestingGreenartPropertiesTokens123!",
            ["Authentication:Jwt:Issuer"] = "GreenartPropertiesTest",
            ["Authentication:Jwt:Audience"] = "GreenartMobileAppTest",
            ["Authentication:Jwt:AccessTokenLifetimeMinutes"] = "60",
            ["Authentication:Jwt:RefreshTokenLifetimeDays"] = "30"
        };

        _config = new TestConfiguration(settings);
        _tokenService = new TokenService(_config);
    }

    [Fact]
    public void TokenService_GenerateAccessToken_ContainsCorrectClaimsAndValidSignature()
    {
        var user = new User(
            id: Guid.NewGuid(),
            email: "analyst@greenart.com",
            fullName: "Senior Analyst",
            googleSubjectId: "google-sub-987654",
            role: UserRole.Customer
        );

        var token = _tokenService.GenerateAccessToken(user);
        Assert.NotNull(token);
        Assert.Contains(".", token);

        var principal = _tokenService.ValidateAccessToken(token);
        Assert.NotNull(principal);
        Assert.Equal(user.Id.ToString(), principal.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        Assert.Equal("analyst@greenart.com", principal.FindFirst(ClaimTypes.Email)?.Value);
        Assert.Equal("Senior Analyst", principal.FindFirst(ClaimTypes.Name)?.Value);
        Assert.Equal(UserRole.Customer.ToString(), principal.FindFirst(ClaimTypes.Role)?.Value);
    }

    [Fact]
    public void TokenService_ValidateAccessToken_RejectsTamperedSignature()
    {
        var user = new User(
            id: Guid.NewGuid(),
            email: "tamper@greenart.com",
            fullName: "Tamper Test",
            googleSubjectId: "sub-111"
        );

        var token = _tokenService.GenerateAccessToken(user);
        var parts = token.Split('.');

        // Alter payload by replacing character
        var tamperedPayload = parts[1][..^2] + "AA";
        var tamperedToken = $"{parts[0]}.{tamperedPayload}.{parts[2]}";

        var principal = _tokenService.ValidateAccessToken(tamperedToken);
        Assert.Null(principal);
    }

    [Fact]
    public void TokenService_ValidateAccessToken_RejectsWrongIssuerOrAudience()
    {
        var otherConfig = new TestConfiguration(new Dictionary<string, string?>
        {
            ["Authentication:Jwt:SigningKey"] = "SuperSecretKeyForTestingGreenartPropertiesTokens123!",
            ["Authentication:Jwt:Issuer"] = "RogueIssuer",
            ["Authentication:Jwt:Audience"] = "RogueAudience"
        });

        var rogueTokenService = new TokenService(otherConfig);
        var user = new User(Guid.NewGuid(), "a@b.com", "Name", "sub-222");

        var tokenFromRogue = rogueTokenService.GenerateAccessToken(user);

        // Validation against our service must fail due to issuer/audience mismatch
        var principal = _tokenService.ValidateAccessToken(tokenFromRogue);
        Assert.Null(principal);
    }

    [Fact]
    public void TokenService_GenerateRefreshToken_Returns128HexChars()
    {
        var raw1 = _tokenService.GenerateRefreshToken();
        var raw2 = _tokenService.GenerateRefreshToken();

        Assert.NotNull(raw1);
        Assert.NotNull(raw2);
        Assert.NotEqual(raw1, raw2);
        Assert.Equal(128, raw1.Length);
        Assert.True(raw1.All(c => "0123456789abcdef".Contains(c)));
    }

    [Fact]
    public void TokenService_HashToken_ReturnsDeterministicSha256()
    {
        var raw = "sample-opaque-refresh-token-value-xyz";
        var hash1 = _tokenService.HashToken(raw);
        var hash2 = _tokenService.HashToken(raw);

        Assert.Equal(hash1, hash2);
        Assert.Equal(64, hash1.Length); // 256 bits = 64 hex characters
        Assert.NotEqual(raw, hash1); // Raw value is never plaintext in hash
    }

    [Fact]
    public async Task GoogleTokenValidator_ValidTestToken_ParsesSubjectAndEmail()
    {
        var validator = new GoogleTokenValidator(new HttpClient(), _config, NullLogger<GoogleTokenValidator>.Instance);

        var payload = await validator.ValidateTokenAsync("test-google-token:sub-555:client@greenart.com:Verified Client");

        Assert.NotNull(payload);
        Assert.Equal("sub-555", payload.Subject);
        Assert.Equal("client@greenart.com", payload.Email);
        Assert.Equal("Verified Client", payload.Name);
        Assert.True(payload.EmailVerified);
    }

    [Fact]
    public async Task GoogleTokenValidator_ExpiredTestToken_ThrowsSecurityException()
    {
        var validator = new GoogleTokenValidator(new HttpClient(), _config, NullLogger<GoogleTokenValidator>.Instance);

        await Assert.ThrowsAsync<Greenart.Infrastructure.Services.SecurityException>(() =>
            validator.ValidateTokenAsync("test-google-token:expired-sub:client@greenart.com:Expired User"));
    }

    [Fact]
    public async Task GoogleTokenValidator_InvalidTestToken_ThrowsSecurityException()
    {
        var validator = new GoogleTokenValidator(new HttpClient(), _config, NullLogger<GoogleTokenValidator>.Instance);

        await Assert.ThrowsAsync<Greenart.Infrastructure.Services.SecurityException>(() =>
            validator.ValidateTokenAsync("test-google-token:invalid-sub:client@greenart.com:Invalid User"));
    }

    [Fact]
    public async Task GoogleTokenValidator_EmptyToken_ThrowsArgumentException()
    {
        var validator = new GoogleTokenValidator(new HttpClient(), _config, NullLogger<GoogleTokenValidator>.Instance);

        await Assert.ThrowsAsync<ArgumentException>(() => validator.ValidateTokenAsync("   "));
    }

    [Fact]
    public void RolePolicy_RoleClaims_ShouldMapCustomerReviewerAdmin()
    {
        var customerUser = new User(Guid.NewGuid(), "c@g.com", "Customer", "sub-c", role: UserRole.Customer);
        var reviewerUser = new User(Guid.NewGuid(), "r@g.com", "Reviewer", "sub-r", role: UserRole.Reviewer);
        var adminUser = new User(Guid.NewGuid(), "a@g.com", "Admin", "sub-a", role: UserRole.Administrator);

        var customerToken = _tokenService.GenerateAccessToken(customerUser);
        var reviewerToken = _tokenService.GenerateAccessToken(reviewerUser);
        var adminToken = _tokenService.GenerateAccessToken(adminUser);

        var pCustomer = _tokenService.ValidateAccessToken(customerToken)!;
        var pReviewer = _tokenService.ValidateAccessToken(reviewerToken)!;
        var pAdmin = _tokenService.ValidateAccessToken(adminToken)!;

        Assert.True(pCustomer.IsInRole("Customer"));
        Assert.False(pCustomer.IsInRole("Administrator"));

        Assert.True(pReviewer.IsInRole("Reviewer"));
        Assert.False(pReviewer.IsInRole("Administrator"));

        Assert.True(pAdmin.IsInRole("Administrator"));
    }

    [Fact]
    public void User_SuspensionAndDeactivation_ShouldBeVerifiable()
    {
        var user = new User(Guid.NewGuid(), "user@greenart.com", "Active User", "sub-active");
        Assert.Equal(AccountStatus.Active, user.AccountStatus);

        user.UpdateAccountStatus(AccountStatus.Suspended);
        Assert.Equal(AccountStatus.Suspended, user.AccountStatus);

        user.UpdateAccountStatus(AccountStatus.Deactivated);
        Assert.Equal(AccountStatus.Deactivated, user.AccountStatus);
    }

    [Fact]
    public void User_SetPassword_SetsHashAndSaltCorrectly()
    {
        var user = new User(Guid.NewGuid(), "pwduser@greenart.com", "Password User", "email:pwduser@greenart.com");
        Assert.Null(user.PasswordHash);
        Assert.Null(user.PasswordSalt);

        user.SetPassword("HASH123456", "SALTABCDEF");
        Assert.Equal("HASH123456", user.PasswordHash);
        Assert.Equal("SALTABCDEF", user.PasswordSalt);
    }

    [Fact]
    public void User_SetOtp_SetsHashAndExpiration()
    {
        var user = new User(Guid.NewGuid(), "otpuser@greenart.com", "OTP User", "email:otpuser@greenart.com");
        Assert.Null(user.OtpHash);
        Assert.Null(user.OtpExpiresAtUtc);
        Assert.False(user.IsEmailVerified);

        var expiry = DateTime.UtcNow.AddMinutes(10);
        user.SetOtp("OTPHASH999", expiry);
        Assert.Equal("OTPHASH999", user.OtpHash);
        Assert.Equal(expiry, user.OtpExpiresAtUtc);

        user.VerifyEmail();
        Assert.True(user.IsEmailVerified);
        Assert.Null(user.OtpHash);
        Assert.Null(user.OtpExpiresAtUtc);
    }

    [Fact]
    public void User_LinkGoogleSubject_UpdatesSubjectAndMarksEmailVerified()
    {
        var user = new User(Guid.NewGuid(), "googlelink@greenart.com", "Google Link", "email:googlelink@greenart.com");
        Assert.False(user.IsEmailVerified);

        user.LinkGoogleSubject("google-sub-777", "https://photo.url/avatar.jpg");
        Assert.Equal("google-sub-777", user.GoogleSubjectId);
        Assert.Equal("https://photo.url/avatar.jpg", user.AvatarUrl);
        Assert.True(user.IsEmailVerified);
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

    private sealed class DummyChangeToken : IChangeToken
    {
        public bool HasChanged => false;
        public bool ActiveChangeCallbacks => false;
        public IDisposable RegisterChangeCallback(Action<object?> callback, object? state) => new DummyDisposable();
    }

    private sealed class DummyDisposable : IDisposable
    {
        public void Dispose() { }
    }
}
