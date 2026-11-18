namespace Greenart.Application.DTOs;

/// <summary>
/// Domain model for an autocomplete locality suggestion.
/// </summary>
public record LocalitySuggestionDto(
    string PlaceId,
    string MainText,
    string SecondaryText,
    string FullText,
    IReadOnlyList<string> Types
);

/// <summary>
/// Domain model for resolved geographic coordinates and administrative boundaries of a place.
/// </summary>
public record LocalityDetailsDto(
    string PlaceId,
    string Name,
    string FormattedAddress,
    double Latitude,
    double Longitude,
    string Locality,
    string District,
    string State,
    string Country
);

/// <summary>
/// Domain model for reverse-geocoded location with neighborhood, landmarks, and formatted query.
/// </summary>
public record ReverseGeocodeResultDto(
    string FormattedAddress,
    string Locality,
    string Neighborhood,
    string Taluk,
    string District,
    string State,
    List<string> NearbyLandmarks,
    string SpecificLocationQuery
);

