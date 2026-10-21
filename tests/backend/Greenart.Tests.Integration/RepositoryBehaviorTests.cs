namespace Greenart.Tests.Integration;

public class RepositoryBehaviorTests
{
    private ILandPriceRepository CreateRepository()
    {
        return new CoimbatorePilotRepository();
    }

    [Fact]
    public async Task GetAllAsync_WithoutFilter_ShouldReturnAllThirteenRecords()
    {
        var repo = CreateRepository();
        var records = await repo.GetAllAsync();

        Assert.Equal(13, records.Count);
    }

    [Fact]
    public async Task GetAllAsync_WithLocalityFilter_ShouldFilterCaseInsensitively()
    {
        var repo = CreateRepository();

        var kannampalayam = await repo.GetAllAsync(locality: "kannampalayam");
        Assert.Equal(5, kannampalayam.Count);

        var sulur = await repo.GetAllAsync(locality: "SULUR");
        Assert.Equal(4, sulur.Count);

        var unknown = await repo.GetAllAsync(locality: "NonExistentPlace");
        Assert.Empty(unknown);
    }

    [Fact]
    public async Task GetAllAsync_WithSourceCategoryFilter_ShouldReturnOnlyMatchingCategory()
    {
        var repo = CreateRepository();

        var verifiedOnly = await repo.GetAllAsync(sourceCategory: SourceCategory.VerifiedTransaction);
        Assert.Equal(6, verifiedOnly.Count);
        Assert.All(verifiedOnly, r => Assert.Equal(SourceCategory.VerifiedTransaction, r.SourceCategory));

        var guidelinesOnly = await repo.GetAllAsync(sourceCategory: SourceCategory.GovernmentGuideline);
        Assert.Equal(3, guidelinesOnly.Count);
        Assert.All(guidelinesOnly, r => Assert.Equal(SourceCategory.GovernmentGuideline, r.SourceCategory));
    }

    [Fact]
    public async Task GetByIdAsync_WithValidId_ShouldReturnRecord()
    {
        var repo = CreateRepository();
        var knownId = Guid.Parse("11111111-1111-1111-1111-111111111101");

        var record = await repo.GetByIdAsync(knownId);

        Assert.NotNull(record);
        Assert.Equal("Kannampalayam", record.Locality);
        Assert.Equal("SF 142/2A", record.SurveyNumber);
    }

    [Fact]
    public async Task GetByIdAsync_WithUnknownId_ShouldReturnNull()
    {
        var repo = CreateRepository();
        var unknownId = Guid.NewGuid();

        var record = await repo.GetByIdAsync(unknownId);

        Assert.Null(record);
    }

    [Fact]
    public async Task GetNearbyComparableAsync_Within1000m_ShouldFindLocalCluster()
    {
        var repo = CreateRepository();

        // Target: Kannampalayam center (11.0012, 77.0874)
        var nearby = await repo.GetNearbyComparableAsync(
            latitude: 11.0012,
            longitude: 77.0874,
            radiusMeters: 1000,
            landUsage: LandUsageType.Residential);

        // Kannampalayam cluster has 5 records (all within 500m of center)
        Assert.Equal(5, nearby.Count);
        Assert.All(nearby, r => Assert.Equal("Kannampalayam", r.Locality));
    }

    [Fact]
    public async Task GetNearbyComparableAsync_FarLocation_ShouldReturnEmptyList()
    {
        var repo = CreateRepository();

        // Location far away (Pollachi coordinates) with 1000m radius
        var nearby = await repo.GetNearbyComparableAsync(
            latitude: 10.6609,
            longitude: 77.0089,
            radiusMeters: 1000,
            landUsage: LandUsageType.Residential);

        Assert.Empty(nearby);
    }
}

