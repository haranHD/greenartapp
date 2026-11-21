using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Domain.Entities;

/// <summary>
/// Domain entity representing a land plot listed on the marketplace.
/// Every newly submitted listing must strictly default to PendingReview.
/// Asking prices are kept conceptually distinct from completed transactions and statutory guideline rates.
/// Spatial coordinates use the GeoCoordinate value object, aligned with domain patterns and mapped to PostGIS geography Point in persistence.
/// </summary>
public class MarketplaceListing
{
    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Guid SellerId { get; private set; }
    public string Locality { get; private set; } = string.Empty;
    public string District { get; private set; } = string.Empty;
    public string State { get; private set; } = "Tamil Nadu";
    public string? Taluk { get; private set; }
    public string? StreetAddress { get; private set; }
    public string? SurveyNumber { get; private set; }

    public GeoCoordinate Coordinates { get; private set; }
    public double Latitude => Coordinates.Latitude;
    public double Longitude => Coordinates.Longitude;

    public bool HasExactLocation { get; private set; } = true;
    public string? Village { get; private set; }
    public string? Landmark { get; private set; }
    public string? LandClassification { get; private set; }
    public string? SellerRelationship { get; private set; }
    public ListingFeatures Features { get; private set; } = new();

    public LandUsageType LandUsage { get; private set; }
    public decimal ExtentCent { get; private set; }
    public decimal ExtentSqFt { get; private set; }

    public decimal? EnteredArea { get; private set; }
    public AreaUnit? EnteredAreaUnit { get; private set; }
    public decimal? OriginalAskingPrice { get; private set; }
    public bool Negotiable { get; private set; }
    public string? PricingNotes { get; private set; }
    public string? ParcelFingerprint { get; private set; }
    public Guid? CreationRequestId { get; private set; }
    public int Version { get; private set; } = 1;
    public ListingSaleStatus SaleStatus { get; private set; }
    public DateTime? PublishedAtUtc { get; private set; }

    public bool CanEdit => Status is not (ListingStatus.Suspended or ListingStatus.Archived or ListingStatus.Sold)
        && SaleStatus is (ListingSaleStatus.Available or ListingSaleStatus.UnderNegotiation);

    // Asking Price Architecture (distinct from empirical valuation)
    public decimal AskingPriceTotal { get; private set; }
    public decimal AskingRatePerCent { get; private set; }
    public decimal AskingRatePerSqFt { get; private set; }

    // Intelligence Benchmarks (reference only; never conflated with asking price)
    public decimal? GuidelineRatePerCent { get; private set; }
    public decimal? GuidelineRatePerSqFt { get; private set; }
    public decimal? EstimatedMarketMedianPerCent { get; private set; }

    // Moderation & Lifecycle
    public ListingStatus Status { get; private set; } = ListingStatus.PendingReview;
    public string? RejectionReason { get; private set; }
    public string? ModerationNotes { get; private set; }
    public Guid? ReviewedSellerApplicationId { get; private set; }
    public Guid? ReviewedByUserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation properties
    public User? Seller { get; private set; }
    public User? ReviewedByUser { get; private set; }
    public ICollection<ListingEnquiry> Enquiries { get; private set; } = new List<ListingEnquiry>();

    public void AttachSeller(User user) => Seller = user;

    // EF Core constructor
    private MarketplaceListing() { }

