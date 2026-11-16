using System.Net;
using System.Globalization;
using Greenart.Application.Common.Exceptions;
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
