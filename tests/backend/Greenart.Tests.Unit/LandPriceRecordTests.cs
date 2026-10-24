using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class LandPriceRecordTests
{
    [Fact]
    public void RecordCreation_ShouldAutomaticallyCompute_NormalizedRatePerCentAndSqFt()
    {
        // 4 Cents for 4,400,000 INR
        // Rate per Cent = 1,100,000 INR
        // Rate per SqFt = 4,400,000 / (4 * 435.6) = 2,525.25 INR
        var record = new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Trichy Road",
            surveyNumber: "SF 144/1",
            coordinates: new GeoCoordinate(11.0021, 77.0869),
            landUsage: LandUsageType.Residential,
            area: new LandArea(4.0m, AreaUnit.Cent),
            originalPrice: 4400000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "Doc 1089/2024",
            observationDate: new DateTime(2024, 2, 20)
        );

        Assert.Equal(1100000.00m, record.NormalizedRatePerCent);
        Assert.Equal(2525.25m, record.NormalizedRatePerSqFt);
    }

    [Fact]
    public void Record_EligibilityCheck_ShouldExcludeRejectedOrOldRecords()
    {
        var asOf = new DateTime(2026, 10, 1);

        // Recent record (6 months old)
        var recentRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.VerifiedTransaction,
            null, new DateTime(2026, 4, 1)
        );
        Assert.True(recentRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));

        // Old record (48 months old)
        var oldRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.VerifiedTransaction,
            null, new DateTime(2022, 1, 1)
        );
        Assert.False(oldRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));

        // Rejected record
        recentRecord.MarkRejected("Disputed title");
        Assert.False(recentRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));

        // Pending review record is eligible unless rejected or archived
        var pendingRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.VerifiedTransaction,
            null, new DateTime(2026, 4, 1)
        );
        pendingRecord.MarkPendingReview("Awaiting document verification");
        Assert.Equal(VerificationStatus.PendingReview, pendingRecord.VerificationStatus);
        Assert.Contains("PendingReview: Awaiting document verification", pendingRecord.Notes);
        Assert.True(pendingRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));
    }
}