    public MarketplaceListing(
        Guid id,
        string title,
        string description,
        Guid sellerId,
        string locality,
        string district,
        string state,
        GeoCoordinate coordinates,
        LandUsageType landUsage,
        decimal extentCent,
        decimal extentSqFt,
        decimal askingPriceTotal,
        decimal askingRatePerCent,
        decimal askingRatePerSqFt,
        decimal? guidelineRatePerCent = null,
        decimal? guidelineRatePerSqFt = null,
        decimal? estimatedMarketMedianPerCent = null,
        ListingStatus status = ListingStatus.PendingReview,
        string? rejectionReason = null,
        string? moderationNotes = null,
        Guid? reviewedByUserId = null,
        string? taluk = null,
        string? streetAddress = null,
        string? surveyNumber = null,
        DateTime? createdAtUtc = null,
        DateTime? updatedAtUtc = null)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));
        if (string.IsNullOrWhiteSpace(locality)) throw new ArgumentException("Locality is required.", nameof(locality));
        if (string.IsNullOrWhiteSpace(district)) throw new ArgumentException("District is required.", nameof(district));
        if (string.IsNullOrWhiteSpace(state)) throw new ArgumentException("State is required.", nameof(state));
        if (sellerId == Guid.Empty) throw new ArgumentException("SellerId is required.", nameof(sellerId));
        if (extentCent <= 0) throw new ArgumentOutOfRangeException(nameof(extentCent), "ExtentCent must be strictly positive.");
        if (extentSqFt <= 0) throw new ArgumentOutOfRangeException(nameof(extentSqFt), "ExtentSqFt must be strictly positive.");
        if (askingPriceTotal <= 0) throw new ArgumentOutOfRangeException(nameof(askingPriceTotal), "AskingPriceTotal must be strictly positive.");
        if (askingRatePerCent <= 0) throw new ArgumentOutOfRangeException(nameof(askingRatePerCent), "AskingRatePerCent must be strictly positive.");
        if (askingRatePerSqFt <= 0) throw new ArgumentOutOfRangeException(nameof(askingRatePerSqFt), "AskingRatePerSqFt must be strictly positive.");

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        Title = title.Trim();
        Description = description ?? string.Empty;
        SellerId = sellerId;
        Locality = locality.Trim();
        District = district.Trim();
        State = state.Trim();
        Coordinates = coordinates;
        LandUsage = landUsage;
        ExtentCent = extentCent;
        ExtentSqFt = extentSqFt;
        AskingPriceTotal = askingPriceTotal;
        OriginalAskingPrice = askingPriceTotal;
        AskingRatePerCent = askingRatePerCent;
        AskingRatePerSqFt = askingRatePerSqFt;
        GuidelineRatePerCent = guidelineRatePerCent;
        GuidelineRatePerSqFt = guidelineRatePerSqFt;
        EstimatedMarketMedianPerCent = estimatedMarketMedianPerCent;
        Status = status;
        RejectionReason = rejectionReason;
        ModerationNotes = moderationNotes;
        ReviewedByUserId = reviewedByUserId;
        Taluk = string.IsNullOrWhiteSpace(taluk) ? null : taluk.Trim();
        StreetAddress = string.IsNullOrWhiteSpace(streetAddress) ? null : streetAddress.Trim();
        SurveyNumber = string.IsNullOrWhiteSpace(surveyNumber) ? null : surveyNumber.Trim();
        CreatedAtUtc = createdAtUtc ?? DateTime.UtcNow;
        UpdatedAtUtc = updatedAtUtc ?? CreatedAtUtc;
    }

    public static MarketplaceListing CreateDraft(Guid sellerId, Guid? requestId, ListingRevision revision)
    {
        var listing = new MarketplaceListing
        {
            Id = Guid.NewGuid(),
            SellerId = sellerId,
            CreationRequestId = requestId,
            Status = ListingStatus.Draft,
            CreatedAtUtc = DateTime.UtcNow
        };
        listing.Apply(revision);
        listing.UpdatedAtUtc = listing.CreatedAtUtc;
        return listing;
    }

    public void Edit(ListingRevision revision)
    {
        EnsureEditable();
        Apply(revision);
        InvalidateReview();
    }

    private void Apply(ListingRevision revision)
    {
        Title = revision.Title;
        Description = revision.Description;
        State = revision.State;
        District = revision.District;
        Taluk = revision.Taluk;
        Village = revision.Village;
        Locality = revision.Locality;
        Landmark = revision.Landmark;
        StreetAddress = revision.StreetAddress;
        SurveyNumber = revision.SurveyNumber;
        HasExactLocation = revision.Coordinates.HasValue;
        Coordinates = revision.Coordinates.GetValueOrDefault();
        LandUsage = revision.LandUsage.GetValueOrDefault();
        LandClassification = revision.LandClassification;
        SellerRelationship = revision.SellerRelationship;
        Features = revision.Features;
        EnteredArea = revision.Area?.Value;
        EnteredAreaUnit = revision.Area?.Unit;

        var squareFeet = revision.Area?.ToSqFt() ?? 0;
        var cents = revision.Area?.ToCents() ?? 0;
        ExtentSqFt = Math.Round(squareFeet, 2);
        ExtentCent = Math.Round(cents, 4);
        AskingPriceTotal = revision.AskingPrice.GetValueOrDefault();
        AskingRatePerSqFt = squareFeet > 0 ? Math.Round(AskingPriceTotal / squareFeet, 2) : 0;
        AskingRatePerCent = cents > 0 ? Math.Round(AskingPriceTotal / cents, 2) : 0;
        if (AskingPriceTotal > 0)
            OriginalAskingPrice ??= AskingPriceTotal;
        Negotiable = revision.Negotiable;
        PricingNotes = revision.PricingNotes;
        ParcelFingerprint = revision.ParcelFingerprint;
    }

    public bool HasRequiredDetails(bool requireLocation = true) => Title.Length > 0 && State.Length > 0 && District.Length > 0 &&
        Locality.Length > 0 && (!requireLocation || HasExactLocation) && Enum.IsDefined(LandUsage) &&
        ExtentCent > 0 && ExtentSqFt > 0 && AskingPriceTotal > 0;

    public void Submit(bool requireLocation = true)
    {
        EnsureEditable();
        if (Status is not (ListingStatus.Draft or ListingStatus.NeedsChanges or ListingStatus.Rejected) ||
            !HasRequiredDetails(requireLocation))
            throw new InvalidOperationException("Complete the listing details before submitting.");

        Status = ListingStatus.PendingReview;
        ReviewedSellerApplicationId = null;
        Touch();
    }

    public void ChangeMedia()
    {
        EnsureEditable();
        InvalidateReview();
    }

    public void ChangePrivateDocuments()
    {
        EnsureEditable();
        if (Status is ListingStatus.Active or ListingStatus.PendingReview)
            InvalidateReview();
        else
            Touch();
    }

    public void RequestChanges(Guid reviewer, string reason, string? notes)
    {
        Reject(reviewer, reason, notes);
        Status = ListingStatus.NeedsChanges;
    }

    public void Suspend(Guid reviewer, string reason, string? notes)
    {
        Reject(reviewer, reason, notes);
        Status = ListingStatus.Suspended;
    }

    public void ChangeSaleStatus(ListingSaleStatus status)
    {
        if (status == SaleStatus)
            return;
        EnsureEditable();

        if (!Enum.IsDefined(status) || (status != ListingSaleStatus.Withdrawn && Status != ListingStatus.Active))
            throw new InvalidOperationException("The requested sale status is unavailable for this listing.");

        SaleStatus = status;
        Touch();
    }

    private void EnsureEditable()
    {
        if (!CanEdit)
            throw new InvalidOperationException("This listing is closed or restricted.");
    }

    private void InvalidateReview()
    {
        Status = ListingStatus.Draft;
        ReviewedSellerApplicationId = null;
        Touch();
    }

    private void Touch()
    {
        Version++;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Approve(Guid reviewerUserId, string? notes = null, Guid? sellerApplicationId = null)
    {
        if (reviewerUserId == Guid.Empty) throw new ArgumentException("ReviewerUserId is required.", nameof(reviewerUserId));
        if (!CanEdit || !HasRequiredDetails(requireLocation: false) || Status is not (ListingStatus.PendingReview or ListingStatus.Active))
            throw new InvalidOperationException("This listing cannot be published.");

        Status = ListingStatus.Active;
        PublishedAtUtc = DateTime.UtcNow;
        ReviewedSellerApplicationId = sellerApplicationId;
        ReviewedByUserId = reviewerUserId;
        RejectionReason = null;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            ModerationNotes = notes.Trim();
        }
        Touch();
    }

    public void Reject(Guid reviewerUserId, string reason, string? notes = null)
    {
        if (reviewerUserId == Guid.Empty) throw new ArgumentException("ReviewerUserId is required.", nameof(reviewerUserId));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Rejection reason is required.", nameof(reason));

        Status = ListingStatus.Rejected;
        ReviewedSellerApplicationId = null;
        ReviewedByUserId = reviewerUserId;
        RejectionReason = reason.Trim();
        if (!string.IsNullOrWhiteSpace(notes))
        {
            ModerationNotes = notes.Trim();
        }
        Touch();
    }

    public void Archive()
    {
        Status = ListingStatus.Archived;
        Touch();
    }

    public void UpdatePricing(
        decimal askingPriceTotal,
        decimal askingRatePerCent,
        decimal askingRatePerSqFt,
        decimal? guidelineRatePerCent = null,
        decimal? guidelineRatePerSqFt = null,
        decimal? estimatedMarketMedianPerCent = null)
    {
        if (askingPriceTotal <= 0) throw new ArgumentOutOfRangeException(nameof(askingPriceTotal), "AskingPriceTotal must be strictly positive.");
        if (askingRatePerCent <= 0) throw new ArgumentOutOfRangeException(nameof(askingRatePerCent), "AskingRatePerCent must be strictly positive.");
        if (askingRatePerSqFt <= 0) throw new ArgumentOutOfRangeException(nameof(askingRatePerSqFt), "AskingRatePerSqFt must be strictly positive.");

        EnsureEditable();
        AskingPriceTotal = askingPriceTotal;
        OriginalAskingPrice ??= askingPriceTotal;
        AskingRatePerCent = askingRatePerCent;
        AskingRatePerSqFt = askingRatePerSqFt;
        GuidelineRatePerCent = guidelineRatePerCent ?? GuidelineRatePerCent;
        GuidelineRatePerSqFt = guidelineRatePerSqFt ?? GuidelineRatePerSqFt;
        EstimatedMarketMedianPerCent = estimatedMarketMedianPerCent ?? EstimatedMarketMedianPerCent;
        InvalidateReview();
    }

    public void UpdateIntelligenceBenchmarks(
        decimal? guidelineRatePerCent,
        decimal? guidelineRatePerSqFt,
        decimal? estimatedMarketMedianPerCent)
    {
        GuidelineRatePerCent = guidelineRatePerCent;
        GuidelineRatePerSqFt = guidelineRatePerSqFt;
        EstimatedMarketMedianPerCent = estimatedMarketMedianPerCent;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

