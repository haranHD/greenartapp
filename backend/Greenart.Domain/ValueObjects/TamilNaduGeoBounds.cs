namespace Greenart.Domain.ValueObjects;

public static class TamilNaduGeoBounds
{
    // Bounding Box for the State of Tamil Nadu, India
    // Southernmost: Kanyakumari (~8.07° N)
    // Northernmost: Tiruvallur border (~13.55° N)
    // Westernmost: Nilgiris border (~76.23° E)
    // Easternmost: Chennai / Point Calimere (~80.35° E)
    public const double MinLatitude = 8.0;
    public const double MaxLatitude = 13.6;
    public const double MinLongitude = 76.2;
    public const double MaxLongitude = 80.4;

    // All-India territory bounding box
    public const double IndiaMinLatitude = 6.0;
    public const double IndiaMaxLatitude = 38.0;
    public const double IndiaMinLongitude = 68.0;
    public const double IndiaMaxLongitude = 98.0;

    // Primary pilot corridor (Coimbatore - Sulur - Kannampalayam)
    public const double PilotMinLatitude = 10.5;
    public const double PilotMaxLatitude = 11.5;
    public const double PilotMinLongitude = 76.8;
    public const double PilotMaxLongitude = 77.4;

    public static readonly IReadOnlyList<string> TamilNaduDistricts = new List<string>
    {
        "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
        "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
        "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
        "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
        "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
        "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
        "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
        "Vellore", "Viluppuram", "Virudhunagar"
    };

    public static IReadOnlyList<string> Districts => TamilNaduDistricts;

    private static readonly Dictionary<string, string> DistrictAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Trichy"] = "Tiruchirappalli",
        ["Tiruchirapalli"] = "Tiruchirappalli",
        ["Tirupur"] = "Tiruppur",
        ["Kanyakumari"] = "Kanniyakumari",
        ["Tuticorin"] = "Thoothukudi",
        ["Tanjore"] = "Thanjavur"
    };

    public static bool IsWithinTamilNadu(double latitude, double longitude)
    {
        return latitude >= MinLatitude && latitude <= MaxLatitude &&
               longitude >= MinLongitude && longitude <= MaxLongitude;
    }

    public static bool IsWithinIndia(double latitude, double longitude)
    {
        return latitude >= IndiaMinLatitude && latitude <= IndiaMaxLatitude &&
               longitude >= IndiaMinLongitude && longitude <= IndiaMaxLongitude;
    }

    public static bool IsWithinPilot(double latitude, double longitude)
    {
        return latitude >= PilotMinLatitude && latitude <= PilotMaxLatitude &&
               longitude >= PilotMinLongitude && longitude <= PilotMaxLongitude;
    }

    public static bool AreCoordinatesTransposed(double latitude, double longitude)
    {
        return latitude >= IndiaMinLongitude && latitude <= IndiaMaxLongitude &&
               longitude >= IndiaMinLatitude && longitude <= IndiaMaxLatitude;
    }

    public static bool IsValidTamilNaduDistrict(string? district)
    {
        if (string.IsNullOrWhiteSpace(district)) return false;
        var trimmed = district.Trim();
        if (DistrictAliases.ContainsKey(trimmed)) return true;
        return TamilNaduDistricts.Any(d => string.Equals(d, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public static string NormalizeDistrict(string? district, string fallback = "Coimbatore")
    {
        if (string.IsNullOrWhiteSpace(district)) return fallback;
        var trimmed = district.Trim();
        if (DistrictAliases.TryGetValue(trimmed, out var canonical))
        {
            return canonical;
        }
        var matched = TamilNaduDistricts.FirstOrDefault(d => string.Equals(d, trimmed, StringComparison.OrdinalIgnoreCase));
        return matched ?? trimmed;
    }
}
