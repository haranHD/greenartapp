using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class AuthAndMarketplaceDomainTests
{
    [Fact]
    public void UserCreation_ShouldEnforceStrictDefaults()
    {
        var user = new User(
            id: Guid.NewGuid(),
            email: "Test.User@example.com",
            fullName: "Test User",
            googleSubjectId: "google-sub-12345"
        );

        Assert.Equal("test.user@example.com", user.Email);
        Assert.Equal("Test User", user.FullName);
        Assert.Equal("google-sub-12345", user.GoogleSubjectId);
        Assert.Equal(UserRole.Customer, user.Role);
        Assert.Equal(AccountStatus.Active, user.AccountStatus);
        Assert.False(user.IsSellerVerified);
        Assert.Equal(SellerType.IndividualOwner, user.SellerType);
        Assert.Null(user.LastLoginAtUtc);
        Assert.True(user.CreatedAtUtc <= DateTime.UtcNow);
    }

    [Fact]
    public void UserCreation_WithInvalidParameters_ShouldThrow()
    {
        Assert.Throws<ArgumentException>(() => new User(Guid.NewGuid(), "", "Name", "sub-123"));
        Assert.Throws<ArgumentException>(() => new User(Guid.NewGuid(), "a@b.com", "   ", "sub-123"));
        Assert.Throws<ArgumentException>(() => new User(Guid.NewGuid(), "a@b.com", "Name", "   "));
    }

    [Fact]
    public void UserMutations_ShouldUpdateStateCorrectly()
    {
        var user = new User(Guid.NewGuid(), "user@example.com", "Initial Name", "sub-999");

        var now = DateTime.UtcNow;
        user.RecordLogin(now);
        Assert.Equal(now, user.LastLoginAtUtc);

        user.UpdateProfile("Updated Name", "+919876543210", "https://avatar.url/img.png");
        Assert.Equal("Updated Name", user.FullName);
        Assert.Equal("+919876543210", user.PhoneNumber);
        Assert.Equal("https://avatar.url/img.png", user.AvatarUrl);

        user.SetSellerType(SellerType.Promoter);
        Assert.Equal(SellerType.Promoter, user.SellerType);

        user.SetSellerVerification(true);
        Assert.True(user.IsSellerVerified);

        user.UpdateRole(UserRole.Reviewer);
        Assert.Equal(UserRole.Reviewer, user.Role);

        user.UpdateAccountStatus(AccountStatus.Suspended);
        Assert.Equal(AccountStatus.Suspended, user.AccountStatus);
    }

    [Fact]
    public void UserRefreshToken_Lifecycle_ShouldOperateCorrectly()
    {
        var userId = Guid.NewGuid();
        var token = new UserRefreshToken(
            id: Guid.NewGuid(),
            userId: userId,
            tokenHash: "sha256-hashed-opaque-token-string",
            expiresAtUtc: DateTime.UtcNow.AddDays(7)
        );

        Assert.Equal(userId, token.UserId);
        Assert.Equal("sha256-hashed-opaque-token-string", token.TokenHash);
        Assert.False(token.IsExpired);
        Assert.False(token.IsRevoked);
        Assert.True(token.IsActive);

        token.Revoke();
        Assert.True(token.IsRevoked);
        Assert.False(token.IsActive);
    }

    [Fact]
    public void MarketplaceListing_ShouldStrictlyDefaultToPendingReview()
    {
        var sellerId = Guid.NewGuid();
        var listing = new MarketplaceListing(
            id: Guid.NewGuid(),
            title: "Prime Land Parcel in Kannampalayam",
            description: "Clear patta property near Trichy Road",
            sellerId: sellerId,
            locality: "Kannampalayam",
            district: "Coimbatore",
            state: "Tamil Nadu",
            coordinates: new GeoCoordinate(11.0012, 77.0874),
            landUsage: LandUsageType.Residential,
            extentCent: 5.5m,
            extentSqFt: 2395.8m,
            askingPriceTotal: 5500000m,
            askingRatePerCent: 1000000m,
            askingRatePerSqFt: 2295.68m,
            guidelineRatePerCent: 195000m,
            estimatedMarketMedianPerCent: 950000m
        );

        Assert.Equal(ListingStatus.PendingReview, listing.Status);
        Assert.Null(listing.RejectionReason);
        Assert.Null(listing.ReviewedByUserId);
        Assert.Equal(11.0012, listing.Latitude);
        Assert.Equal(77.0874, listing.Longitude);
        Assert.Equal(5500000m, listing.AskingPriceTotal);
        Assert.Equal(195000m, listing.GuidelineRatePerCent);
        Assert.Equal(950000m, listing.EstimatedMarketMedianPerCent);
    }

    [Fact]
    public void MarketplaceListing_ValidationInvariants_ShouldThrowOnInvalidValues()
    {
        var sellerId = Guid.NewGuid();
        var coords = new GeoCoordinate(11.0012, 77.0874);

        // Extent cent must be positive
        Assert.Throws<ArgumentOutOfRangeException>(() => new MarketplaceListing(
            Guid.NewGuid(), "Title", "Desc", sellerId, "Loc", "Dist", "State", coords,
            LandUsageType.Residential, 0m, 100m, 100000m, 1000m, 100m));

        // Asking price must be positive
        Assert.Throws<ArgumentOutOfRangeException>(() => new MarketplaceListing(
            Guid.NewGuid(), "Title", "Desc", sellerId, "Loc", "Dist", "State", coords,
            LandUsageType.Residential, 5m, 2178m, -500m, 1000m, 100m));

        // SellerId cannot be empty
        Assert.Throws<ArgumentException>(() => new MarketplaceListing(
            Guid.NewGuid(), "Title", "Desc", Guid.Empty, "Loc", "Dist", "State", coords,
            LandUsageType.Residential, 5m, 2178m, 100000m, 20000m, 45m));
    }

    [Fact]
    public void MarketplaceListing_ModerationWorkflow_ApproveAndReject()
    {
        var listing = new MarketplaceListing(
            Guid.NewGuid(), "Title", "Desc", Guid.NewGuid(), "Sulur", "Coimbatore", "Tamil Nadu",
            new GeoCoordinate(11.01, 77.10), LandUsageType.Commercial, 10m, 4356m,
            10000000m, 1000000m, 2295.68m);

        Assert.Equal(ListingStatus.PendingReview, listing.Status);

        var reviewerId = Guid.NewGuid();
        listing.Approve(reviewerId, "Documents verified with TNREGINET");
        Assert.Equal(ListingStatus.Active, listing.Status);
        Assert.Equal(reviewerId, listing.ReviewedByUserId);
        Assert.Equal("Documents verified with TNREGINET", listing.ModerationNotes);

        listing.Reject(reviewerId, "Discrepancy in FMB sketch boundary", "Requires surveyor update");
        Assert.Equal(ListingStatus.Rejected, listing.Status);
        Assert.Equal("Discrepancy in FMB sketch boundary", listing.RejectionReason);

        listing.MarkAsSold();
        Assert.Equal(ListingStatus.Sold, listing.Status);

        listing.Archive();
        Assert.Equal(ListingStatus.Archived, listing.Status);
    }

    [Fact]
    public void ListingEnquiry_ShouldInitializeAndProgressStatus()
    {
        var listingId = Guid.NewGuid();
        var buyerId = Guid.NewGuid();
        var enquiry = new ListingEnquiry(
            id: Guid.NewGuid(),
            listingId: listingId,
            buyerUserId: buyerId,
            message: "Interested in visiting the site this Saturday.",
            offeredPriceTotal: 5200000m
        );

        Assert.Equal(EnquiryStatus.Submitted, enquiry.Status);
        Assert.Equal(5200000m, enquiry.OfferedPriceTotal);
        Assert.Equal(listingId, enquiry.ListingId);
        Assert.Equal(buyerId, enquiry.BuyerUserId);

        enquiry.MarkContacted();
        Assert.Equal(EnquiryStatus.Contacted, enquiry.Status);

        enquiry.Close();
        Assert.Equal(EnquiryStatus.Closed, enquiry.Status);

        enquiry.MarkAsSpam();
        Assert.Equal(EnquiryStatus.Spam, enquiry.Status);
    }

    [Fact]
    public void EnumValues_ShouldMaintainNumericStability()
    {
        // UserRole
        Assert.Equal(1, (int)UserRole.Customer);
        Assert.Equal(2, (int)UserRole.Reviewer);
        Assert.Equal(3, (int)UserRole.Administrator);

        // AccountStatus
        Assert.Equal(1, (int)AccountStatus.Active);
        Assert.Equal(2, (int)AccountStatus.Suspended);
        Assert.Equal(3, (int)AccountStatus.Deactivated);

        // ListingStatus
        Assert.Equal(0, (int)ListingStatus.Draft);
        Assert.Equal(1, (int)ListingStatus.PendingReview);
        Assert.Equal(2, (int)ListingStatus.Active);
        Assert.Equal(3, (int)ListingStatus.Rejected);
        Assert.Equal(4, (int)ListingStatus.Sold);
        Assert.Equal(5, (int)ListingStatus.Archived);

        // SellerType
        Assert.Equal(1, (int)SellerType.IndividualOwner);
        Assert.Equal(2, (int)SellerType.Promoter);
        Assert.Equal(3, (int)SellerType.LicensedAgent);

        // EnquiryStatus
        Assert.Equal(1, (int)EnquiryStatus.Submitted);
        Assert.Equal(2, (int)EnquiryStatus.Contacted);
        Assert.Equal(3, (int)EnquiryStatus.Closed);
        Assert.Equal(4, (int)EnquiryStatus.Spam);
    }
}

