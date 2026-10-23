using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class TamilNaduGeoBoundsTests
{
    [Theory]
    [InlineData(11.0168, 76.9558)] // Coimbatore
    [InlineData(13.0827, 80.2707)] // Chennai
    [InlineData(9.9252, 78.1198)]  // Madurai
    [InlineData(8.0883, 77.5385)]  // Kanniyakumari
    [InlineData(12.7409, 77.8253)] // Hosur / Krishnagiri
    [InlineData(10.7905, 78.7047)] // Tiruchirappalli
    [InlineData(11.6643, 78.1460)] // Salem
    [InlineData(8.7139, 77.7567)]  // Tirunelveli
    public void IsWithinTamilNadu_WhenCoordinatesInsideTN_ReturnsTrue(double lat, double lon)
    {
        Assert.True(TamilNaduGeoBounds.IsWithinTamilNadu(lat, lon));
        Assert.True(TamilNaduGeoBounds.IsWithinIndia(lat, lon));
    }

    [Theory]
    [InlineData(19.0760, 72.8777)] // Mumbai (Maharashtra)
    [InlineData(28.6139, 77.2090)] // New Delhi
    [InlineData(17.3850, 78.4867)] // Hyderabad (Telangana)
    [InlineData(22.5726, 88.3639)] // Kolkata (West Bengal)
    [InlineData(12.9141, 74.8560)] // Mangalore (Karnataka)
    public void IsWithinTamilNadu_WhenCoordinatesOutsideTNButInIndia_ReturnsFalseAndInIndiaTrue(double lat, double lon)
    {
        Assert.False(TamilNaduGeoBounds.IsWithinTamilNadu(lat, lon));
        Assert.True(TamilNaduGeoBounds.IsWithinIndia(lat, lon));
    }

    [Theory]
    [InlineData(51.5074, -0.1278)] // London, UK
    [InlineData(40.7128, -74.0060)] // New York, USA
    [InlineData(1.3521, 103.8198)]  // Singapore
    [InlineData(-33.8688, 151.2093)] // Sydney, Australia
    [InlineData(0.0, 0.0)]          // Null Island
    public void IsWithinIndia_WhenCoordinatesOutsideIndia_ReturnsFalse(double lat, double lon)
    {
        Assert.False(TamilNaduGeoBounds.IsWithinIndia(lat, lon));
        Assert.False(TamilNaduGeoBounds.IsWithinTamilNadu(lat, lon));
    }

    [Theory]
    [InlineData(77.0874, 11.0012)] // Swapped Coimbatore
    [InlineData(80.2707, 13.0827)] // Swapped Chennai
    [InlineData(78.1198, 9.9252)]  // Swapped Madurai
    public void AreCoordinatesTransposed_WhenLatAndLonSwapped_ReturnsTrue(double lat, double lon)
    {
        Assert.True(TamilNaduGeoBounds.AreCoordinatesTransposed(lat, lon));
    }

    [Theory]
    [InlineData(11.0012, 77.0874)] // Normal Coimbatore
    [InlineData(13.0827, 80.2707)] // Normal Chennai
    public void AreCoordinatesTransposed_WhenCorrectOrder_ReturnsFalse(double lat, double lon)
    {
        Assert.False(TamilNaduGeoBounds.AreCoordinatesTransposed(lat, lon));
    }

    [Fact]
    public void Districts_ContainsAll38TamilNaduDistricts()
    {
        Assert.Equal(38, TamilNaduGeoBounds.Districts.Count);
        Assert.Contains("Coimbatore", TamilNaduGeoBounds.Districts);
        Assert.Contains("Chennai", TamilNaduGeoBounds.Districts);
        Assert.Contains("Madurai", TamilNaduGeoBounds.Districts);
        Assert.Contains("Tiruppur", TamilNaduGeoBounds.Districts);
        Assert.Contains("Salem", TamilNaduGeoBounds.Districts);
        Assert.Contains("Tiruchirappalli", TamilNaduGeoBounds.Districts);
        Assert.Contains("Kanniyakumari", TamilNaduGeoBounds.Districts);
    }

    [Theory]
    [InlineData("coimbatore", "Coimbatore")]
    [InlineData("COIMBATORE", "Coimbatore")]
    [InlineData("  chennai  ", "Chennai")]
    [InlineData("Tiruchirapalli", "Tiruchirappalli")]
    [InlineData("Trichy", "Tiruchirappalli")]
    [InlineData("kanyakumari", "Kanniyakumari")]
    [InlineData("tirupur", "Tiruppur")]
    public void NormalizeDistrict_WithAliasesAndCasing_NormalizesProperly(string input, string expected)
    {
        var normalized = TamilNaduGeoBounds.NormalizeDistrict(input);
        Assert.Equal(expected, normalized);
    }

    [Fact]
    public void NormalizeDistrict_WithUnknownDistrict_ReturnsTrimmedInputOrFallback()
    {
        var custom = TamilNaduGeoBounds.NormalizeDistrict("Bangalore Rural", "Coimbatore");
        Assert.Equal("Bangalore Rural", custom);

        var empty = TamilNaduGeoBounds.NormalizeDistrict("   ", "Coimbatore");
        Assert.Equal("Coimbatore", empty);
    }
}
