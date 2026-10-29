using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace Greenart.Infrastructure.Services;

public class TokenService : ITokenService
{
    private readonly byte[] _keyBytes;
    private readonly string _issuer;
    private readonly string _audience;
    public int AccessTokenLifetimeMinutes { get; }
    public int RefreshTokenLifetimeDays { get; }

    public TokenService(IConfiguration configuration)
    {
        var signingKey = configuration["Authentication:Jwt:SigningKey"]
            ?? configuration["JWT_SIGNING_KEY"]
            ?? "GreenartProperties-LandMarketRateAnalyst-SecureSigningKey-2026-TamilNadu!";

        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
        {
            throw new InvalidOperationException("Authentication:Jwt:SigningKey must be configured with at least 32 characters.");
        }

        _keyBytes = Encoding.UTF8.GetBytes(signingKey);
        _issuer = configuration["Authentication:Jwt:Issuer"] ?? configuration["JWT_ISSUER"] ?? "GreenartProperties";
        _audience = configuration["Authentication:Jwt:Audience"] ?? configuration["JWT_AUDIENCE"] ?? "GreenartMobileApp";

        if (int.TryParse(configuration["Authentication:Jwt:AccessTokenLifetimeMinutes"], out var accessMinutes) && accessMinutes > 0)
        {
            AccessTokenLifetimeMinutes = accessMinutes;
        }
        else
        {
            AccessTokenLifetimeMinutes = 60; // 1 hour
        }

        if (int.TryParse(configuration["Authentication:Jwt:RefreshTokenLifetimeDays"], out var refreshDays) && refreshDays > 0)
        {
            RefreshTokenLifetimeDays = refreshDays;
        }
        else
        {
            RefreshTokenLifetimeDays = 30; // 30 days
        }
    }

    public string GenerateAccessToken(User user)
    {
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddMinutes(AccessTokenLifetimeMinutes);

        var header = new { alg = "HS256", typ = "JWT" };
        var payload = new Dictionary<string, object>
        {
            ["sub"] = user.Id.ToString(),
            ["email"] = user.Email,
            ["name"] = user.FullName,
            ["role"] = user.Role.ToString(),
            ["iss"] = _issuer,
            ["aud"] = _audience,
            ["iat"] = now.ToUnixTimeSeconds(),
            ["exp"] = expires.ToUnixTimeSeconds(),
            ["jti"] = Guid.NewGuid().ToString()
        };

        var headerBase64 = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(header));
        var payloadBase64 = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));

        var unsignedToken = $"{headerBase64}.{payloadBase64}";
        using var hmac = new HMACSHA256(_keyBytes);
        var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(unsignedToken));
        var signatureBase64 = Base64UrlEncode(signatureBytes);

        return $"{unsignedToken}.{signatureBase64}";
    }

    public ClaimsPrincipal? ValidateAccessToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        var headerBase64 = parts[0];
        var payloadBase64 = parts[1];
        var signatureBase64 = parts[2];

        // 1. Verify HMAC-SHA256 signature
        var unsignedToken = $"{headerBase64}.{payloadBase64}";
        using var hmac = new HMACSHA256(_keyBytes);
        var computedSig = hmac.ComputeHash(Encoding.UTF8.GetBytes(unsignedToken));
        var expectedSigBase64 = Base64UrlEncode(computedSig);

        var sigBytes = Encoding.UTF8.GetBytes(signatureBase64);
        var expectedSigBytes = Encoding.UTF8.GetBytes(expectedSigBase64);

        if (!CryptographicOperations.FixedTimeEquals(sigBytes, expectedSigBytes))
        {
            return null; // Signature mismatch
        }

        // 2. Decode payload
        try
        {
            var payloadBytes = Base64UrlDecode(payloadBase64);
            using var doc = JsonDocument.Parse(payloadBytes);
            var root = doc.RootElement;

            // 3. Validate issuer and audience
            if (root.TryGetProperty("iss", out var issProp) && issProp.GetString() != _issuer)
            {
                return null;
            }

            if (root.TryGetProperty("aud", out var audProp) && audProp.GetString() != _audience)
            {
                return null;
            }

            // 4. Validate expiration with 60-second allowable clock skew
            if (root.TryGetProperty("exp", out var expProp))
            {
                var expSeconds = expProp.GetInt64();
                var nowSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                if (nowSeconds - 60 > expSeconds)
                {
                    return null; // Token expired
                }
            }
            else
            {
                return null;
            }

            // 5. Construct claims
            var claims = new List<Claim>();
            if (root.TryGetProperty("sub", out var subProp))
            {
                claims.Add(new Claim(ClaimTypes.NameIdentifier, subProp.GetString() ?? string.Empty));
            }
            if (root.TryGetProperty("email", out var emailProp))
            {
                claims.Add(new Claim(ClaimTypes.Email, emailProp.GetString() ?? string.Empty));
            }
            if (root.TryGetProperty("name", out var nameProp))
            {
                claims.Add(new Claim(ClaimTypes.Name, nameProp.GetString() ?? string.Empty));
            }
            if (root.TryGetProperty("role", out var roleProp))
            {
                claims.Add(new Claim(ClaimTypes.Role, roleProp.GetString() ?? string.Empty));
            }

            var identity = new ClaimsIdentity(claims, "Bearer");
            return new ClaimsPrincipal(identity);
        }
        catch
        {
            return null;
        }
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(randomBytes).ToLowerInvariant();
    }

    public string HashToken(string rawToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
            throw new ArgumentException("Token cannot be null or whitespace.", nameof(rawToken));

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken.Trim()));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string Base64UrlEncode(byte[] input)
    {
        return Convert.ToBase64String(input)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var output = input.Replace('-', '+').Replace('_', '/');
        switch (output.Length % 4)
        {
            case 2: output += "=="; break;
            case 3: output += "="; break;
        }
        return Convert.FromBase64String(output);
    }
}

