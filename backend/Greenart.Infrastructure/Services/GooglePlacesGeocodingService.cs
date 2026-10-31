using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
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
        {
            return Array.Empty<LocalitySuggestionDto>();
        }

        var normalizedQuery = query.Trim().ToLowerInvariant();
        var cacheKey = $"locality_search_{normalizedQuery}_{_options.DefaultRegion}";

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<LocalitySuggestionDto>? cached) && cached != null)
        {
            return cached;
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogWarning("Geocoding API key is not configured. Skipping Google Places search.");
            return Array.Empty<LocalitySuggestionDto>();
        }

        try
        {
            var requestUri = $"{_options.BaseUrl.TrimEnd('/')}/places:autocomplete";
            var requestBody = new
            {
                input = query.Trim(),
                includedRegionCodes = new[] { _options.DefaultRegion }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);
            request.Headers.Add("X-Goog-Api-Key", _options.ApiKey);
            request.Content = JsonContent.Create(requestBody, options: JsonOpts);

            using var response = await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var statusCode = (int)response.StatusCode;
                if (statusCode == (int)HttpStatusCode.Forbidden || statusCode == (int)HttpStatusCode.TooManyRequests)
                {
                    _logger.LogInformation("Google Places Autocomplete rate-limit/quota restriction (HTTP {StatusCode}).", statusCode);
                }
                else
                {
                    _logger.LogWarning("Google Places Autocomplete API returned non-success HTTP status {StatusCode}", statusCode);
                }
                return Array.Empty<LocalitySuggestionDto>();
            }

            var content = await response.Content.ReadAsStringAsync(ct);
            var apiResult = JsonSerializer.Deserialize<GoogleAutocompleteResponse>(content, JsonOpts);

            if (apiResult?.Suggestions == null || apiResult.Suggestions.Count == 0)
            {
                return Array.Empty<LocalitySuggestionDto>();
            }

            var results = new List<LocalitySuggestionDto>();
            foreach (var suggestion in apiResult.Suggestions)
            {
                if (suggestion.PlacePrediction == null || string.IsNullOrWhiteSpace(suggestion.PlacePrediction.PlaceId))
                {
                    continue;
                }

                var pred = suggestion.PlacePrediction;
                var main = pred.StructuredFormat?.MainText?.Text ?? pred.Text?.Text ?? string.Empty;
                var secondary = pred.StructuredFormat?.SecondaryText?.Text ?? string.Empty;
                var full = pred.Text?.Text ?? $"{main}, {secondary}".TrimEnd(',', ' ');
                var types = pred.Types ?? (IReadOnlyList<string>)Array.Empty<string>();

                results.Add(new LocalitySuggestionDto(pred.PlaceId, main, secondary, full, types));
            }

            // Cache for 30 minutes
            _cache.Set(cacheKey, (IReadOnlyList<LocalitySuggestionDto>)results, TimeSpan.FromMinutes(30));
            return results;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error calling Google Places Autocomplete API");
            return Array.Empty<LocalitySuggestionDto>();
        }
    }

    public async Task<LocalityDetailsDto?> GetPlaceDetailsAsync(string placeId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(placeId))
        {
            return null;
        }

        var trimmedId = placeId.Trim();
        var cacheKey = $"locality_details_{trimmedId}";

        if (_cache.TryGetValue(cacheKey, out LocalityDetailsDto? cached) && cached != null)
        {
            return cached;
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogWarning("Geocoding API key is not configured. Skipping Google Places Details call.");
            return null;
        }

        try
        {
            var requestUri = $"{_options.BaseUrl.TrimEnd('/')}/places/{Uri.EscapeDataString(trimmedId)}";
            using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
            request.Headers.Add("X-Goog-Api-Key", _options.ApiKey);
            request.Headers.Add("X-Goog-FieldMask", "id,displayName,formattedAddress,location,addressComponents");

            using var response = await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var statusCode = (int)response.StatusCode;
                if (statusCode == (int)HttpStatusCode.Forbidden || statusCode == (int)HttpStatusCode.TooManyRequests)
                {
                    _logger.LogInformation("Google Places Details rate-limit/quota restriction (HTTP {StatusCode}) for place {PlaceId}.", statusCode, trimmedId);
                }
                else
                {
                    _logger.LogWarning("Google Places Details API returned non-success HTTP status {StatusCode} for place {PlaceId}", statusCode, trimmedId);
                }
                return null;
            }

            var content = await response.Content.ReadAsStringAsync(ct);
            var place = JsonSerializer.Deserialize<GooglePlaceDetailsResponse>(content, JsonOpts);

            if (place?.Location == null)
            {
                _logger.LogWarning("Google Place Details did not contain geographic coordinates for place {PlaceId}", trimmedId);
                return null;
            }

            var lat = place.Location.Latitude;
            var lng = place.Location.Longitude;

            // Validate coordinate boundary sanity
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
            {
                _logger.LogWarning("Invalid coordinates ({Lat}, {Lng}) returned for place {PlaceId}", lat, lng, trimmedId);
                return null;
            }

            var name = place.DisplayName?.Text ?? place.FormattedAddress ?? trimmedId;
            var formatted = place.FormattedAddress ?? name;

            var locality = string.Empty;
            var district = string.Empty;
            var state = string.Empty;
            var country = string.Empty;

            if (place.AddressComponents != null)
            {
                foreach (var comp in place.AddressComponents)
                {
                    if (comp.Types == null) continue;

                    if (comp.Types.Contains("locality") || comp.Types.Contains("sublocality"))
                    {
                        if (string.IsNullOrEmpty(locality)) locality = comp.LongText ?? comp.ShortText ?? string.Empty;
                    }
                    if (comp.Types.Contains("administrative_area_level_3") || comp.Types.Contains("administrative_area_level_2"))
                    {
                        if (string.IsNullOrEmpty(district)) district = comp.LongText ?? comp.ShortText ?? string.Empty;
                    }
                    if (comp.Types.Contains("administrative_area_level_1"))
                    {
                        if (string.IsNullOrEmpty(state)) state = comp.LongText ?? comp.ShortText ?? string.Empty;
                    }
                    if (comp.Types.Contains("country"))
                    {
                        if (string.IsNullOrEmpty(country)) country = comp.LongText ?? comp.ShortText ?? string.Empty;
                    }
                }
            }

            if (string.IsNullOrEmpty(locality)) locality = name;
            if (string.IsNullOrEmpty(district)) district = "Coimbatore";
            if (string.IsNullOrEmpty(state)) state = "Tamil Nadu";
            if (string.IsNullOrEmpty(country)) country = "India";

            var dto = new LocalityDetailsDto(
                trimmedId,
                name,
                formatted,
                lat,
                lng,
                locality,
                district,
                state,
                country
            );

            // Cache for 24 hours
            _cache.Set(cacheKey, dto, TimeSpan.FromHours(24));
            return dto;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error calling Google Places Details API for place {PlaceId}", trimmedId);
            return null;
        }
    }

    public async Task<LocalityDetailsDto?> GeocodeAddressAsync(string address, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return null;
        }

        var trimmed = address.Trim();
        var cacheKey = $"geocode_address_{trimmed.ToLowerInvariant()}_{_options.DefaultRegion}";

        if (_cache.TryGetValue(cacheKey, out LocalityDetailsDto? cached) && cached != null)
        {
            return cached;
        }

        // 1. Check if user entered raw numeric coordinates: e.g. "11.0012, 77.0874"
        var coordMatch = System.Text.RegularExpressions.Regex.Match(trimmed, @"^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$");
        if (coordMatch.Success &&
            double.TryParse(coordMatch.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var rawLat) &&
            double.TryParse(coordMatch.Groups[2].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var rawLng))
        {
            if (rawLat >= 6.0 && rawLat <= 38.0 && rawLng >= 68.0 && rawLng <= 98.0)
            {
                var coordDto = new LocalityDetailsDto(
                    $"coord_{rawLat:F4}_{rawLng:F4}",
                    "Custom Pin Location",
                    trimmed,
                    rawLat,
                    rawLng,
                    "Custom Pin Location",
                    "Tamil Nadu",
                    "Tamil Nadu",
                    "India"
                );
                return coordDto;
            }
        }

        // 2. Try Google Places Text Search (New)
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            try
            {
                var requestUri = $"{_options.BaseUrl.TrimEnd('/')}/places:searchText";
                var requestBody = new
                {
                    textQuery = trimmed,
                    regionCode = _options.DefaultRegion
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);
                request.Headers.Add("X-Goog-Api-Key", _options.ApiKey);
                request.Headers.Add("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents");
                request.Content = JsonContent.Create(requestBody, options: JsonOpts);

                using var response = await _httpClient.SendAsync(request, ct);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync(ct);
                    var textSearchResult = JsonSerializer.Deserialize<GoogleTextSearchResponse>(content, JsonOpts);

                    if (textSearchResult?.Places != null && textSearchResult.Places.Count > 0)
                    {
                        var place = textSearchResult.Places[0];
                        if (place.Location != null)
                        {
                            var lat = place.Location.Latitude;
                            var lng = place.Location.Longitude;
                            var name = place.DisplayName?.Text ?? place.FormattedAddress ?? trimmed;
                            var formatted = place.FormattedAddress ?? name;

                            var locality = string.Empty;
                            var district = string.Empty;
                            var state = string.Empty;
                            var country = string.Empty;

                            if (place.AddressComponents != null)
                            {
                                foreach (var comp in place.AddressComponents)
                                {
                                    if (comp.Types == null) continue;
                                    if (comp.Types.Contains("locality") || comp.Types.Contains("sublocality"))
                                    {
                                        if (string.IsNullOrEmpty(locality)) locality = comp.LongText ?? comp.ShortText ?? string.Empty;
                                    }
                                    if (comp.Types.Contains("administrative_area_level_3") || comp.Types.Contains("administrative_area_level_2"))
                                    {
                                        if (string.IsNullOrEmpty(district)) district = comp.LongText ?? comp.ShortText ?? string.Empty;
                                    }
                                    if (comp.Types.Contains("administrative_area_level_1"))
                                    {
                                        if (string.IsNullOrEmpty(state)) state = comp.LongText ?? comp.ShortText ?? string.Empty;
                                    }
                                    if (comp.Types.Contains("country"))
                                    {
                                        if (string.IsNullOrEmpty(country)) country = comp.LongText ?? comp.ShortText ?? string.Empty;
                                    }
                                }
                            }

                            if (string.IsNullOrEmpty(locality)) locality = name;
                            if (string.IsNullOrEmpty(district)) district = "Coimbatore";
                            if (string.IsNullOrEmpty(state)) state = "Tamil Nadu";
                            if (string.IsNullOrEmpty(country)) country = "India";

                            var dto = new LocalityDetailsDto(
                                place.Id ?? $"place_{Guid.NewGuid():N}",
                                name,
                                formatted,
                                lat,
                                lng,
                                locality,
                                district,
                                state,
                                country
                            );

                            _cache.Set(cacheKey, dto, TimeSpan.FromHours(24));
                            return dto;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Google Places Text Search failed for address {Address}", trimmed);
            }
        }

        // 3. Fallback: Search Autocomplete to see if any place matches
        try
        {
            var suggestions = await SearchLocalitiesAsync(trimmed, ct);
            if (suggestions.Count > 0 && !string.IsNullOrWhiteSpace(suggestions[0].PlaceId))
            {
                var details = await GetPlaceDetailsAsync(suggestions[0].PlaceId, ct);
                if (details != null)
                {
                    _cache.Set(cacheKey, details, TimeSpan.FromHours(24));
                    return details;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Fallback autocomplete geocoding failed for {Address}", trimmed);
        }

        return null;
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
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    private sealed class GoogleAddressComponent
    {
        public string? LongText { get; set; }
        public string? ShortText { get; set; }
        public List<string>? Types { get; set; }
    }
    #endregion
}
