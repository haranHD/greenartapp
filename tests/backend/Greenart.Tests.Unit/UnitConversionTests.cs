using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class UnitConversionTests
{
    [Fact]
    public void OneCent_ShouldEqual_435Point6SquareFeet()
    {
        var area = new LandArea(1.0m, AreaUnit.Cent);
        Assert.Equal(435.6m, area.ToSqFt());
    }

    [Fact]
    public void OneAcre_ShouldEqual_100Cents_And_43560SquareFeet()
    {
        var area = new LandArea(1.0m, AreaUnit.Acre);
        Assert.Equal(100.0m, area.ToCents());
        Assert.Equal(43560.0m, area.ToSqFt());
    }

    [Fact]
    public void OneGround_ShouldEqual_2400SquareFeet()
    {
        var area = new LandArea(1.0m, AreaUnit.Ground);
        Assert.Equal(2400.0m, area.ToSqFt());
        Assert.Equal(Math.Round(2400.0m / 435.6m, 4), Math.Round(area.ToCents(), 4));
    }

    [Fact]
    public void ConvertTo_TargetUnit_ShouldPreserveEquivalence()
    {
        var original = new LandArea(5.0m, AreaUnit.Cent);
        var inSqFt = original.ConvertTo(AreaUnit.SqFt);

        Assert.Equal(5.0m * 435.6m, inSqFt.Value);
        Assert.Equal(AreaUnit.SqFt, inSqFt.Unit);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1.5)]
    public void NonPositiveArea_ShouldThrowArgumentOutOfRangeException(decimal invalidValue)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new LandArea(invalidValue, AreaUnit.Cent));
    }
}

