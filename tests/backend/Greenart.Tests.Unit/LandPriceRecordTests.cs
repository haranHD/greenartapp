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
    public void Record_EligibilityCheck_ShouldEnforceStrictEligibilityRules()
    {
        var asOf = new DateTime(2026, 10, 1);

        // 1. Verified completed sale (6 months old) -> Eligible
        var verifiedRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.VerifiedTransaction,
            null, new DateTime(2026, 4, 1), VerificationStatus.Verified, isSynthetic: false
        );
        Assert.True(verifiedRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));

        // 2. Old transaction (> 36 months) -> Ineligible
        var oldRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.VerifiedTransaction,
            null, new DateTime(2022, 1, 1), VerificationStatus.Verified, isSynthetic: false
        );
        Assert.False(oldRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));
        Assert.False(oldRecord.TryGetIneligibilityReason(asOf, 36, out var oldReason));
        Assert.Contains("exceeds the approved freshness window", oldReason);

        // 3. Rejected record -> Ineligible
        verifiedRecord.MarkRejected("Disputed title");
        Assert.False(verifiedRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));
        Assert.False(verifiedRecord.TryGetIneligibilityReason(asOf, 36, out var rejectedReason));
        Assert.Contains("not verified", rejectedReason);

        // 4. Pending review record -> Strictly Ineligible for market calculation
        var pendingRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.VerifiedTransaction,
            null, new DateTime(2026, 4, 1), VerificationStatus.Verified, isSynthetic: false
        );
        pendingRecord.MarkPendingReview("Awaiting document verification");
        Assert.Equal(VerificationStatus.PendingReview, pendingRecord.VerificationStatus);
        Assert.Contains("PendingReview: Awaiting document verification", pendingRecord.Notes);
        Assert.False(pendingRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));

        // 5. Advertised asking price -> Ineligible for primary market pool
        var askingRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.AdvertisedAskingPrice,
            null, new DateTime(2026, 4, 1), VerificationStatus.Verified, isSynthetic: false
        );
        Assert.False(askingRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));

        // 6. Synthetic record -> Ineligible even if marked Verified
        var syntheticRecord = new LandPriceRecord(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", "Sulur", "Kannampalayam",
            null, null, new GeoCoordinate(11.0, 77.0), LandUsageType.Residential,
            new LandArea(3.0m, AreaUnit.Cent), 3000000m, SourceCategory.VerifiedTransaction,
            null, new DateTime(2026, 4, 1), VerificationStatus.Verified, isSynthetic: true
        );
        Assert.False(syntheticRecord.IsEligibleForMarketEstimation(asOf, maxAgeMonths: 36));
        Assert.False(syntheticRecord.TryGetIneligibilityReason(asOf, 36, out var synthReason));
        Assert.Contains("Synthetic fixture records are strictly excluded", synthReason);
    }
}
