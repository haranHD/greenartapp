using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Infrastructure.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Services;

/// <summary>
/// Typed client for interacting with the LandLens API (verified.realestate).
/// </summary>
public class LandLensClient : ILandLensClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<LandLensClient> _logger;
    private readonly LandLensOptions _options;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

    public LandLensClient(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<LandLensClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _options = new LandLensOptions();
        var section = configuration.GetSection(LandLensOptions.SectionName);
        var configuredKey = section?["ApiKey"] ?? configuration["LandLens:ApiKey"] ?? configuration["LANDLENS_API_KEY"];
        if (!string.IsNullOrWhiteSpace(configuredKey))
        {
            _options.ApiKey = configuredKey;
        }

        var configuredBase = section?["BaseUrl"] ?? configuration["LandLens:BaseUrl"] ?? configuration["LANDLENS_BASE_URL"];
        if (!string.IsNullOrWhiteSpace(configuredBase))
        {
            _options.BaseUrl = configuredBase;
        }

        var configuredTimeout = section?["TimeoutSeconds"] ?? configuration["LandLens:TimeoutSeconds"] ?? configuration["LANDLENS_TIMEOUT_SECONDS"];
        if (int.TryParse(configuredTimeout, out var t) && t > 0)
        {
            _options.TimeoutSeconds = t;
        }

        // Environment variable fallback overrides
        var envKey = Environment.GetEnvironmentVariable("LANDLENS_API_KEY");
        if (!string.IsNullOrWhiteSpace(envKey)) _options.ApiKey = envKey.Trim();

        var envBase = Environment.GetEnvironmentVariable("LANDLENS_BASE_URL");
        if (!string.IsNullOrWhiteSpace(envBase)) _options.BaseUrl = envBase.Trim().TrimEnd('/');

        var envTimeout = Environment.GetEnvironmentVariable("LANDLENS_TIMEOUT_SECONDS");
        if (int.TryParse(envTimeout, out var envT) && envT > 0) _options.TimeoutSeconds = envT;

        _httpClient.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
    }

    public async Task<LandLensAccountResponse?> GetAccountStatusAsync(CancellationToken ct = default)
    {
        EnsureConfigured();
        var sw = Stopwatch.StartNew();

        try
        {
            using var request = CreateAuthorizedRequest(HttpMethod.Get, "me");
            using var response = await _httpClient.SendAsync(request, ct);
            sw.Stop();

            _logger.LogInformation("LandLens GET /me completed with HTTP {StatusCode} in {ElapsedMs}ms",
                (int)response.StatusCode, sw.ElapsedMilliseconds);

            if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
            {
                _logger.LogWarning("LandLens authentication failed: Invalid or expired API key (HTTP {StatusCode})", (int)response.StatusCode);
                throw new UnauthorizedAccessException("LandLens authentication failed: Invalid or expired API key.");
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("LandLens GET /me returned non-success HTTP {StatusCode}", (int)response.StatusCode);
                return null;
            }

            var envelope = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOpts, ct);

            // Account can be returned directly or wrapped in envelope
            if (envelope.ValueKind == JsonValueKind.Object)
            {
                string credential = envelope.TryGetProperty("credential", out var c) ? c.GetString() ?? "Unknown" : "Unknown";
                int balance = envelope.TryGetProperty("balance", out var b) ? b.GetInt32() : 0;
                decimal spentToday = envelope.TryGetProperty("spent_today", out var s) ? s.GetDecimal() : 0m;

                return new LandLensAccountResponse(credential, balance, spentToday);
            }

            return null;
        }
        catch (Exception ex) when (ex is not UnauthorizedAccessException && ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Error communicating with LandLens GET /me");
            return null;
        }
    }

    public async Task<IReadOnlyList<LandLensToolDefinition>> GetToolsAsync(CancellationToken ct = default)
    {
        EnsureConfigured();
        var sw = Stopwatch.StartNew();

        try
        {
            using var request = CreateAuthorizedRequest(HttpMethod.Get, "tools");
            using var response = await _httpClient.SendAsync(request, ct);
            sw.Stop();

            _logger.LogInformation("LandLens GET /tools completed with HTTP {StatusCode} in {ElapsedMs}ms",
                (int)response.StatusCode, sw.ElapsedMilliseconds);

            if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
            {
                throw new UnauthorizedAccessException("LandLens authentication failed: Invalid or expired API key.");
            }

            if (!response.IsSuccessStatusCode)
            {
                return Array.Empty<LandLensToolDefinition>();
            }

            var root = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOpts, ct);
            var tools = new List<LandLensToolDefinition>();

            if (root.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in root.EnumerateArray())
                {
                    tools.Add(ParseTool(el));
                }
            }
            else if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("tools", out var toolsArr) && toolsArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in toolsArr.EnumerateArray())
                {
                    tools.Add(ParseTool(el));
                }
            }

            return tools;
        }
        catch (Exception ex) when (ex is not UnauthorizedAccessException && ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Error communicating with LandLens GET /tools");
            return Array.Empty<LandLensToolDefinition>();
        }
    }

    public async Task<ResolveParcelResult?> ResolveParcelAsync(double lat, double lng, CancellationToken ct = default)
    {
        EnsureConfigured();
        var payload = new { lat, lng };
        var envelope = await PostToolAsync<JsonElement>("resolve_parcel", payload, ct);

        if (envelope?.Ok != true || envelope.Data.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var d = envelope.Data;
        var ld = d.TryGetProperty("land_data", out var landData) && landData.ValueKind == JsonValueKind.Object ? landData : d;

        var extentAcres = GetDecimalProp(d, "extent_acres") ?? GetDecimalProp(ld, "extent_acres");
        var extentSqFt = GetDecimalProp(d, "extent_sqft") ?? GetDecimalProp(ld, "extent_sqft")
            ?? (extentAcres.HasValue ? Math.Round(extentAcres.Value * 43560m, 2) : null);
        var extentCents = GetDecimalProp(d, "extent_cents") ?? GetDecimalProp(ld, "extent_cents")
            ?? (extentAcres.HasValue ? Math.Round(extentAcres.Value * 100m, 2) : null);

        object? boundary = null;
        if (ld.TryGetProperty("geojson_geom", out var gj) && gj.ValueKind == JsonValueKind.String)
        {
            boundary = gj.GetString();
        }
        else if (d.TryGetProperty("boundary", out var b))
        {
            boundary = b;
        }

        return new ResolveParcelResult(
            SurveyNumber: GetStringProp(d, "survey_number") ?? GetStringProp(ld, "survey_number"),
            SubDivision: GetStringProp(d, "sub_division") ?? GetStringProp(ld, "sub_division"),
            VillageName: GetStringProp(d, "village_name") ?? GetStringProp(ld, "village_name"),
            TalukName: GetStringProp(d, "taluk_name") ?? GetStringProp(ld, "taluk_name"),
            DistrictName: GetStringProp(d, "district_name") ?? GetStringProp(ld, "district_name"),
            RuralUrban: GetStringProp(d, "rural_urban") ?? GetStringProp(ld, "rural_urban"),
            Ulpin: GetStringProp(d, "ulpin") ?? GetStringProp(ld, "ulpin"),
            ExtentSqFt: extentSqFt,
            ExtentCents: extentCents,
            BoundaryGeoJson: boundary,
            FirkaWardNumber: GetStringProp(d, "firka_ward_number") ?? GetStringProp(ld, "firka_ward_number"),
            UrbanBlockNumber: GetStringProp(d, "urban_block_number") ?? GetStringProp(ld, "urban_block_number")
        );
    }

    public async Task<GuidelineValueResult?> GetGuidelineValueAsync(GuidelineValueRequest request, CancellationToken ct = default)
    {
        EnsureConfigured();
        var payload = new
        {
            survey_number = request.SurveyNumber,
            sub_division = request.SubDivision,
            village_name = request.VillageName,
            district_name = request.DistrictName,
            rural_urban = request.RuralUrban,
            lat = request.Lat,
            lng = request.Lng,
            road_name = request.RoadName,
            zone = request.Zone,
            sro = request.Sro,
            urban_block_number = request.UrbanBlockNumber,
            firka_ward_number = request.FirkaWardNumber,
            taluk_name = request.TalukName
        };

        var envelope = await PostToolAsync<JsonElement>("guideline_value", payload, ct);
        if (envelope?.Ok != true || envelope.Data.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var d = envelope.Data;

        // Check if rate is nested in guideline array
        JsonElement targetElement = d;
        if (d.TryGetProperty("guideline", out var gArr) && gArr.ValueKind == JsonValueKind.Array && gArr.GetArrayLength() > 0)
        {
            // Pick first item with non-zero rate, or first item
            JsonElement? positiveItem = null;
            foreach (var item in gArr.EnumerateArray())
            {
                var testRate = GetDecimalProp(item, "rate_per_sqft")
                    ?? GetDecimalProp(item, "val_per_sqft")
                    ?? GetDecimalProp(item, "value_per_sqft")
                    ?? GetDecimalProp(item, "value_2024")
                    ?? GetDecimalProp(item, "val_original");

                if (testRate.HasValue && testRate.Value > 0)
                {
                    positiveItem = item;
                    break;
                }
            }

            targetElement = positiveItem ?? gArr[0];
        }

        var rateSqFt = GetDecimalProp(targetElement, "guideline_rate_per_sqft")
            ?? GetDecimalProp(targetElement, "rate_per_sqft")
            ?? GetDecimalProp(targetElement, "val_per_sqft")
            ?? GetDecimalProp(targetElement, "value_per_sqft")
            ?? GetDecimalProp(targetElement, "value_2024")
            ?? GetDecimalProp(targetElement, "val_original");

        var rateCent = GetDecimalProp(targetElement, "guideline_rate_per_cent")
            ?? GetDecimalProp(targetElement, "rate_per_cent")
            ?? (rateSqFt.HasValue && rateSqFt.Value > 0 ? Math.Round(rateSqFt.Value * 435.6m, 2) : null);

        return new GuidelineValueResult(
            GuidelineRatePerSqFt: rateSqFt,
            GuidelineRatePerCent: rateCent,
            Classification: GetStringProp(targetElement, "classification") ?? GetStringProp(targetElement, "category_name") ?? GetStringProp(targetElement, "land_type"),
            StreetName: GetStringProp(targetElement, "street_name") ?? GetStringProp(targetElement, "road_name"),
            Unit: GetStringProp(targetElement, "unit") ?? "sq.ft",
            Zone: GetStringProp(targetElement, "zone_name") ?? GetStringProp(targetElement, "zone"),
            Sro: GetStringProp(targetElement, "sro_name") ?? GetStringProp(targetElement, "sro")
        );
    }

    public async Task<LocalityValueContextResult?> GetLocalityValueContextAsync(string village, string? zone = null, CancellationToken ct = default)
    {
        EnsureConfigured();
        var payload = string.IsNullOrWhiteSpace(zone)
            ? (object)new { village }
            : new { village, zone };
        var envelope = await PostToolAsync<JsonElement>("locality_value_context", payload, ct);

        if (envelope?.Ok != true || envelope.Data.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var d = envelope.Data;
        if (d.TryGetProperty("bands", out var bands) && bands.TryGetProperty("village", out var vBand))
        {
            string name = GetStringProp(vBand, "name") ?? village;
            int pricedStreets = vBand.TryGetProperty("priced_streets", out var ps) ? ps.GetInt32() : 0;
            decimal min = GetDecimalProp(vBand, "min") ?? 0m;
            decimal median = GetDecimalProp(vBand, "median") ?? 0m;
            decimal max = GetDecimalProp(vBand, "max") ?? 0m;
            string? cheapest = GetStringProp(vBand, "cheapest_street");
            string? dearest = GetStringProp(vBand, "dearest_street");

            return new LocalityValueContextResult(
                VillageName: name,
                PricedStreetsCount: pricedStreets,
                MinRatePerSqFt: min,
                MedianRatePerSqFt: median,
                MaxRatePerSqFt: max,
                CheapestStreet: cheapest,
                DearestStreet: dearest,
                ZoneName: zone
            );
        }

        return null;
    }

    public async Task<GuidelineHistoryResult?> GetGuidelineHistoryAsync(GuidelineHistoryRequest request, CancellationToken ct = default)
    {
        EnsureConfigured();
        var payload = new
        {
            survey_number = request.SurveyNumber,
            sub_division = request.SubDivision,
            village_name = request.VillageName,
            district_name = request.DistrictName,
            rural_urban = request.RuralUrban
        };

        var envelope = await PostToolAsync<JsonElement>("guideline_history", payload, ct);
        if (envelope?.Ok != true)
        {
            return null;
        }

        var entries = new List<GuidelineHistoryEntry>();
        if (envelope.Data.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in envelope.Data.EnumerateArray())
            {
                int year = item.TryGetProperty("year", out var y) ? y.GetInt32() : 0;
                decimal sqft = GetDecimalProp(item, "rate_per_sqft") ?? 0m;
                decimal cent = GetDecimalProp(item, "rate_per_cent") ?? 0m;
                string? cls = GetStringProp(item, "classification");
                entries.Add(new GuidelineHistoryEntry(year, sqft, cent, cls));
            }
        }

        return new GuidelineHistoryResult(entries);
    }

    public async Task<PriceMapInitiationResult> RequestPriceMapAsync(PriceMapRequest request, CancellationToken ct = default)
    {
        EnsureConfigured();

        // Guard against initiating paid request if balance is known to be depleted
        var account = await GetAccountStatusAsync(ct);
        if (account != null && account.Balance < 4)
        {
            _logger.LogWarning("Refusing Price Map request: account credit balance ({Balance}) is less than required (4 credits).",
                account.Balance);
            return new PriceMapInitiationResult(
                Initiated: false,
                JobId: null,
                Message: $"Insufficient credits. Price Map requires 4 credits, but current balance is {account.Balance}.",
                CreditsCharged: 0,
                BalanceAfter: account.Balance
            );
        }

        var payload = new
        {
            lat = request.Lat,
            lng = request.Lng,
            survey_number = request.SurveyNumber,
            sub_division = request.SubDivision
        };

        // Note: strictly zero auto-retry policy on paid endpoints to prevent duplicate credit deduction
        var envelope = await PostToolAsync<JsonElement>("pricemap", payload, ct, isPaidRequest: true);

        if (envelope == null)
        {
            return new PriceMapInitiationResult(
                Initiated: false,
                JobId: null,
                Message: "Failed to initiate Price Map report due to upstream error.",
                CreditsCharged: 0,
                BalanceAfter: account?.Balance ?? 0
            );
        }

        string? jobId = null;
        if (envelope.Data.ValueKind == JsonValueKind.Object && envelope.Data.TryGetProperty("job_id", out var j))
        {
            jobId = j.GetString();
        }

        return new PriceMapInitiationResult(
            Initiated: envelope.Ok,
            JobId: jobId,
            Message: envelope.Message ?? envelope.Status,
            CreditsCharged: envelope.CreditsCharged,
            BalanceAfter: envelope.BalanceAfter
        );
    }

    public async Task<PriceMapTransactionsResult?> GetPriceMapTransactionsAsync(PriceMapTransactionsRequest request, CancellationToken ct = default)
    {
        EnsureConfigured();
        var payload = new
        {
            price_map_id = request.PriceMapId,
            survey_number = request.SurveyNumber
        };

        var envelope = await PostToolAsync<JsonElement>("pricemap_transactions", payload, ct);
        if (envelope?.Ok != true)
        {
            return null;
        }

        var deeds = new List<PriceMapTransactionDeed>();
        if (envelope.Data.ValueKind == JsonValueKind.Object && envelope.Data.TryGetProperty("transactions", out var txArr) && txArr.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in txArr.EnumerateArray())
            {
                deeds.Add(new PriceMapTransactionDeed(
                    DocumentNumber: GetStringProp(item, "doc_number") ?? GetStringProp(item, "document_number"),
                    RegistrationDate: item.TryGetProperty("registration_date", out var d) && d.TryGetDateTime(out var dt) ? dt : null,
                    PropertyType: GetStringProp(item, "property_type"),
                    AreaSqFt: GetDecimalProp(item, "area_sqft"),
                    TotalValue: GetDecimalProp(item, "total_value"),
                    RatePerSqFt: GetDecimalProp(item, "rate_per_sqft")
                ));
            }
        }

        return new PriceMapTransactionsResult(request.PriceMapId, request.SurveyNumber, deeds);
    }

    private async Task<LandLensEnvelope<T>?> PostToolAsync<T>(string toolName, object payload, CancellationToken ct, bool isPaidRequest = false)
    {
        var sw = Stopwatch.StartNew();

        try
        {
            using var request = CreateAuthorizedRequest(HttpMethod.Post, $"tools/{toolName}");
            request.Content = JsonContent.Create(payload, options: JsonOpts);

            using var response = await _httpClient.SendAsync(request, ct);
            sw.Stop();

            _logger.LogInformation("LandLens tool '{ToolName}' completed with HTTP {StatusCode} in {ElapsedMs}ms",
                toolName, (int)response.StatusCode, sw.ElapsedMilliseconds);

            if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
            {
                _logger.LogWarning("LandLens authentication failed on tool '{ToolName}' (HTTP {StatusCode})",
                    toolName, (int)response.StatusCode);
                throw new UnauthorizedAccessException($"LandLens authorization failed for tool '{toolName}'.");
            }

            if (response.StatusCode == (HttpStatusCode)402) // Payment Required
            {
                _logger.LogWarning("LandLens payment required on tool '{ToolName}': Not enough credits.", toolName);
                return new LandLensEnvelope<T>
                {
                    Ok = false,
                    Status = "PaymentRequired",
                    Error = "Insufficient credits to execute this tool.",
                    CreditsCharged = 0
                };
            }

            if (response.StatusCode == (HttpStatusCode)429) // Rate limit
            {
                _logger.LogWarning("LandLens rate limit encountered on tool '{ToolName}'.", toolName);
                return new LandLensEnvelope<T>
                {
                    Ok = false,
                    Status = "RateLimited",
                    Error = "Rate limit reached. Please wait before retrying."
                };
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("LandLens tool '{ToolName}' returned HTTP error {StatusCode}",
                    toolName, (int)response.StatusCode);
                return null;
            }

            var envelope = await response.Content.ReadFromJsonAsync<LandLensEnvelope<T>>(JsonOpts, ct);
            if (envelope != null && envelope.CreditsCharged > 0)
            {
                _logger.LogInformation("LandLens tool '{ToolName}' charged {Credits} credits (New balance: {BalanceAfter})",
                    toolName, envelope.CreditsCharged, envelope.BalanceAfter);
            }

            return envelope;
        }
        catch (Exception ex) when (ex is not UnauthorizedAccessException && ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Exception calling LandLens tool '{ToolName}'", toolName);
            if (isPaidRequest)
            {
                _logger.LogWarning("Zero auto-retry policy strictly observed on paid tool '{ToolName}' to protect credits.", toolName);
            }
            return null;
        }
    }

    private HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string endpoint)
    {
        var request = new HttpRequestMessage(method, endpoint);
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        }
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new InvalidOperationException(
                "LandLens API key is not configured. Please set the LANDLENS_API_KEY environment variable or LandLens:ApiKey in configuration.");
        }
    }

    private static LandLensToolDefinition ParseTool(JsonElement el)
    {
        string name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
        string? summary = el.TryGetProperty("summary", out var s) ? s.GetString() : null;
        string? description = el.TryGetProperty("description", out var d) ? d.GetString() : null;
        int cost = el.TryGetProperty("cost_credits", out var c) ? c.GetInt32() : 0;
        bool isFree = el.TryGetProperty("is_free", out var f) ? f.GetBoolean() : cost == 0;
        string? category = el.TryGetProperty("category", out var cat) ? cat.GetString() : null;

        return new LandLensToolDefinition(name, summary, description, cost, isFree, category);
    }

    private static string? GetStringProp(JsonElement el, string propName)
    {
        return el.TryGetProperty(propName, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
    }

    private static decimal? GetDecimalProp(JsonElement el, string propName)
    {
        if (el.TryGetProperty(propName, out var p))
        {
            if (p.ValueKind == JsonValueKind.Number && p.TryGetDecimal(out var dec)) return dec;
            if (p.ValueKind == JsonValueKind.String && decimal.TryParse(p.GetString(), out var parsed)) return parsed;
        }
        return null;
    }
}
