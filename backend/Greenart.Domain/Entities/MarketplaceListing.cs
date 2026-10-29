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

    public LandUsageType LandUsage { get; private set; }
    public decimal ExtentCent { get; private set; }
    public decimal ExtentSqFt { get; private set; }

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
    public Guid? ReviewedByUserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation properties
    public User? Seller { get; private set; }
    public User? ReviewedByUser { get; private set; }
    public ICollection<ListingEnquiry> Enquiries { get; private set; } = new List<ListingEnquiry>();

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

    public void Approve(Guid reviewerUserId, string? notes = null)
    {
        if (reviewerUserId == Guid.Empty) throw new ArgumentException("ReviewerUserId is required.", nameof(reviewerUserId));

        Status = ListingStatus.Active;
        ReviewedByUserId = reviewerUserId;
        RejectionReason = null;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            ModerationNotes = notes.Trim();
        }
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reject(Guid reviewerUserId, string reason, string? notes = null)
    {
        if (reviewerUserId == Guid.Empty) throw new ArgumentException("ReviewerUserId is required.", nameof(reviewerUserId));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Rejection reason is required.", nameof(reason));

        Status = ListingStatus.Rejected;
        ReviewedByUserId = reviewerUserId;
        RejectionReason = reason.Trim();
        if (!string.IsNullOrWhiteSpace(notes))
        {
            ModerationNotes = notes.Trim();
        }
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkAsSold()
    {
        Status = ListingStatus.Sold;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Archive()
    {
        Status = ListingStatus.Archived;
        UpdatedAtUtc = DateTime.UtcNow;
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

        AskingPriceTotal = askingPriceTotal;
        AskingRatePerCent = askingRatePerCent;
        AskingRatePerSqFt = askingRatePerSqFt;
        GuidelineRatePerCent = guidelineRatePerCent ?? GuidelineRatePerCent;
        GuidelineRatePerSqFt = guidelineRatePerSqFt ?? GuidelineRatePerSqFt;
        EstimatedMarketMedianPerCent = estimatedMarketMedianPerCent ?? EstimatedMarketMedianPerCent;
        UpdatedAtUtc = DateTime.UtcNow;
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

