namespace Greenart.Tests.Integration;

public class RecordWriteAndModerationTests
{
    private ILandPriceRepository CreateRepository()
    {
        return new CoimbatorePilotRepository();
    }

    [Fact]
    public async Task AddAsync_ShouldPersistNewRecord_AndCalculateNormalizedRates()
    {
        var repo = CreateRepository();
        var recordId = Guid.NewGuid();

        // 2 Cents at 24 Lakhs = 12 Lakhs/Cent = ~2754.82/sq.ft
        var record = new LandPriceRecord(
            id: recordId,
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "New Layout Road",
            surveyNumber: "SF 999",
            coordinates: new GeoCoordinate(11.0025, 77.0870),
            landUsage: LandUsageType.Residential,
            area: new LandArea(2.0m, AreaUnit.Cent),
            originalPrice: 2400000m,
            sourceCategory: SourceCategory.AdvertisedAskingPrice,
            sourceReference: "Classifieds #KNP-100",
            observationDate: DateTime.UtcNow,
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Test record addition"
        );

        await repo.AddAsync(record);

        var retrieved = await repo.GetByIdAsync(recordId);
        Assert.NotNull(retrieved);
        Assert.Equal(1200000m, retrieved.NormalizedRatePerCent);
        Assert.Equal(2754.82m, retrieved.NormalizedRatePerSqFt);
        Assert.Equal(VerificationStatus.Unverified, retrieved.VerificationStatus);
    }

    [Fact]
    public async Task UpdateAsync_ShouldUpdateVerificationStatus_ToVerifiedWithAuditNote()
    {
        var repo = CreateRepository();
        var recordId = Guid.Parse("11111111-1111-1111-1111-111111111103"); // Unverified asking price

        var record = await repo.GetByIdAsync(recordId);
        Assert.NotNull(record);
        Assert.Equal(VerificationStatus.Unverified, record.VerificationStatus);

        record.MarkVerified("Audited against registered sale deed Doc 999/2024");
        await repo.UpdateAsync(record);

        var updated = await repo.GetByIdAsync(recordId);
        Assert.NotNull(updated);
        Assert.Equal(VerificationStatus.Verified, updated.VerificationStatus);
        Assert.Contains("Verified: Audited against registered sale deed", updated.Notes);
    }

    [Fact]
    public async Task UpdateAsync_ShouldUpdateVerificationStatus_ToRejectedWithReason()
    {
        var repo = CreateRepository();
        var recordId = Guid.Parse("11111111-1111-1111-1111-111111111104"); // Unverified client research

        var record = await repo.GetByIdAsync(recordId);
        Assert.NotNull(record);

        record.MarkRejected("Disputed boundary survey number");
        await repo.UpdateAsync(record);

        var updated = await repo.GetByIdAsync(recordId);
        Assert.NotNull(updated);
        Assert.Equal(VerificationStatus.Rejected, updated.VerificationStatus);
        Assert.Contains("Rejected: Disputed boundary", updated.Notes);
    }
}

