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

        var endpoint = $"{_baseUrl.TrimEnd('/')}/models/{_model}:generateContent?key={_apiKey}";

        try
        {
            using var response = await _httpClient.PostAsJsonAsync(endpoint, requestBody, JsonOpts, ct);
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

            var estPerCent = parsed.TryGetProperty("estimatedCurrentPricePerCent", out var pCent)
                ? pCent.GetDecimal()
                : marketObservedPerCent?.MedianRate ?? (guidelineBenchmark != null ? guidelineBenchmark.GuidelineRatePerCent * 1.5m : 0m);

            var estPerSqFt = parsed.TryGetProperty("estimatedCurrentPricePerSqFt", out var pSqFt)
                ? pSqFt.GetDecimal()
                : Math.Round(estPerCent / LandArea.SqFtPerCent, 2);

            var baseLocalityRate = parsed.TryGetProperty("baseLocalityRatePerCent", out var blr)
                ? blr.GetDecimal()
                : Math.Round(estPerCent * 0.60m, 2);

            var roadAdj = parsed.TryGetProperty("roadFrontageAdjustmentPerCent", out var rfa)
                ? rfa.GetDecimal()
                : Math.Round(estPerCent * 0.25m, 2);

            var amenityAdj = parsed.TryGetProperty("amenitiesAdjustmentPerCent", out var ama)
                ? ama.GetDecimal()
                : Math.Round(estPerCent * 0.15m, 2);

            var roadReason = parsed.TryGetProperty("roadAdjustmentReason", out var rfr)
                ? rfr.GetString() ?? ""
                : (request.RoadFrontage ?? "Road frontage impact on visibility and access");

            var amenityReason = parsed.TryGetProperty("amenityAdjustmentReason", out var amr)
                ? amr.GetString() ?? ""
                : (request.SurroundingAmenities ?? "Proximity to transit, hospitals, and schools");

            var factorBreakdown = new ValuationFactorBreakdownDto(
                BaseLocalityRatePerCent: baseLocalityRate,
                RoadFrontageAdjustmentPerCent: roadAdj,
                AmenitiesAdjustmentPerCent: amenityAdj,
                RoadFrontageType: request.RoadFrontage ?? "Standard Layout Road",
                SurroundingAmenitiesType: request.SurroundingAmenities ?? "Standard Residential Colony",
                RoadAdjustmentReason: roadReason,
                AmenityAdjustmentReason: amenityReason
            );

            var priceRangeSummary = parsed.TryGetProperty("priceRangeSummary", out var pr)
                ? pr.GetString() ?? string.Empty
                : $"Estimated ₹{estPerCent:N0} / Cent (₹{estPerSqFt:N0} / Sq.Ft)";

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

            // Total Valuation calculation if user provided TargetArea
            TotalValuationDto? totalValuation = null;
            if (request.TargetArea.HasValue && request.TargetArea.Value > 0)
            {
                var unit = request.TargetAreaUnit ?? Domain.Enums.AreaUnit.Cent;
                var landArea = new LandArea(request.TargetArea.Value, unit);
                var equivSqFt = landArea.ToSqFt();
                var equivCents = landArea.ToCents();

                var totalEst = Math.Round(estPerSqFt * equivSqFt, 2);
                var totalMin = Math.Round(totalEst * 0.90m, 2);
                var totalMax = Math.Round(totalEst * 1.15m, 2);

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
                FactorBreakdown: factorBreakdown
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
            ? $"TNREGINET Statutory Guideline Benchmark: ₹{guideline.GuidelineRatePerCent:N0}/Cent (₹{guideline.GuidelineRatePerSqFt:N0}/Sq.Ft), Survey/Location: {guideline.Locality}"
            : "TNREGINET Statutory Guideline: Not directly attached for this survey.";

        var marketInfo = market != null
            ? $"Registered SRO Completed Deeds in Database: Median ₹{market.MedianRate:N0}/Cent (₹{market.MinRate:N0} - ₹{market.MaxRate:N0}/Cent)"
            : "Registered SRO Completed Deeds in immediate cluster: Limited/Sparse.";

        var askingInfo = asking != null
            ? $"Local Advertised Asking Prices: Median ₹{asking.MedianRatePerCent:N0}/Cent across {asking.ListingCount} broker listing(s)"
            : "Local Advertised Asking Prices: General market rates apply.";

        var areaInfo = request.TargetArea.HasValue
            ? $"Target Property Size: {request.TargetArea.Value} {request.TargetAreaUnit ?? Domain.Enums.AreaUnit.Cent}"
            : "Target Property Size: General 1 Cent rate inquiry.";

        var isHubOrTransit = locality.Contains("Bus Stand", StringComparison.OrdinalIgnoreCase) ||
                             locality.Contains("Bus Terminus", StringComparison.OrdinalIgnoreCase) ||
                             locality.Contains("Railway", StringComparison.OrdinalIgnoreCase) ||
                             locality.Contains("Junction", StringComparison.OrdinalIgnoreCase) ||
                             locality.Contains("Market", StringComparison.OrdinalIgnoreCase) ||
                             locality.Contains("Collectorate", StringComparison.OrdinalIgnoreCase) ||
                             locality.Contains("Town Center", StringComparison.OrdinalIgnoreCase) ||
                             locality.Contains("CBD", StringComparison.OrdinalIgnoreCase);

        var roadFrontage = !string.IsNullOrWhiteSpace(request.RoadFrontage)
            ? request.RoadFrontage
            : (isHubOrTransit ? "Main Road / Highway (40ft-100ft)" : "Standard Layout Road (24ft-30ft)");

        var amenities = !string.IsNullOrWhiteSpace(request.SurroundingAmenities)
            ? request.SurroundingAmenities
            : (isHubOrTransit ? "Near Bus Stand / Commercial Transit Apex" : "Standard Residential Colony");

        return $@"You are a Senior Geospatial Property Valuation Analyst & Real Estate Intelligence Expert specializing in Tamil Nadu, India.
Analyze current 2026 land market prices and investment dynamics for the following target plot:

Target Location: {locality}, {district}, Tamil Nadu, India
Geographic Coordinates: Latitude {request.Latitude:F4}, Longitude {request.Longitude:F4}
Land Classification: {request.LandUsage}
{areaInfo}

Micro-Location Attributes:
- Selected Road Frontage & Width: {roadFrontage}
- Surrounding Civic & Social Anchors: {amenities}

Ground Truth Reference Evidence:
- {guidelineInfo}
- {marketInfo}
- {askingInfo}

TAMIL NADU MICRO-LOCATION VALUATION DIRECTIVES:
1. ROAD HIERARCHY IMPACT:
   - 'Main Road / Highway (40ft-100ft)': In Tamil Nadu cities and towns, properties directly fronting commercial arterials, State Highways (SH), or National Highways (NH) command an 80% to 250%+ premium over interior streets. Retail frontage and commercial development potential drastically drive values.
   - 'Standard Layout Road (24ft-30ft)': Baseline approved layout residential rate.
   - 'Interior / Village Lane (<20ft)': Discount of 20% to 50% relative to approved layout rates due to narrow access, dead-ends, or unapproved status.

2. SURROUNDING CIVIC & TRANSIT ANCHOR IMPACT:
   - 'Near Bus Stand / Commercial Transit Apex': Commercial apex with maximum footfall. Commercial plots directly on or flanking central bus stands (e.g. Karur Bus Stand, Salem Junction, Gandhipuram, Erode Central) trade at ₹60 Lakhs to ₹1.5+ Crores per Cent (₹14,000 to ₹35,000+/sq.ft). Prime residential plots in immediate walking distance trade at ₹25 Lakhs to ₹45 Lakhs per Cent (₹5,500 to ₹10,000/sq.ft).
   - 'Near Hospitals & Schools': Strong residential desirability, family housing demand, and rental yield. Commands +15% to +35% premium over outlying layouts.
   - 'Standard Residential Colony': Steady town appreciation rate.
   - 'Rural Outskirts': Trades near agricultural / raw unapproved layout benchmarks.

3. ITEMIZATION BREAKDOWN REQUIREMENT:
   Calculate the market rate as a sum of clear value drivers:
   - baseLocalityRatePerCent: Baseline market rate per cent for average interior land in this locality.
   - roadFrontageAdjustmentPerCent: Additional premium (or discount) per cent attributed to the specified road frontage.
   - amenitiesAdjustmentPerCent: Premium per cent attributed to nearby transit, hospitals, schools, or markets.
   - estimatedCurrentPricePerCent: Net fair market price per cent (= base + road + amenity).

Provide a comprehensive, authoritative, realistic assessment in JSON format with exact keys:
{{
  ""baseLocalityRatePerCent"": <numeric number in INR per cent for base area>,
  ""roadFrontageAdjustmentPerCent"": <numeric number in INR per cent for road impact>,
  ""amenitiesAdjustmentPerCent"": <numeric number in INR per cent for amenity impact>,
  ""estimatedCurrentPricePerCent"": <numeric number in INR per cent, sum of base + adjustments>,
  ""estimatedCurrentPricePerSqFt"": <numeric number in INR per sq.ft, using 1 cent = 435.6 sq.ft>,
  ""roadAdjustmentReason"": ""<one sentence explaining the road frontage impact>"",
  ""amenityAdjustmentReason"": ""<one sentence explaining the surrounding amenities impact>"",
  ""priceRangeSummary"": ""<concise 2-sentence summary comparing fair market rate vs guideline rate and typical asking range>"",
  ""marketSentiment"": ""<Bullish | High Growth Corridor | Stable / Steady | Emerging Suburban>"",
  ""growthDrivers"": [
    ""<specific infrastructure or economic growth driver 1, e.g. highway connectivity, airport, industrial corridor, water supply>"",
    ""<growth driver 2>"",
    ""<growth driver 3>"",
    ""<growth driver 4>""
  ],
  ""negotiationTips"": [
    ""<practical negotiation tip 1 for buyers dealing with local sellers/brokers in this Tamil Nadu market>"",
    ""<practical negotiation tip 2>"",
    ""<practical negotiation tip 3>""
  ],
  ""dueDiligenceChecklist"": [
    ""<crucial legal check 1, e.g. Patta, EC, DTCP/RERA, FMB>"",
    ""<crucial legal check 2>"",
    ""<crucial legal check 3>""
  ]
}}";
    }
}

