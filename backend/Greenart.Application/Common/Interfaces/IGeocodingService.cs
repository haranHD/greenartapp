using Greenart.Application.DTOs;

namespace Greenart.Application.Common.Interfaces;

/// <summary>
/// Service abstraction for geocoding and locality search proxy.
/// </summary>
public interface IGeocodingService
{
    /// <summary>
    /// Searches for locality and address suggestions based on an input query.
    /// </summary>
    Task<IReadOnlyList<LocalitySuggestionDto>> SearchLocalitiesAsync(string query, CancellationToken ct = default);

    /// <summary>
    /// Retrieves resolved coordinates and address components for a specific place identifier.
    /// </summary>
    Task<LocalityDetailsDto?> GetPlaceDetailsAsync(string placeId, CancellationToken ct = default);

    /// <summary>
    /// Directly geocodes an address or location name into geographic coordinates.
    /// </summary>
    Task<LocalityDetailsDto?> GeocodeAddressAsync(string address, CancellationToken ct = default);

    /// <summary>
    /// Reverse-geocodes coordinates into a detailed locality string with neighborhood, district, and landmarks.
    /// </summary>
    Task<ReverseGeocodeResultDto?> ReverseGeocodeCoordinatesAsync(double latitude, double longitude, CancellationToken ct = default);
}

