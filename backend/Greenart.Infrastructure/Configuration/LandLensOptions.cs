namespace Greenart.Infrastructure.Configuration;

/// <summary>
/// Configuration options for LandLens API integration.
/// </summary>
public class LandLensOptions
{
    public const string SectionName = "LandLens";

    /// <summary>
    /// Base URL for the LandLens API (default: https://verified.realestate/api/v1).
    /// </summary>
    public string BaseUrl { get; set; } = "https://verified.realestate/api/v1";

    /// <summary>
    /// Secret API Key (Bearer token). Kept server-side only.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// HTTP request timeout in seconds (default: 30).
    /// </summary>
    public int TimeoutSeconds { get; set; } = 30;
}

