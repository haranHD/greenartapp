namespace Greenart.Domain.Enums;

/// <summary>
/// Strict data source category classification.
/// These categories must NEVER be interchanged, merged, or misrepresented.
/// </summary>
public enum SourceCategory
{
    GovernmentGuideline = 1,
    VerifiedTransaction = 2,
    AdvertisedAskingPrice = 3,
    ClientResearch = 4,
    SyntheticFixture = 5
}

public enum VerificationStatus
{
    Unverified = 0,
    PendingReview = 1,
    Verified = 2,
    Rejected = 3,
    Archived = 4
}

public enum LandUsageType
{
    Residential = 1,
    Commercial = 2,
    AgriculturalWet = 3,
    AgriculturalDry = 4,
    Industrial = 5,
    MixedUse = 6
}

public enum ConfidenceLevel
{
    Insufficient = 0,
    Low = 1,
    Moderate = 2,
    High = 3
}

public enum AreaUnit
{
    SqFt = 1,
    Cent = 2,
    Acre = 3,
    Ground = 4,
    Kuzhi = 5,
    SqMeter = 6
}

