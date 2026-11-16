using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Infrastructure.Persistence;
using Greenart.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Greenart.Tests.Unit;

public class RegistrationChallengeSecurityTests
{
    [Fact]
    public async Task RegistrationToken_IsOpaqueSingleUse_AndSuccessfulSetupStillIssuesSession()
    {
        using var fixture = new RegistrationFixture();
        var token = await fixture.VerifyEmailAsync();
        Assert.Equal(64, token.Length);
        var user = await fixture.Db.Users.SingleAsync();
        Assert.DoesNotContain(token, user.OtpHash!);
        Assert.True(user.OtpExpiresAtUtc > DateTime.UtcNow);
        var result = await fixture.Service.CompleteRegistrationAsync(new("buyer@example.com", "NewPassword123!", token));
        Assert.NotEmpty(result.AccessToken);
        Assert.NotNull(user.PasswordHash);
        Assert.Null(user.OtpHash);
        Assert.Null(user.OtpExpiresAtUtc);
        var originalHash = user.PasswordHash;
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => fixture.Service.CompleteRegistrationAsync(
            new("buyer@example.com", "ReplacementPassword!", token)));
        Assert.Equal(originalHash, user.PasswordHash);
    }

    [Theory]
    [InlineData("not-a-hex-token")]
    [InlineData("123456")]
    public async Task InvalidSetupToken_IsRejectedWithoutPasswordOrSession(string token)
    {
        using var fixture = new RegistrationFixture();
        await fixture.VerifyEmailAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => fixture.Service.CompleteRegistrationAsync(
            new("buyer@example.com", "NewPassword123!", token)));
        Assert.Null((await fixture.Db.Users.SingleAsync()).PasswordHash);
        Assert.Empty(await fixture.Db.UserRefreshTokens.ToListAsync());
    }

    [Fact]
    public async Task ExpiredSetupToken_IsRejected()
    {
        using var fixture = new RegistrationFixture();
        var token = await fixture.VerifyEmailAsync();
        var user = await fixture.Db.Users.SingleAsync();
        user.SetOtp(user.OtpHash!, DateTime.UtcNow.AddSeconds(-1));
        await fixture.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => fixture.Service.CompleteRegistrationAsync(
            new("buyer@example.com", "NewPassword123!", token)));
        Assert.Null(user.PasswordHash);
    }

    [Fact]
    public async Task ThreeIncorrectCodes_InvalidateTheCodeIncludingForAnotherServiceInstance()
    {
        using var fixture = new RegistrationFixture();
        await fixture.Service.RequestOtpAsync(new("buyer@example.com", "Buyer"));
        var incorrectCode = fixture.Email.Code == "111111" ? "222222" : "111111";
        for (var attempt = 0; attempt < 3; attempt++)
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => fixture.Service.VerifyOtpAsync(new("buyer@example.com", incorrectCode)));
        using var otherDb = new LandPriceDbContext(fixture.Options);
        var otherService = fixture.CreateService(otherDb);
        await Assert.ThrowsAsync<InvalidOperationException>(() => otherService.VerifyOtpAsync(new("buyer@example.com", fixture.Email.Code!)));
        Assert.Null((await otherDb.Users.SingleAsync()).OtpHash);
    }

    [Fact]
    public async Task RequestOtp_EnforcesPersistedResendCooldown()
    {
        using var fixture = new RegistrationFixture();
        await fixture.Service.RequestOtpAsync(new("buyer@example.com", "Buyer"));
        using var otherDb = new LandPriceDbContext(fixture.Options);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.CreateService(otherDb)
            .RequestOtpAsync(new("buyer@example.com", "Buyer")));
        Assert.Contains("60 seconds", error.Message);
        Assert.Equal(1, fixture.Email.SentCount);
    }

    [Fact]
    public async Task ExistingPasswordAccount_CannotBeResetThroughRegistration()
    {
        using var fixture = new RegistrationFixture();
        var token = await fixture.VerifyEmailAsync();
        await fixture.Service.CompleteRegistrationAsync(new("buyer@example.com", "OriginalPassword!", token));
        var user = await fixture.Db.Users.SingleAsync();
        var originalHash = user.PasswordHash;
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Service.RequestOtpAsync(new("buyer@example.com", "Buyer")));
        Assert.Equal(originalHash, user.PasswordHash);
    }

    [Fact]
    public async Task VerifiedCode_CannotBeReusedToGenerateAnotherSetupToken()
    {
        using var fixture = new RegistrationFixture();
        await fixture.VerifyEmailAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Service.VerifyOtpAsync(new("buyer@example.com", fixture.Email.Code!)));
    }

    [Fact]
    public async Task ConcurrentChallengeConsumption_RejectsTheStaleWriter()
    {
        using var fixture = new RegistrationFixture();
        await fixture.VerifyEmailAsync();
        using var otherDb = new LandPriceDbContext(fixture.Options);
        var staleUser = await otherDb.Users.SingleAsync();
        var user = await fixture.Db.Users.SingleAsync();
        user.ClearOtp();
        await fixture.Db.SaveChangesAsync();
        staleUser.ClearOtp();
        staleUser.SetPassword("stale-password-hash", "salt");
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => otherDb.SaveChangesAsync());
    }

    private sealed class RegistrationFixture : IDisposable
    {
        public DbContextOptions<LandPriceDbContext> Options { get; } = new DbContextOptionsBuilder<LandPriceDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        public LandPriceDbContext Db { get; }
        public CapturingEmail Email { get; } = new();
        public AuthService Service { get; }
        public RegistrationFixture() { Db = new(Options); Service = CreateService(Db); }
        public AuthService CreateService(LandPriceDbContext db) => new(db, null!, new StubTokens(), Email, NullLogger<AuthService>.Instance);
        public async Task<string> VerifyEmailAsync()
        {
            await Service.RequestOtpAsync(new("buyer@example.com", "Buyer"));
            return (await Service.VerifyOtpAsync(new("buyer@example.com", Email.Code!))).TempVerificationToken;
        }
        public void Dispose() => Db.Dispose();
    }
    private sealed class CapturingEmail : IEmailService
    {
        public string? Code { get; private set; }
        public int SentCount { get; private set; }
        public bool IsConfigured => true;
        public Task<bool> SendOtpEmailAsync(string recipientEmail, string recipientName, string otpCode, int expirationMinutes = 10, CancellationToken cancellationToken = default)
        { Code = otpCode; SentCount++; return Task.FromResult(true); }
        public Task<bool> SendEmailAsync(string recipientEmail, string recipientName, string subject, string htmlBody, string? plainTextBody = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
    private sealed class StubTokens : ITokenService
    {
        public int AccessTokenLifetimeMinutes => 60;
        public int RefreshTokenLifetimeDays => 30;
        public string HashToken(string rawToken) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        public string GenerateAccessToken(User user) => "server-access-token";
        public string GenerateRefreshToken() => Guid.NewGuid().ToString();
        public ClaimsPrincipal? ValidateAccessToken(string token) => throw new NotSupportedException();
    }
}
