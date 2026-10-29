namespace Greenart.Application.Common.Interfaces;

public record GoogleTokenPayload(
    string Subject,
    string Email,
    bool EmailVerified,
    string Name,
    string? Picture,
    string? PhoneNumber);

public interface IGoogleTokenValidator
{
    Task<GoogleTokenPayload> ValidateTokenAsync(string idToken, CancellationToken cancellationToken = default);
}

