namespace Greenart.Tests.Integration;

public class DataSeederTests
{
    [Fact]
    public void GetPilotRecords_ShouldReturn_ThirteenCoimbatorePilotRecords()
    {
        var records = LandPriceDataSeeder.GetPilotRecords();

        Assert.Equal(13, records.Count);
    }

    [Fact]
    public void GetPilotRecords_ShouldHave_UniqueNonEmptyIds()
    {
        var records = LandPriceDataSeeder.GetPilotRecords();
        var uniqueIds = records.Select(r => r.Id).Distinct().ToList();

        Assert.Equal(13, uniqueIds.Count);
        Assert.All(records, r => Assert.NotEqual(Guid.Empty, r.Id));
    }

    [Fact]
    public void GetPilotRecords_ShouldPreserve_ProvenanceAndVerificationCategories()
    {
        var records = LandPriceDataSeeder.GetPilotRecords();

        var verifiedTx = records.Where(r => r.SourceCategory == SourceCategory.VerifiedTransaction).ToList();
        var askingPrices = records.Where(r => r.SourceCategory == SourceCategory.AdvertisedAskingPrice).ToList();
        var clientResearch = records.Where(r => r.SourceCategory == SourceCategory.ClientResearch).ToList();
        var guidelineValues = records.Where(r => r.SourceCategory == SourceCategory.GovernmentGuideline).ToList();

        Assert.Equal(6, verifiedTx.Count);
        Assert.Equal(3, askingPrices.Count);
        Assert.Single(clientResearch);
        Assert.Equal(3, guidelineValues.Count);

        // Verified transactions must have Verified status
        Assert.All(verifiedTx, r => Assert.Equal(VerificationStatus.Verified, r.VerificationStatus));

        // Asking prices and client research must be Unverified
        Assert.All(askingPrices, r => Assert.Equal(VerificationStatus.Unverified, r.VerificationStatus));
        Assert.All(clientResearch, r => Assert.Equal(VerificationStatus.Unverified, r.VerificationStatus));

        // No records are falsely represented as synthetic fixture unless labelled
        Assert.All(records, r => Assert.False(r.IsSynthetic));
    }

    [Fact]
    public void GetPilotRecords_ShouldSpan_ThreeCoreCoimbatoreLocalities()
    {
        var records = LandPriceDataSeeder.GetPilotRecords();
        var localities = records.Select(r => r.Locality).Distinct().OrderBy(l => l).ToList();

        Assert.Contains("Kannampalayam", localities);
        Assert.Contains("Sulur", localities);
        Assert.Contains("Saravanampatti", localities);

        // Kannampalayam has 5 records (2 verified, 1 asking, 1 research, 1 guideline)
        Assert.Equal(5, records.Count(r => r.Locality == "Kannampalayam"));

        // Sulur has 4 records (2 verified, 1 asking, 1 guideline)
        Assert.Equal(4, records.Count(r => r.Locality == "Sulur"));

        // Saravanampatti has 4 records (2 verified, 1 asking, 1 guideline)
        Assert.Equal(4, records.Count(r => r.Locality == "Saravanampatti"));
    }

    [Fact]
    public void GetPilotRecords_AllCoordinates_MustBeWithinCoimbatoreBounds()
    {
        var records = LandPriceDataSeeder.GetPilotRecords();

        foreach (var record in records)
        {
            // Coimbatore latitude bounds: ~10.5 to ~11.3
            Assert.InRange(record.Latitude, 10.5, 11.3);
            // Coimbatore longitude bounds: ~76.8 to ~77.3
            Assert.InRange(record.Longitude, 76.8, 77.3);
            // Strictly positive prices
            Assert.True(record.OriginalPrice > 0);
            Assert.True(record.NormalizedRatePerCent > 0);
            Assert.True(record.NormalizedRatePerSqFt > 0);
        }
    }

    [Fact]
    public void UserDataSeeder_HashPassword_ProducesCryptographicallySecureHashAndSalt()
    {
        var (hash, salt) = UserDataSeeder.HashPassword("Admin@123");

        Assert.False(string.IsNullOrWhiteSpace(hash));
        Assert.False(string.IsNullOrWhiteSpace(salt));
        Assert.Equal(64, hash.Length); // 32 bytes hex encoded = 64 chars
        Assert.Equal(32, salt.Length); // 16 bytes hex encoded = 32 chars
    }
}
