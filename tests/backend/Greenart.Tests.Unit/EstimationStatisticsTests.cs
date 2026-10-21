using Greenart.Application.Estimation;
using Xunit;

namespace Greenart.Tests.Unit;

public class EstimationStatisticsTests
{
    [Fact]
    public void Median_OddCountDataset_ShouldReturnExactMiddleElement()
    {
        // 5 elements: 10, 20, 30, 40, 50 -> Median is 30
        var sorted = new List<decimal> { 10m, 20m, 30m, 40m, 50m };
        var median = EstimationEngine.GetPercentile(sorted, 0.50);

        Assert.Equal(30m, median);
    }

    [Fact]
    public void Median_EvenCountDataset_ShouldInterpolateBetweenMiddleElements()
    {
        // 4 elements: 10, 20, 30, 40 -> Median is 25
        var sorted = new List<decimal> { 10m, 20m, 30m, 40m };
        var median = EstimationEngine.GetPercentile(sorted, 0.50);

        Assert.Equal(25m, median);
    }

    [Fact]
    public void BuildPriceRange_ShouldCalculateAccurateQ1_Median_Q3_Min_Max()
    {
        var sorted = new List<decimal> { 100m, 200m, 300m, 400m, 500m };
        var range = EstimationEngine.BuildPriceRange(sorted, "₹ / Cent");

        Assert.Equal(100m, range.MinRate);
        Assert.Equal(200m, range.Percentile25);
        Assert.Equal(300m, range.MedianRate);
        Assert.Equal(400m, range.Percentile75);
        Assert.Equal(500m, range.MaxRate);
        Assert.Equal("₹ / Cent", range.Unit);
    }

    [Theory]
    [InlineData(2, 0, "Insufficient")]
    [InlineData(3, 0, "Low")]
    [InlineData(4, 1, "Low")]
    [InlineData(5, 0, "Moderate")]
    [InlineData(4, 2, "Moderate")]
    [InlineData(10, 3, "High")]
    public void CalculateConfidence_ShouldAdhereToStrictClassificationMatrix(int total, int verified, string expected)
    {
        var result = EstimationEngine.CalculateConfidence(total, verified);
        Assert.Equal(expected, result);
    }
}

