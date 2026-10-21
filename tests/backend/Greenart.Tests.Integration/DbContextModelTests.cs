using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Greenart.Tests.Integration;

public class DbContextModelTests
{
    private LandPriceDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<LandPriceDbContext>()
            .UseNpgsql("Host=localhost;Database=greenart_dummy;Username=dummy;Password=dummy", o => o.UseNetTopologySuite())
            .Options;

        return new LandPriceDbContext(options);
    }

    [Fact]
    public void ModelBuilder_ShouldConfigure_LandPriceRecordsTableAndPostGisExtension()
    {
        using var context = CreateInMemoryDbContext();
        var model = context.Model;

        var entityType = model.FindEntityType(typeof(LandPriceRecord));
        Assert.NotNull(entityType);
        Assert.Equal("land_price_records", entityType.GetTableName());

        // Check primary key
        var pk = entityType.FindPrimaryKey();
        Assert.NotNull(pk);
        Assert.Equal("id", pk.Properties.Single().GetColumnName());
    }

    [Fact]
    public void ModelBuilder_ShouldConfigure_SpatialLocationWithGistIndex()
    {
        using var context = CreateInMemoryDbContext();
        var entityType = context.Model.FindEntityType(typeof(LandPriceRecord))!;

        // Spatial location property
        var locationProperty = entityType.FindProperty("Location");
        Assert.NotNull(locationProperty);
        Assert.Equal("location", locationProperty.GetColumnName());
        Assert.Equal("geography(Point, 4326)", locationProperty.GetColumnType());

        // Spatial GIST index
        var indexes = entityType.GetIndexes().ToList();
        var spatialIndex = indexes.FirstOrDefault(i => i.Properties.Any(p => p.Name == "Location"));
        Assert.NotNull(spatialIndex);
        Assert.Equal("idx_land_price_records_location", spatialIndex.GetDatabaseName());
    }

    [Fact]
    public void ModelBuilder_ShouldConfigure_ValueObjectsAndMetadataColumns()
    {
        using var context = CreateInMemoryDbContext();
        var entityType = context.Model.FindEntityType(typeof(LandPriceRecord))!;

        // Value objects mapped as complex types
        var complexProperties = entityType.GetComplexProperties().ToList();
        Assert.Contains(complexProperties, cp => cp.Name == "Coordinates");
        Assert.Contains(complexProperties, cp => cp.Name == "Area");

        // Required precision columns
        var originalPrice = entityType.FindProperty(nameof(LandPriceRecord.OriginalPrice))!;
        Assert.Equal(18, originalPrice.GetPrecision());
        Assert.Equal(2, originalPrice.GetScale());

        var ratePerCent = entityType.FindProperty(nameof(LandPriceRecord.NormalizedRatePerCent))!;
        Assert.Equal(18, ratePerCent.GetPrecision());
        Assert.Equal(2, ratePerCent.GetScale());

        // Indexes for high-frequency filters
        var indexes = entityType.GetIndexes().ToList();
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_land_price_records_locality");
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_land_price_records_land_usage");
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_land_price_records_source_category");
    }
}
