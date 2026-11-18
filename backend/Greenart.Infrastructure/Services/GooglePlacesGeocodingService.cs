using System.Net;
using System.Globalization;
using Greenart.Application.Common.Exceptions;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.ValueObjects;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Services;

public class GeocodingOptions
{
    public const string SectionName = "GeocodingSettings";
    public string BaseUrl { get; set; } = "https://places.googleapis.com/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string DefaultRegion { get; set; } = "in";
    public int TimeoutSeconds { get; set; } = 15;
}

public class GooglePlacesGeocodingService : IGeocodingService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GooglePlacesGeocodingService> _logger;
    private readonly GeocodingOptions _options;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public GooglePlacesGeocodingService(
        HttpClient httpClient,
        IMemoryCache cache,
        IConfiguration configuration,
        ILogger<GooglePlacesGeocodingService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;

        _options = new GeocodingOptions();
        var section = configuration.GetSection(GeocodingOptions.SectionName);
        if (section != null)
        {
            if (!string.IsNullOrWhiteSpace(section["BaseUrl"])) _options.BaseUrl = section["BaseUrl"]!;
            if (!string.IsNullOrWhiteSpace(section["ApiKey"])) _options.ApiKey = section["ApiKey"]!;
            if (!string.IsNullOrWhiteSpace(section["DefaultRegion"])) _options.DefaultRegion = section["DefaultRegion"]!;
            if (int.TryParse(section["TimeoutSeconds"], out var t) && t > 0) _options.TimeoutSeconds = t;
        }

        // Support environment variable overrides
        var envKey = configuration["GEOCODING_API_KEY"];
        if (!string.IsNullOrWhiteSpace(envKey))
        {
            _options.ApiKey = envKey;
        }

        var envBase = configuration["GEOCODING_API_BASE_URL"];
        if (!string.IsNullOrWhiteSpace(envBase))
        {
            _options.BaseUrl = envBase;
        }

        var envRegion = configuration["GEOCODING_DEFAULT_REGION"];
        if (!string.IsNullOrWhiteSpace(envRegion))
        {
            _options.DefaultRegion = envRegion;
        }

        if (_options.TimeoutSeconds > 0)
        {
            _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
        }
    }

    public async Task<IReadOnlyList<LocalitySuggestionDto>> SearchLocalitiesAsync(string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
            return Array.Empty<LocalitySuggestionDto>();
        EnsureConfigured();
        var cacheKey = $"locality_search_{query.Trim().ToLowerInvariant()}_{_options.DefaultRegion}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<LocalitySuggestionDto>? cached) && cached != null) return cached;
        using var request = CreateRequest(HttpMethod.Post, "places:autocomplete");
        request.Content = JsonContent.Create(new { input = query.Trim(), includedRegionCodes = new[] { _options.DefaultRegion } }, options: JsonOpts);
        var data = await SendAsync<GoogleAutocompleteResponse>(request, ct);
        var results = (data!.Suggestions ?? new()).Where(item => !string.IsNullOrWhiteSpace(item.PlacePrediction?.PlaceId))
            .Select(item =>
            {
                var prediction = item.PlacePrediction!;
                var main = prediction.StructuredFormat?.MainText?.Text ?? prediction.Text?.Text ?? "";
                var secondary = prediction.StructuredFormat?.SecondaryText?.Text ?? "";
                return new LocalitySuggestionDto(prediction.PlaceId!, main, secondary,
                    prediction.Text?.Text ?? $"{main}, {secondary}".TrimEnd(',', ' '), prediction.Types ?? new());
            }).ToList();
        _cache.Set(cacheKey, (IReadOnlyList<LocalitySuggestionDto>)results, TimeSpan.FromMinutes(30));
        return results;
    }

    public async Task<LocalityDetailsDto?> GetPlaceDetailsAsync(string placeId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(placeId)) return null;
        EnsureConfigured();
        var cacheKey = $"locality_details_{placeId.Trim()}";
        if (_cache.TryGetValue(cacheKey, out LocalityDetailsDto? cached) && cached != null) return cached;
        using var request = CreateRequest(HttpMethod.Get, $"places/{Uri.EscapeDataString(placeId.Trim())}");
        request.Headers.Add("X-Goog-FieldMask", "id,displayName,formattedAddress,location,addressComponents");
        var data = await SendAsync<GooglePlaceDetailsResponse>(request, ct, allowNotFound: true);
        if (data == null) return null;
        var details = MapPlace(data, placeId.Trim());
        _cache.Set(cacheKey, details, TimeSpan.FromHours(24));
        return details;
    }

    public async Task<ReverseGeocodeResultDto?> ReverseGeocodeCoordinatesAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        var cacheKey = $"reverse_geo_{latitude:F4}_{longitude:F4}";
        if (_cache.TryGetValue(cacheKey, out ReverseGeocodeResultDto? cached) && cached != null)
        {
            return cached;
        }

        var defaultDistrict = TamilNaduGeoBounds.NormalizeDistrict(null, "Coimbatore");
        var defaultState = "Tamil Nadu";
        var defaultLocality = "Selected Pin Location";

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            return CreateDefaultFallback(latitude, longitude, defaultLocality, defaultDistrict, defaultState);
        }

        try
        {
            var url = $"https://maps.googleapis.com/maps/api/geocode/json?latlng={latitude.ToString(CultureInfo.InvariantCulture)},{longitude.ToString(CultureInfo.InvariantCulture)}&key={_options.ApiKey}";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            using var resp = await _httpClient.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google Geocoding reverse lookup returned HTTP {Code}", resp.StatusCode);
                return CreateDefaultFallback(latitude, longitude, defaultLocality, defaultDistrict, defaultState);
            }

            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var root = doc.RootElement;
            if (root.TryGetProperty("status", out var statusElem) && statusElem.GetString() == "OK" &&
                root.TryGetProperty("results", out var resultsElem) && resultsElem.GetArrayLength() > 0)
            {
                var firstResult = resultsElem[0];
                var formattedAddress = firstResult.TryGetProperty("formatted_address", out var fa) ? fa.GetString() ?? "" : "";

                string neighborhood = "";
                string locality = "";
                string taluk = "";
                string district = "";
                string state = "Tamil Nadu";
                var landmarks = new List<string>();

                foreach (var resultItem in resultsElem.EnumerateArray())
                {
                    if (resultItem.TryGetProperty("address_components", out var components))
                    {
                        foreach (var comp in components.EnumerateArray())
                        {
                            var longName = comp.TryGetProperty("long_name", out var ln) ? ln.GetString() ?? "" : "";
                            if (comp.TryGetProperty("types", out var types))
                            {
                                foreach (var t in types.EnumerateArray())
                                {
                                    var typeStr = t.GetString() ?? "";
                                    if (string.IsNullOrEmpty(neighborhood) && (typeStr == "sublocality_level_1" || typeStr == "sublocality" || typeStr == "neighborhood"))
                                        neighborhood = longName;
                                    else if (string.IsNullOrEmpty(locality) && typeStr == "locality")
                                        locality = longName;
                                    else if (string.IsNullOrEmpty(taluk) && typeStr == "administrative_area_level_3")
                                        taluk = longName;
                                    else if (string.IsNullOrEmpty(district) && typeStr == "administrative_area_level_2")
                                        district = TamilNaduGeoBounds.NormalizeDistrict(longName, "Tamil Nadu");
                                    else if (typeStr == "administrative_area_level_1")
                                        state = longName;
                                    else if ((typeStr == "route" || typeStr == "point_of_interest" || typeStr == "transit_station" || typeStr == "establishment" || typeStr == "landmark" || typeStr == "natural_feature") && !landmarks.Contains(longName) && !string.IsNullOrWhiteSpace(longName))
                                        landmarks.Add(longName);
                                }
                            }
                        }
                    }
                }

                if (string.IsNullOrWhiteSpace(locality)) locality = !string.IsNullOrWhiteSpace(neighborhood) ? neighborhood : defaultLocality;
                if (string.IsNullOrWhiteSpace(district))
                {
                    if (TamilNaduGeoBounds.IsValidTamilNaduDistrict(locality))
                        district = TamilNaduGeoBounds.NormalizeDistrict(locality);
                    else if (TamilNaduGeoBounds.IsValidTamilNaduDistrict(taluk))
                        district = TamilNaduGeoBounds.NormalizeDistrict(taluk);
                    else if (TamilNaduGeoBounds.IsValidTamilNaduDistrict(neighborhood))
                        district = TamilNaduGeoBounds.NormalizeDistrict(neighborhood);
                    else
                        district = defaultDistrict;
                }

                if (landmarks.Count == 0) landmarks.AddRange(new[] { "Main Arterial Road / State Highway", "Town Center Corridor" });

                var specificLocationQuery = BuildCleanAddress(neighborhood, locality, taluk, district, state);

                var dto = new ReverseGeocodeResultDto(
                    FormattedAddress: BuildCleanAddress(formattedAddress),
                    Locality: locality,
                    Neighborhood: neighborhood,
                    Taluk: taluk,
                    District: district,
                    State: state,
                    NearbyLandmarks: landmarks.Take(4).ToList(),
                    SpecificLocationQuery: specificLocationQuery
                );

                _cache.Set(cacheKey, dto, TimeSpan.FromHours(24));
                return dto;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to reverse-geocode coordinates ({Lat}, {Lng})", latitude, longitude);
        }

        return CreateDefaultFallback(latitude, longitude, defaultLocality, defaultDistrict, defaultState);
    }

    private static ReverseGeocodeResultDto CreateDefaultFallback(double latitude, double longitude, string locality, string district, string state)
    {
        return new ReverseGeocodeResultDto(
            FormattedAddress: BuildCleanAddress(locality, district, state),
            Locality: locality,
            Neighborhood: locality,
            Taluk: district,
            District: district,
            State: state,
            NearbyLandmarks: new List<string> { "Main Arterial Highway", "Local Town Center" },
            SpecificLocationQuery: BuildCleanAddress(locality, district, state)
        );
    }

    public static string BuildCleanAddress(params string?[] parts)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var clean = new List<string>();
        foreach (var raw in parts)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var subParts = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var sub in subParts)
            {
                var trimmed = sub.Trim();
                if (System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^\d{6}$")) continue;
                if (trimmed.Equals("India", StringComparison.OrdinalIgnoreCase)) continue;
                if (trimmed.Equals("Selected Pin Location", StringComparison.OrdinalIgnoreCase)) continue;

                if (!seen.Contains(trimmed))
                {
                    seen.Add(trimmed);
                    clean.Add(trimmed);
                }
            }
        }
        return string.Join(", ", clean);
    }

    public async Task<LocalityDetailsDto?> GeocodeAddressAsync(string address, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(address)) return null;
        var trimmed = address.Trim();
        var match = System.Text.RegularExpressions.Regex.Match(trimmed, @"^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$");
        if (match.Success && double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) &&
            double.TryParse(match.Groups[2].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var lng) &&
            lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98)
            return new LocalityDetailsDto(FormattableString.Invariant($"coord_{lat:F4}_{lng:F4}"),
                "Custom Pin Location", trimmed, lat, lng, "Custom Pin Location", "", "", "");
        EnsureConfigured();
        var cacheKey = $"geocode_address_{trimmed.ToLowerInvariant()}_{_options.DefaultRegion}";
        if (_cache.TryGetValue(cacheKey, out LocalityDetailsDto? cached) && cached != null) return cached;
        using var request = CreateRequest(HttpMethod.Post, "places:searchText");
        request.Headers.Add("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents");
        request.Content = JsonContent.Create(new { textQuery = trimmed, regionCode = _options.DefaultRegion }, options: JsonOpts);
        var data = await SendAsync<GoogleTextSearchResponse>(request, ct);
        if (data!.Places == null || data.Places.Count == 0) return null;
        var details = MapPlace(data.Places[0], trimmed);
        _cache.Set(cacheKey, details, TimeSpan.FromHours(24));
        return details;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string endpoint)
    {
        var request = new HttpRequestMessage(method, $"{_options.BaseUrl.TrimEnd('/')}/{endpoint}");
        request.Headers.Add("X-Goog-Api-Key", _options.ApiKey);
        return request;
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey)) throw new GeocodingException(GeocodingFailure.NotConfigured);
    }

    private async Task<T?> SendAsync<T>(HttpRequestMessage request, CancellationToken ct, bool allowNotFound = false) where T : class
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            using var response = await _httpClient.SendAsync(request, ct);
            if (allowNotFound && response.StatusCode == HttpStatusCode.NotFound) return null;
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Location provider returned HTTP {StatusCode}", (int)response.StatusCode);
                throw new GeocodingException(response.StatusCode switch
                {
                    HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => GeocodingFailure.PermissionDenied,
                    HttpStatusCode.TooManyRequests => GeocodingFailure.RateLimited,
                    _ => GeocodingFailure.Unavailable
                });
            }
            return await response.Content.ReadFromJsonAsync<T>(JsonOpts, ct)
                ?? throw new GeocodingException(GeocodingFailure.InvalidResponse);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { throw new GeocodingException(GeocodingFailure.Timeout); }
        catch (HttpRequestException) { throw new GeocodingException(GeocodingFailure.Unavailable); }
        catch (JsonException) { throw new GeocodingException(GeocodingFailure.InvalidResponse); }
    }

    private static LocalityDetailsDto MapPlace(GooglePlaceDetailsResponse place, string fallbackName)
    {
        var lat = place.Location?.Latitude;
        var lng = place.Location?.Longitude;
        if (!lat.HasValue || !lng.HasValue || !double.IsFinite(lat.Value) || !double.IsFinite(lng.Value) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180)
            throw new GeocodingException(GeocodingFailure.InvalidResponse);
        string Component(params string[] types)
        {
            foreach (var type in types)
            {
                var part = place.AddressComponents?.FirstOrDefault(c => c.Types?.Contains(type) == true);
                if (!string.IsNullOrWhiteSpace(part?.LongText ?? part?.ShortText)) return part!.LongText ?? part.ShortText!;
            }
            return "";
        }
        var name = place.DisplayName?.Text ?? place.FormattedAddress ?? fallbackName;
        var locality = Component("locality", "sublocality");
        return new LocalityDetailsDto(place.Id ?? fallbackName, name, place.FormattedAddress ?? name,
            lat.Value, lng.Value, string.IsNullOrEmpty(locality) ? name : locality,
            Component("administrative_area_level_2", "administrative_area_level_3"),
            Component("administrative_area_level_1"), Component("country"));
    }

    #region Google API JSON Contract Models
    private sealed class GoogleTextSearchResponse
    {
        public List<GooglePlaceDetailsResponse>? Places { get; set; }
    }
    private sealed class GoogleAutocompleteResponse
    {
        public List<GoogleSuggestionItem>? Suggestions { get; set; }
    }

    private sealed class GoogleSuggestionItem
    {
        public GooglePlacePrediction? PlacePrediction { get; set; }
    }

    private sealed class GooglePlacePrediction
    {
        public string? PlaceId { get; set; }
        public GoogleTextContainer? Text { get; set; }
        public GoogleStructuredFormat? StructuredFormat { get; set; }
        public List<string>? Types { get; set; }
    }

    private sealed class GoogleStructuredFormat
    {
        public GoogleTextContainer? MainText { get; set; }
        public GoogleTextContainer? SecondaryText { get; set; }
    }

    private sealed class GoogleTextContainer
    {
        public string? Text { get; set; }
    }

    private sealed class GooglePlaceDetailsResponse
    {
        public string? Id { get; set; }
        public GoogleTextContainer? DisplayName { get; set; }
        public string? FormattedAddress { get; set; }
        public GoogleLocation? Location { get; set; }
        public List<GoogleAddressComponent>? AddressComponents { get; set; }
    }

    private sealed class GoogleLocation
    {
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
    }

    private sealed class GoogleAddressComponent
    {
        public string? LongText { get; set; }
        public string? ShortText { get; set; }
        public List<string>? Types { get; set; }
    }
    #endregion
}
