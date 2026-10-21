namespace Greenart.Domain.ValueObjects;

public readonly struct GeoCoordinate : IEquatable<GeoCoordinate>
{
    private const double EarthRadiusMeters = 6371000.0;

    public double Latitude { get; }
    public double Longitude { get; }

    public GeoCoordinate(double latitude, double longitude)
    {
        if (latitude < -90.0 || latitude > 90.0)
        {
            throw new ArgumentOutOfRangeException(nameof(latitude), latitude, "Latitude must be between -90.0 and 90.0 degrees.");
        }

        if (longitude < -180.0 || longitude > 180.0)
        {
            throw new ArgumentOutOfRangeException(nameof(longitude), longitude, "Longitude must be between -180.0 and 180.0 degrees.");
        }

        Latitude = Math.Round(latitude, 6);
        Longitude = Math.Round(longitude, 6);
    }

    /// <summary>
    /// Calculates the great-circle distance to another coordinate in meters using the Haversine formula.
    /// </summary>
    public double DistanceToMeters(GeoCoordinate other)
    {
        var dLat = ToRadians(other.Latitude - Latitude);
        var dLon = ToRadians(other.Longitude - Longitude);

        var a = Math.Sin(dLat / 2.0) * Math.Sin(dLat / 2.0) +
                Math.Cos(ToRadians(Latitude)) * Math.Cos(ToRadians(other.Latitude)) *
                Math.Sin(dLon / 2.0) * Math.Sin(dLon / 2.0);

        var c = 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));
        return EarthRadiusMeters * c;
    }

    /// <summary>
    /// Checks whether this coordinate is within the specified radius in meters from the center.
    /// </summary>
    public bool IsWithinRadius(GeoCoordinate center, double radiusMeters)
    {
        if (radiusMeters < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(radiusMeters), "Radius cannot be negative.");
        }

        return DistanceToMeters(center) <= radiusMeters;
    }

    private static double ToRadians(double degrees) => degrees * (Math.PI / 180.0);

    public bool Equals(GeoCoordinate other) =>
        Math.Abs(Latitude - other.Latitude) < 1e-6 && Math.Abs(Longitude - other.Longitude) < 1e-6;

    public override bool Equals(object? obj) => obj is GeoCoordinate other && Equals(other);

    public override int GetHashCode() => HashCode.Combine(Latitude, Longitude);

    public override string ToString() => $"({Latitude:F6}, {Longitude:F6})";

    public static bool operator ==(GeoCoordinate left, GeoCoordinate right) => left.Equals(right);
    public static bool operator !=(GeoCoordinate left, GeoCoordinate right) => !left.Equals(right);
}

