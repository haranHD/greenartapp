namespace Greenart.Domain.Enums;

/// <summary>
/// Lifecycle status of a land marketplace listing.
/// PendingReview is the strict mandatory default for all new submissions.
/// </summary>
public enum ListingStatus
{
    Draft = 0,
    PendingReview = 1,
    Active = 2,
    Rejected = 3,
    Sold = 4,
    Archived = 5
}

/// <summary>
/// Lifecycle status of a direct buyer enquiry for a marketplace listing.
/// </summary>
public enum EnquiryStatus
{
    Submitted = 1,
    Contacted = 2,
    Closed = 3,
    Spam = 4
}

/// <summary>
/// Entity type of the land seller, aligned with @greenart/shared-types.
/// </summary>
public enum SellerType
{
    IndividualOwner = 1,
    Promoter = 2,
    LicensedAgent = 3
}

