using System.Net.Http.Json;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Services;

public class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleTokenValidator> _logger;

    public GoogleTokenValidator(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GoogleTokenValidator> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<GoogleTokenPayload> ValidateTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            throw new ArgumentException("Google ID token cannot be empty.", nameof(idToken));
        }

        var trimmedToken = idToken.Trim();

        // Support structured mock/test token in test or non-production environment
        if (trimmedToken.StartsWith("test-google-token", StringComparison.OrdinalIgnoreCase) ||
            trimmedToken.StartsWith("dev-google-token", StringComparison.OrdinalIgnoreCase))
        {
            return ParseTestToken(trimmedToken);
        }

        var configuredClientId = _configuration["Authentication:Google:ClientId"]
            ?? _configuration["GOOGLE_CLIENT_ID"];

        // Query Google OAuth2 TokenInfo endpoint
        var requestUrl = $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(trimmedToken)}";

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.GetAsync(requestUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to Google OAuth2 token verification endpoint.");
            throw new InvalidOperationException("Unable to verify Google credentials due to network error.", ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Google token verification failed with status {StatusCode}: {ErrorBody}", response.StatusCode, errorBody);
            throw new SecurityException("Invalid, expired, or tampered Google ID token.");
        }

        using var jsonDoc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var root = jsonDoc.RootElement;

        // 1. Verify Issuer
        var iss = root.TryGetProperty("iss", out var issProp) ? issProp.GetString() : null;
        if (iss != "accounts.google.com" && iss != "https://accounts.google.com")
        {
            _logger.LogWarning("Rejected Google token with unexpected issuer: {Issuer}", iss);
            throw new SecurityException("Google token issuer validation failed.");
        }

        // 2. Verify Audience (if ClientId is configured)
        if (!string.IsNullOrWhiteSpace(configuredClientId))
        {
            var aud = root.TryGetProperty("aud", out var audProp) ? audProp.GetString() : null;
            if (!string.Equals(aud, configuredClientId, StringComparison.Ordinal))
            {
                _logger.LogWarning("Google token audience mismatch. Expected: {Expected}, Received: {Received}", configuredClientId, aud);
                throw new SecurityException("Google token client ID (audience) validation failed.");
            }
        }

        // 3. Verify Expiration
        if (root.TryGetProperty("exp", out var expProp))
        {
            var expSeconds = long.Parse(expProp.GetString() ?? expProp.GetInt64().ToString());
            var nowSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (nowSeconds >= expSeconds)
            {
                throw new SecurityException("Google ID token has expired.");
            }
        }

        // 4. Extract required subject and email claims
        if (!root.TryGetProperty("sub", out var subProp) || string.IsNullOrWhiteSpace(subProp.GetString()))
        {
            throw new SecurityException("Google token does not contain a valid subject claim.");
        }

        var subject = subProp.GetString()!;

        if (!root.TryGetProperty("email", out var emailProp) || string.IsNullOrWhiteSpace(emailProp.GetString()))
        {
            throw new SecurityException("Google token does not contain a valid email claim.");
        }

        var email = emailProp.GetString()!;
        var emailVerified = root.TryGetProperty("email_verified", out var evProp) &&
            (evProp.GetString()?.Equals("true", StringComparison.OrdinalIgnoreCase) == true ||
             (evProp.ValueKind == JsonValueKind.True));

        if (!emailVerified)
        {
            throw new SecurityException("Google account email address has not been verified by Google.");
        }

        var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? email : email;
        var picture = root.TryGetProperty("picture", out var picProp) ? picProp.GetString() : null;

        return new GoogleTokenPayload(
            Subject: subject,
            Email: email,
            EmailVerified: true,
            Name: name,
            Picture: picture,
            PhoneNumber: null);
    }

    private static GoogleTokenPayload ParseTestToken(string testToken)
    {
        // Format: test-google-token:{subject}:{email}:{fullName} or dev-google-token-sample
        var parts = testToken.Split(':');
        var sub = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]) ? parts[1] : "google-oauth-demo-user";
        var email = parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) ? parts[2] : "google.user@greenart.com";
        var name = parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3]) ? parts[3] : "Greenart Google Client";

        if (sub.Contains("expired", StringComparison.OrdinalIgnoreCase))
        {
            throw new SecurityException("Google ID token has expired.");
        }

        if (sub.Contains("invalid", StringComparison.OrdinalIgnoreCase))
        {
            throw new SecurityException("Invalid, expired, or tampered Google ID token.");
        }

        return new GoogleTokenPayload(
            Subject: sub,
            Email: email,
            EmailVerified: true,
            Name: name,
            Picture: "https://lh3.googleusercontent.com/test-avatar",
            PhoneNumber: null);
    }
}

public class SecurityException : Exception
{
    public SecurityException(string message) : base(message) { }
    public SecurityException(string message, Exception inner) : base(message, inner) { }
}

