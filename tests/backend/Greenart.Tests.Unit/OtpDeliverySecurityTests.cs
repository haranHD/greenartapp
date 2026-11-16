using Greenart.Application.Common.Interfaces;
using Greenart.Application.Common.Exceptions;
using Greenart.Application.DTOs;
using Greenart.Infrastructure.Persistence;
using Greenart.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Greenart.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Greenart.Tests.Unit;

public class OtpDeliverySecurityTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RequestOtp_NeverExposesCode_AndInvalidatesItWhenDeliveryFails(bool delivered)
    {
        using var db = new LandPriceDbContext(new DbContextOptionsBuilder<LandPriceDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var email = new CapturingEmailService(delivered);
        var logger = new CapturingLogger();
        var service = new AuthService(db, null!, new StubTokenService(), email, logger);
        var request = new RequestOtpRequestDto("buyer@example.com", "Buyer");

        if (delivered)
        {
            var response = await service.RequestOtpAsync(request);
            Assert.Null(response.DevOtpHint);
            Assert.DoesNotContain(email.Code!, response.Message);
            var verified = await service.VerifyOtpAsync(new VerifyOtpRequestDto(request.Email, email.Code!));
            Assert.True(verified.Success);
        }
        else
        {
            var error = await Assert.ThrowsAsync<EmailDeliveryException>(() => service.RequestOtpAsync(request));
            Assert.Contains("could not be sent", error.Message);
            var user = await db.Users.SingleAsync();
            Assert.Null(user.OtpHash);
            Assert.Null(user.OtpExpiresAtUtc);
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.VerifyOtpAsync(new VerifyOtpRequestDto(request.Email, email.Code!)));
        }

        Assert.NotNull(email.Code);
        Assert.All(logger.Messages, message => Assert.DoesNotContain(email.Code!, message));
    }

    private sealed class StubTokenService : ITokenService
    {
        public int AccessTokenLifetimeMinutes => 60;
        public int RefreshTokenLifetimeDays => 30;
        public string HashToken(string rawToken) => "test-token-hash";
        public string GenerateAccessToken(User user) => throw new NotSupportedException();
        public string GenerateRefreshToken() => throw new NotSupportedException();
        public ClaimsPrincipal? ValidateAccessToken(string token) => throw new NotSupportedException();
    }

    private sealed class CapturingEmailService(bool delivered) : IEmailService
    {
        public string? Code { get; private set; }
        public bool IsConfigured => true;
        public Task<bool> SendOtpEmailAsync(string recipientEmail, string recipientName, string otpCode,
            int expirationMinutes = 10, CancellationToken cancellationToken = default)
        {
            Code = otpCode;
            return Task.FromResult(delivered);
        }
        public Task<bool> SendEmailAsync(string recipientEmail, string recipientName, string subject,
            string htmlBody, string? plainTextBody = null, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private sealed class CapturingLogger : ILogger<AuthService>
    {
        public List<string> Messages { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }
}
