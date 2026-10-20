using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class SpatialDistanceTests
{
    [Fact]
    public void Coordinate_OutOfRangeLatitude_ShouldThrow()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new GeoCoordinate(91.0, 77.0));
        Assert.Throws<ArgumentOutOfRangeException>(() => new GeoCoordinate(-90.1, 77.0));
    }

    [Fact]
    public void Coordinate_OutOfRangeLongitude_ShouldThrow()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new GeoCoordinate(11.0, 180.1));
        Assert.Throws<ArgumentOutOfRangeException>(() => new GeoCoordinate(11.0, -180.1));
    }

    [Fact]
    public void DistanceBetweenIdenticalPoints_ShouldBeZero()
    {
        var coord1 = new GeoCoordinate(11.0012, 77.0874);
        var coord2 = new GeoCoordinate(11.0012, 77.0874);

        var distance = coord1.DistanceToMeters(coord2);
        Assert.Equal(0.0, distance, precision: 1);
    }

    [Fact]
    public void Distance_KannampalayamPoints_ShouldCalculateMetersAccurately()
    {
        // Two points approximately 50 meters apart
        var pointA = new GeoCoordinate(11.0015, 77.0878);
        var pointB = new GeoCoordinate(11.0019, 77.0878);

        var distance = pointA.DistanceToMeters(pointB);
        Assert.InRange(distance, 40.0, 50.0);
    }

    [Fact]
    public void IsWithinRadius_ShouldCorrectlyClassifyPointsWithin1000Meters()
    {
        var center = new GeoCoordinate(11.0012, 77.0874);
        var nearby = new GeoCoordinate(11.0030, 77.0855); // ~290 meters away
        var distant = new GeoCoordinate(11.1500, 77.2000); // ~20,000 meters away

        Assert.True(nearby.IsWithinRadius(center, 1000.0));
        Assert.False(distant.IsWithinRadius(center, 1000.0));
    }
}
