using System.Diagnostics;
using System.Globalization;
using Greenart.Application.Common.Exceptions;
using Greenart.Domain.Enums;
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
        var root = await SendJsonAsync(HttpMethod.Get, "me", null, ct);
        var data = UnwrapData(root);
        if (data.ValueKind != JsonValueKind.Object)
            throw new LandLensUpstreamException(LandLensFailure.InvalidResponse);
        var balance = GetIntProp(data, "balance");
        if (!balance.HasValue)
            throw new LandLensUpstreamException(LandLensFailure.InvalidResponse);
        var credential = GetStringProp(data, "credential");
        decimal? dailyCap = null;
        IReadOnlyList<string>? allowedTools = null;
        if (data.TryGetProperty("credential", out var details) && details.ValueKind == JsonValueKind.Object)
        {
            credential = GetStringProp(details, "name");
            dailyCap = GetDecimalProp(details, "daily_credit_cap");
            if (details.TryGetProperty("tools", out var tools) && tools.ValueKind == JsonValueKind.Array)
                allowedTools = tools.EnumerateArray().Where(tool => tool.ValueKind == JsonValueKind.String)
                    .Select(tool => tool.GetString()!).ToList();
        }
        return new LandLensAccountResponse(credential ?? "Configured account", balance.Value,
            GetDecimalProp(data, "spent_today_by_this_credential") ?? GetDecimalProp(data, "spent_today") ?? 0m,
            DailyCreditCap: dailyCap, AllowedTools: allowedTools);
    }

    public async Task<IReadOnlyList<LandLensToolDefinition>> GetToolsAsync(CancellationToken ct = default)
    {
        var root = UnwrapData(await SendJsonAsync(HttpMethod.Get, "tools", null, ct));
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("tools", out var tools)) root = tools;
        if (root.ValueKind != JsonValueKind.Array)
            throw new LandLensUpstreamException(LandLensFailure.InvalidResponse);
        return root.EnumerateArray().Select(ParseTool).ToList();
    }

    public async Task<ResolveParcelResult?> ResolveParcelAsync(double lat, double lng, CancellationToken ct = default)
    {
        EnsureConfigured();
        var payload = new { lat, lng };
        var envelope = await PostToolAsync<JsonElement>("resolve_parcel", payload, ct);

        if (envelope?.Ok != true || envelope.Data.ValueKind != JsonValueKind.Object || IsNotFound(envelope.Data))
        {
            return null;
        }

        var d = envelope.Data;
        var ld = d.TryGetProperty("land_data", out var landData) && landData.ValueKind == JsonValueKind.Object ? landData : d;

        var extentHectares = GetDecimalProp(d, "extent_hectares") ?? GetDecimalProp(ld, "extent_hectares");
        var extentAcres = GetDecimalProp(d, "extent_acres") ?? GetDecimalProp(ld, "extent_acres")
            ?? (extentHectares.HasValue ? extentHectares.Value * 2.4710538147m : null);
        var extentSqFt = GetDecimalProp(d, "extent_sqft") ?? GetDecimalProp(ld, "extent_sqft")
            ?? (extentAcres.HasValue ? Math.Round(extentAcres.Value * 43560m, 2) : null);
        var extentCents = GetDecimalProp(d, "extent_cents") ?? GetDecimalProp(ld, "extent_cents")
            ?? (extentAcres.HasValue ? Math.Round(extentAcres.Value * 100m, 2) : null);

        object? boundary = null;
        if (ld.TryGetProperty("geojson_geom", out var gj) && gj.ValueKind == JsonValueKind.String)
        {
            try { using var geometry = JsonDocument.Parse(gj.GetString()!); boundary = geometry.RootElement.Clone(); }
            catch (JsonException) { /* Preserve identity fields without claiming a valid boundary. */ }
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
            UrbanBlockNumber: GetStringProp(d, "urban_block_number") ?? GetStringProp(ld, "urban_block_number"),
            DistrictCode: GetStringProp(d, "district_code") ?? GetStringProp(ld, "district_code"),
            TalukCode: GetStringProp(d, "taluk_code") ?? GetStringProp(ld, "taluk_code"),
            VillageCode: GetStringProp(d, "village_code") ?? GetStringProp(ld, "village_code"),
            IsParcel: GetBoolProp(d, "is_parcel"),
            IdentityAmbiguous: GetBoolProp(d, "identity_ambiguous") ?? false,
            IdentityWarning: GetStringProp(d, "identity_warning")
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
            taluk_name = request.TalukName,
            rev_district_code = request.RevDistrictCode,
            rev_taluk_code = request.RevTalukCode,
            rev_village_code = request.RevVillageCode
        };

        var envelope = await PostToolAsync<JsonElement>("guideline_value", payload, ct);
        if (envelope?.Ok != true || envelope.Data.ValueKind != JsonValueKind.Object || IsNotFound(envelope.Data))
        {
            return null;
        }

        var d = envelope.Data;

        JsonElement targetElement = d;
        if (d.TryGetProperty("guideline", out var entries) && entries.ValueKind == JsonValueKind.Array)
        {
            var candidates = entries.EnumerateArray().Where(item =>
                (GetNormalizedSqFtRate(item) ?? GetDecimalProp(item, "rate_per_cent")) > 0).ToList();
            if (candidates.Count == 0) return null;
            if (request.LandUsage.HasValue)
            {
                var matches = candidates.Where(item => MatchesUsage(item, request.LandUsage.Value)).ToList();
                // Do not select an unrelated rate from a different land classification.
                if (matches.Count == 1) candidates = matches;
                else if (matches.Count > 1 || candidates.Count > 1 || HasClassification(candidates[0])) return null;
            }
            if (candidates.Count != 1) return null; // An administrator must disambiguate multiple entries.
            targetElement = candidates[0];
        }

        var rateSqFt = GetNormalizedSqFtRate(targetElement);
        var rateCent = GetDecimalProp(targetElement, "guideline_rate_per_cent")
            ?? GetDecimalProp(targetElement, "rate_per_cent");
        // Only documented normalized units are converted; val_original/value_2024 have no assumed unit.
        rateSqFt ??= rateCent.HasValue ? Math.Round(rateCent.Value / 435.6m, 4) : null;
        rateCent ??= rateSqFt.HasValue ? Math.Round(rateSqFt.Value * 435.6m, 2) : null;
        if (rateSqFt is not > 0 || rateCent is not > 0) return null;

        return new GuidelineValueResult(
            GuidelineRatePerSqFt: rateSqFt,
            GuidelineRatePerCent: rateCent,
            Classification: GetStringProp(targetElement, "classification") ?? GetStringProp(targetElement, "category_name") ?? GetStringProp(targetElement, "land_type"),
            StreetName: GetStringProp(targetElement, "street_name") ?? GetStringProp(targetElement, "road_name"),
            Unit: "sq.ft",
            Zone: GetStringProp(targetElement, "zone_name") ?? GetStringProp(targetElement, "zone"),
            Sro: GetStringProp(targetElement, "sro_name") ?? GetStringProp(targetElement, "sro"),
            MatchType: GetStringProp(d, "match_type"),
            RevisionDate: GetStringProp(d, "revision_date"),
            RateBasis: GetStringProp(targetElement, "rate_basis")
        );
    }

    public async Task<LocalityValueContextResult?> GetLocalityValueContextAsync(string village, string? zone = null, CancellationToken ct = default)
    {
        EnsureConfigured();
        var payload = string.IsNullOrWhiteSpace(zone)
            ? (object)new { village }
            : new { village, zone };
        var envelope = await PostToolAsync<JsonElement>("locality_value_context", payload, ct);

        if (envelope?.Ok != true || envelope.Data.ValueKind != JsonValueKind.Object || IsNotFound(envelope.Data))
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
            lat = request.Lat, lng = request.Lng,
            village = request.Village ?? request.VillageName,
            sro = request.Sro, street = request.Street,
            classification = request.Classification, current_value = request.CurrentValue
        };

        var envelope = await PostToolAsync<JsonElement>("guideline_history", payload, ct);
        if (envelope?.Ok != true)
        {
            return null;
        }

        if (envelope.Data.ValueKind == JsonValueKind.Object && IsNotFound(envelope.Data)) return null;
        var entries = new List<GuidelineHistoryEntry>();
        var data = envelope.Data;
        var unit = GetStringProp(data, "unit");
        var classification = GetStringProp(data, "classification");
        var series = data.ValueKind == JsonValueKind.Object && data.TryGetProperty("series", out var values) ? values : data;
        if (series.ValueKind != JsonValueKind.Array)
            throw new LandLensUpstreamException(LandLensFailure.InvalidResponse);
        foreach (var item in series.EnumerateArray())
        {
            var year = GetIntProp(item, "year");
            if (year is not > 0) continue;
            decimal? sqft = GetDecimalProp(item, "rate_per_sqft");
            decimal? cent = GetDecimalProp(item, "rate_per_cent");
            var registered = GetDecimalProp(item, "value");
            if (sqft > 0) cent ??= Math.Round(sqft.Value * 435.6m, 2);
            if (cent > 0) sqft ??= Math.Round(cent.Value / 435.6m, 4);
            // A historical 'value' in an unspecified register unit is never relabelled as INR/sq.ft.
            entries.Add(new GuidelineHistoryEntry(year.Value, sqft, cent,
                GetStringProp(item, "classification") ?? classification, registered, unit));
        }

        return new GuidelineHistoryResult(entries);
    }

    public async Task<PriceMapInitiationResult> RequestPriceMapAsync(PriceMapRequest request, CancellationToken ct = default)
    {
        EnsureConfigured();

        // Guard against initiating paid request if balance is known to be depleted
        var account = await GetAccountStatusAsync(ct)
            ?? throw new LandLensUpstreamException(LandLensFailure.InvalidResponse);
        if (account.Balance < 4)
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

        string? jobId = null;
        if (envelope.Data.ValueKind == JsonValueKind.Object && envelope.Data.TryGetProperty("job_id", out var j))
        {
            jobId = j.GetString();
        }

        return new PriceMapInitiationResult(
            Initiated: envelope.Ok && !string.IsNullOrWhiteSpace(jobId),
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

    private async Task<LandLensEnvelope<T>> PostToolAsync<T>(string toolName, object payload, CancellationToken ct, bool isPaidRequest = false)
    {
        var root = await SendJsonAsync(HttpMethod.Post, $"tools/{toolName}", payload, ct, isPaidRequest);
        try
        {
            var envelope = root.Deserialize<LandLensEnvelope<T>>(JsonOpts);
            if (envelope == null || root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("ok", out _) ||
                (envelope.Ok && !string.Equals(envelope.Status, "not_found", StringComparison.OrdinalIgnoreCase) &&
                 (!root.TryGetProperty("data", out var payloadData) || payloadData.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)))
                throw new LandLensUpstreamException(LandLensFailure.InvalidResponse, chargeOutcomeUnknown: isPaidRequest);
            if (!envelope.Ok && !string.Equals(envelope.Status, "not_found", StringComparison.OrdinalIgnoreCase))
                throw new LandLensUpstreamException(LandLensFailure.Unavailable, chargeOutcomeUnknown: isPaidRequest);
            return envelope;
        }
        catch (JsonException)
        {
            throw new LandLensUpstreamException(LandLensFailure.InvalidResponse, chargeOutcomeUnknown: isPaidRequest);
        }
    }

    private async Task<JsonElement> SendJsonAsync(HttpMethod method, string endpoint, object? payload,
        CancellationToken ct, bool paid = false)
    {
        EnsureConfigured();
        ct.ThrowIfCancellationRequested();
        var sw = Stopwatch.StartNew();
        try
        {
            using var request = CreateAuthorizedRequest(method, endpoint);
            if (payload != null) request.Content = JsonContent.Create(payload, options: JsonOpts);
            using var response = await _httpClient.SendAsync(request, ct);
            _logger.LogInformation("LandLens {Endpoint} returned HTTP {Status} in {ElapsedMs}ms", endpoint, (int)response.StatusCode, sw.ElapsedMilliseconds);
            if (!response.IsSuccessStatusCode)
            {
                var retry = response.Headers.RetryAfter?.Delta?.TotalSeconds
                    ?? (response.Headers.RetryAfter?.Date - DateTimeOffset.UtcNow)?.TotalSeconds;
                var failure = response.StatusCode switch
                {
                    HttpStatusCode.Unauthorized => LandLensFailure.Authentication,
                    HttpStatusCode.Forbidden => LandLensFailure.PermissionDenied,
                    HttpStatusCode.TooManyRequests => LandLensFailure.RateLimited,
                    HttpStatusCode.PaymentRequired => LandLensFailure.InsufficientCredits,
                    _ => LandLensFailure.Unavailable
                };
                throw new LandLensUpstreamException(failure,
                    retry.HasValue ? (int)Math.Clamp(Math.Ceiling(retry.Value), 0, 86400) : null,
                    chargeOutcomeUnknown: paid && (int)response.StatusCode >= 500);
            }
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var root = json.RootElement;
            if (GetBoolProp(root, "ok") == false && !string.Equals(GetStringProp(root, "status"), "not_found", StringComparison.OrdinalIgnoreCase))
            {
                var failure = GetStringProp(root, "status")?.ToLowerInvariant() switch
                {
                    "rate_limited" => LandLensFailure.RateLimited,
                    "unauthorized" => LandLensFailure.Authentication,
                    "forbidden" => LandLensFailure.PermissionDenied,
                    "insufficient_credits" => LandLensFailure.InsufficientCredits,
                    _ => LandLensFailure.Unavailable
                };
                throw new LandLensUpstreamException(failure, chargeOutcomeUnknown: paid);
            }
            return root.Clone();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new LandLensUpstreamException(LandLensFailure.Timeout, chargeOutcomeUnknown: paid);
        }
        catch (HttpRequestException)
        {
            throw new LandLensUpstreamException(LandLensFailure.Unavailable, chargeOutcomeUnknown: paid);
        }
        catch (JsonException)
        {
            throw new LandLensUpstreamException(LandLensFailure.InvalidResponse, chargeOutcomeUnknown: paid);
        }
        // No automatic retries: a failed paid request may already have consumed credits.
    }

    private static JsonElement UnwrapData(JsonElement root) =>
        root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var data) ? data : root;

    private static bool IsNotFound(JsonElement data) => GetBoolProp(data, "found") == false;
    private static bool? GetBoolProp(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) &&
        value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : null;

    private static decimal? GetNormalizedSqFtRate(JsonElement item) =>
        GetDecimalProp(item, "guideline_rate_per_sqft") ?? GetDecimalProp(item, "rate_per_sqft") ??
        GetDecimalProp(item, "val_per_sqft") ?? GetDecimalProp(item, "value_per_sqft");

    private static bool HasClassification(JsonElement item) => !string.IsNullOrWhiteSpace(
        GetStringProp(item, "classification") ?? GetStringProp(item, "category_name") ?? GetStringProp(item, "land_type"));

    private static bool MatchesUsage(JsonElement item, LandUsageType usage)
    {
        var classification = GetStringProp(item, "classification") ?? GetStringProp(item, "category_name") ?? GetStringProp(item, "land_type") ?? "";
        var keyword = usage switch
        {
            LandUsageType.Residential => "residential", LandUsageType.Commercial => "commercial",
            LandUsageType.Industrial => "industrial", LandUsageType.AgriculturalWet => "wet",
            LandUsageType.AgriculturalDry => "dry", _ => "mixed"
        };
        return classification.Contains(keyword, StringComparison.OrdinalIgnoreCase);
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
        if (el.ValueKind != JsonValueKind.Object || string.IsNullOrWhiteSpace(GetStringProp(el, "name")))
            throw new LandLensUpstreamException(LandLensFailure.InvalidResponse);
        string name = GetStringProp(el, "name")!;
        string? summary = el.TryGetProperty("summary", out var s) ? s.GetString() : null;
        string? description = el.TryGetProperty("description", out var d) ? d.GetString() : null;
        var cost = GetIntProp(el, "credits") ?? GetIntProp(el, "cost_credits");
        var maximum = GetIntProp(el, "credits_max");
        var isFree = cost == 0 && (maximum ?? 0) == 0;
        string? category = GetStringProp(el, "category");
        return new LandLensToolDefinition(name, summary, description, cost, isFree, category, maximum);
    }

    private static int? GetIntProp(JsonElement el, string name) =>
        GetDecimalProp(el, name) is decimal value && value == Math.Truncate(value) && value <= int.MaxValue && value >= int.MinValue ? (int)value : null;

    private static string? GetStringProp(JsonElement el, string propName)
    {
        return el.ValueKind == JsonValueKind.Object && el.TryGetProperty(propName, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
    }

    private static decimal? GetDecimalProp(JsonElement el, string propName)
    {
        if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(propName, out var p))
        {
            if (p.ValueKind == JsonValueKind.Number && p.TryGetDecimal(out var dec)) return dec;
            if (p.ValueKind == JsonValueKind.String && decimal.TryParse(p.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)) return parsed;
        }
        return null;
    }
}
