using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.ValueObjects;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Services;

public class GeminiLandIntelligenceService : IGeminiLandIntelligenceService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GeminiLandIntelligenceService> _logger;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly string _baseUrl;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

    public GeminiLandIntelligenceService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GeminiLandIntelligenceService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _apiKey = configuration["GeminiSettings:ApiKey"]
            ?? configuration["GEMINI_API_KEY"]
            ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY")
            ?? string.Empty;

        _model = configuration["GeminiSettings:Model"]
            ?? configuration["GEMINI_MODEL"]
            ?? Environment.GetEnvironmentVariable("GEMINI_MODEL")
            ?? "gemini-1.5-flash";

        _baseUrl = configuration["GeminiSettings:BaseUrl"]
            ?? configuration["GEMINI_BASE_URL"]
            ?? Environment.GetEnvironmentVariable("GEMINI_BASE_URL")
            ?? "https://generativelanguage.googleapis.com/v1beta";

        var timeoutSeconds = 30;
        if (int.TryParse(configuration["GeminiSettings:TimeoutSeconds"], out var t) && t > 0)
        {
            timeoutSeconds = t;
        }

        _httpClient.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    }

    public async Task<AiLandPriceIntelligenceResponse?> AnalyzeLandPriceAsync(
        AiLandPriceIntelligenceRequest request,
        GuidelineReferenceDto? guidelineBenchmark,
        PriceRangeDto? marketObservedPerCent,
        PriceRangeDto? marketObservedPerSqFt,
        AskingPriceReferenceDto? askingPriceReference,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            _logger.LogWarning("Gemini API Key is not configured. Skipping AI land intelligence generation.");
            return null;
        }

        var sw = Stopwatch.StartNew();

        var locality = !string.IsNullOrWhiteSpace(request.Locality)
            ? request.Locality
            : guidelineBenchmark?.Locality ?? "Tamil Nadu Locality";

        var district = !string.IsNullOrWhiteSpace(request.District)
            ? request.District
            : "Tamil Nadu";

        var prompt = BuildPrompt(request, locality, district, guidelineBenchmark, marketObservedPerCent, askingPriceReference);

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = prompt }
                    }
                }
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                temperature = 0.2
            }
        };

        var endpoint = $"{_baseUrl.TrimEnd('/')}/models/{_model}:generateContent";

        try
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = JsonContent.Create(requestBody, options: JsonOpts)
            };
            httpRequest.Headers.Add("x-goog-api-key", _apiKey);

            using var response = await _httpClient.SendAsync(httpRequest, ct);
            sw.Stop();

            _logger.LogInformation("Gemini API call to {Model} completed with HTTP {StatusCode} in {ElapsedMs}ms",
                _model, (int)response.StatusCode, sw.ElapsedMilliseconds);

            if (!response.IsSuccessStatusCode)
            {
                var errContent = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Gemini API returned error HTTP {StatusCode}: {ErrorContent}",
                    (int)response.StatusCode, errContent);
                return null;
            }

            var root = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOpts, ct);
            if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini API returned no candidates.");
                return null;
            }

            var firstCandidate = candidates[0];
            if (!firstCandidate.TryGetProperty("content", out var content) ||
                !content.TryGetProperty("parts", out var parts) ||
                parts.GetArrayLength() == 0)
            {
                return null;
            }

            var textJson = parts[0].GetProperty("text").GetString();
            if (string.IsNullOrWhiteSpace(textJson)) return null;

            using var parsedDoc = JsonDocument.Parse(textJson);
            var parsed = parsedDoc.RootElement;

            // Price numbers are STRICTLY derived from verified market evidence - Gemini never synthesizes or alters prices
            var estPerCent = marketObservedPerCent?.MedianRate ?? 0m;
            var estPerSqFt = marketObservedPerSqFt?.MedianRate ?? (estPerCent > 0 ? Math.Round(estPerCent / LandArea.SqFtPerCent, 2) : 0m);

            var priceRangeSummary = parsed.TryGetProperty("priceRangeSummary", out var pr)
                ? pr.GetString() ?? string.Empty
                : (estPerCent > 0
                    ? $"Completed Transaction Evidence: Verified market median ₹{estPerCent:N0}/Cent (₹{estPerSqFt:N0}/Sq.Ft)."
                    : "Completed Transaction Evidence: Insufficient verified sales data to establish market price.");

            var marketSentiment = parsed.TryGetProperty("marketSentiment", out var ms)
                ? ms.GetString() ?? "Moderate Growth"
                : "Moderate Growth";

            var growthDrivers = new List<string>();
            if (parsed.TryGetProperty("growthDrivers", out var gd) && gd.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in gd.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String) growthDrivers.Add(item.GetString()!);
                }
            }

            var negotiationTips = new List<string>();
            if (parsed.TryGetProperty("negotiationTips", out var nt) && nt.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in nt.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String) negotiationTips.Add(item.GetString()!);
                }
            }

            var dueDiligence = new List<string>();
            if (parsed.TryGetProperty("dueDiligenceChecklist", out var dd) && dd.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in dd.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String) dueDiligence.Add(item.GetString()!);
                }
            }
            if (dueDiligence.Count == 0)
            {
                dueDiligence.AddRange(new[]
                {
                    "Verify Patta / Chitta in Tamil Nadu e-Services (Anytime / Anywhere Patta Portal)",
                    "Check 30-year Encumbrance Certificate (EC) on TNREGINET for non-mortgage clearance",
                    "Verify DTCP or CMDA layout planning approval and RERA registration for residential plots",
                    "Survey Boundary Check (FMB - Field Measurement Book) with Sub-Registrar / Village Administrative Officer (VAO)"
                });
            }

            // Total Valuation calculation if user provided TargetArea and verified market price exists
            TotalValuationDto? totalValuation = null;
            if (estPerSqFt > 0 && request.TargetArea.HasValue && request.TargetArea.Value > 0)
            {
                var unit = request.TargetAreaUnit ?? Domain.Enums.AreaUnit.Cent;
                var landArea = new LandArea(request.TargetArea.Value, unit);
                var equivSqFt = landArea.ToSqFt();
                var equivCents = landArea.ToCents();

                var totalEst = Math.Round(estPerSqFt * equivSqFt, 2);
                var minSqFt = marketObservedPerSqFt?.MinRate ?? estPerSqFt;
                var maxSqFt = marketObservedPerSqFt?.MaxRate ?? estPerSqFt;
                var totalMin = Math.Round(minSqFt * equivSqFt, 2);
                var totalMax = Math.Round(maxSqFt * equivSqFt, 2);

                decimal? totalGuideline = null;
                if (guidelineBenchmark != null)
                {
                    totalGuideline = Math.Round(guidelineBenchmark.GuidelineRatePerSqFt * equivSqFt, 2);
                }

                totalValuation = new TotalValuationDto(
                    TotalEstimatedPrice: totalEst,
                    TotalPriceMin: totalMin,
                    TotalPriceMax: totalMax,
                    AreaValue: request.TargetArea.Value,
                    AreaUnit: unit.ToString(),
                    EquivalentSqFt: Math.Round(equivSqFt, 2),
                    EquivalentCents: Math.Round(equivCents, 2),
                    TotalGuidelinePrice: totalGuideline
                );
            }

            return new AiLandPriceIntelligenceResponse(
                Status: "Success",
                TargetCoordinates: new CoordinatesDto(request.Latitude, request.Longitude),
                Locality: locality,
                District: district,
                LandUsage: request.LandUsage.ToString(),
                EstimatedCurrentPricePerCent: Math.Round(estPerCent, 2),
                EstimatedCurrentPricePerSqFt: Math.Round(estPerSqFt, 2),
                PriceRangeSummary: priceRangeSummary,
                MarketSentiment: marketSentiment,
                GrowthDrivers: growthDrivers,
                NegotiationTips: negotiationTips,
                DueDiligenceChecklist: dueDiligence,
                GovernmentGuidelineReference: guidelineBenchmark,
                TotalValuation: totalValuation,
                Model: _model,
                GeneratedAtUtc: DateTime.UtcNow,
                FactorBreakdown: null,
                SectionLabel: "Completed Transaction Evidence"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while calling Gemini AI Land Intelligence Service.");
            return null;
        }
    }

    private static string BuildPrompt(
        AiLandPriceIntelligenceRequest request,
        string locality,
        string district,
        GuidelineReferenceDto? guideline,
        PriceRangeDto? market,
        AskingPriceReferenceDto? asking)
    {
        var guidelineInfo = guideline != null
            ? $"Government Guideline Benchmark: ₹{guideline.GuidelineRatePerCent:N0}/Cent (₹{guideline.GuidelineRatePerSqFt:N0}/Sq.Ft) statutory benchmark from TNREGINET for stamp duty calculation."
            : "Government Guideline Benchmark: None available in immediate radius.";

        var marketInfo = market != null
            ? $"Completed Transaction Evidence: Verified market rate median ₹{market.MedianRate:N0}/Cent (₹{market.MinRate:N0} - ₹{market.MaxRate:N0}/Cent)."
            : "Completed Transaction Evidence: No verified completed sale records available.";

        var askingInfo = asking != null
            ? $"Asking Price Benchmark: Local advertised asking price median ₹{asking.MedianRatePerCent:N0}/Cent across {asking.ListingCount} listing(s)."
            : "Asking Price Benchmark: No current asking listings recorded.";

        var areaInfo = request.TargetArea.HasValue
            ? $"Target Property Size: {request.TargetArea.Value} {request.TargetAreaUnit ?? Domain.Enums.AreaUnit.Cent}"
            : "Target Property Size: 1 Cent inquiry.";

        var roadFrontage = !string.IsNullOrWhiteSpace(request.RoadFrontage)
            ? request.RoadFrontage
            : "Standard Layout Road (24ft-30ft)";

        var amenities = !string.IsNullOrWhiteSpace(request.SurroundingAmenities)
            ? request.SurroundingAmenities
            : "Standard Residential Colony";

        return $@"You are a Senior Geospatial Property Analyst specializing in Tamil Nadu, India.
Explain the local land market context, micro-location characteristics, growth dynamics, and due diligence checks for the following property based ONLY on the evidence provided:

Target Location: {locality}, {district}, Tamil Nadu, India
Geographic Coordinates: Latitude {request.Latitude:F4}, Longitude {request.Longitude:F4}
Land Classification: {request.LandUsage}
{areaInfo}

Micro-Location Attributes (for qualitative contextual analysis only):
- Road Frontage: {roadFrontage}
- Surrounding Civic & Social Anchors: {amenities}

Strict Reference Evidence:
- {marketInfo}
- {guidelineInfo}
- {askingInfo}

RULES:
1. Base your qualitative explanations STRICTLY on the real evidence provided above.
2. DO NOT invent, calculate, or alter any numeric land prices. All pricing is determined solely by verified registry evidence.
3. Write clear explanations for market sentiment, infrastructure growth drivers, negotiation tips comparing verified transactions vs asking vs guideline, and legal due diligence steps in Tamil Nadu.

Respond strictly in valid JSON format with the following keys:
{{
  ""priceRangeSummary"": ""<concise 2-sentence summary explaining the market context based strictly on the provided evidence>"",
  ""marketSentiment"": ""<qualitative market sentiment, e.g. High Demand | Developing Corridor | Stable / Steady | Agricultural>"",
  ""growthDrivers"": [
    ""<specific regional infrastructure or connectivity driver 1>"",
    ""<specific driver 2>""
  ],
  ""negotiationTips"": [
    ""<practical negotiation tip 1 for buyers dealing with local sellers based on the evidence>"",
    ""<practical negotiation tip 2>""
  ],
  ""dueDiligenceChecklist"": [
    ""<essential legal check 1 in Tamil Nadu, e.g. Patta verification on e-Services, 30-year EC on TNREGINET, DTCP/RERA approval, FMB survey>"",
    ""<essential legal check 2>""
  ]
}}";
    }
}

