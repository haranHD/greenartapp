using System.Security.Claims;
using Greenart.Domain.Entities;

namespace Greenart.Application.Common.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    string HashToken(string rawToken);
    ClaimsPrincipal? ValidateAccessToken(string token);
    int AccessTokenLifetimeMinutes { get; }
    int RefreshTokenLifetimeDays { get; }
}

