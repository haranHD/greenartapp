using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

/// <summary>
/// Domain entity representing a direct buyer enquiry for a marketplace listing.
/// The buyer identity is derived server-side from the authenticated principal (BuyerUserId).
/// </summary>
public class ListingEnquiry
{
    public Guid Id { get; private set; }
    public Guid ListingId { get; private set; }
    public Guid BuyerUserId { get; private set; }
    public decimal? OfferedPriceTotal { get; private set; }
    public string Message { get; private set; } = string.Empty;
    public EnquiryStatus Status { get; private set; } = EnquiryStatus.Submitted;
    public DateTime SubmittedAtUtc { get; private set; }

    // Navigation properties
    public MarketplaceListing? Listing { get; private set; }
    public User? BuyerUser { get; private set; }

    // EF Core constructor
    private ListingEnquiry() { }

    public ListingEnquiry(
        Guid id,
        Guid listingId,
        Guid buyerUserId,
        string message,
        decimal? offeredPriceTotal = null,
        EnquiryStatus status = EnquiryStatus.Submitted,
        DateTime? submittedAtUtc = null)
    {
        if (listingId == Guid.Empty) throw new ArgumentException("ListingId is required.", nameof(listingId));
        if (buyerUserId == Guid.Empty) throw new ArgumentException("BuyerUserId is required.", nameof(buyerUserId));
        if (string.IsNullOrWhiteSpace(message)) throw new ArgumentException("Message is required.", nameof(message));
        if (offeredPriceTotal.HasValue && offeredPriceTotal.Value <= 0)
            throw new ArgumentOutOfRangeException(nameof(offeredPriceTotal), "OfferedPriceTotal must be strictly positive if provided.");

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        ListingId = listingId;
        BuyerUserId = buyerUserId;
        Message = message.Trim();
        OfferedPriceTotal = offeredPriceTotal;
        Status = status;
        SubmittedAtUtc = submittedAtUtc ?? DateTime.UtcNow;
    }

    public void MarkContacted()
    {
        Status = EnquiryStatus.Contacted;
    }

    public void Close()
    {
        Status = EnquiryStatus.Closed;
    }

    public void MarkAsSpam()
    {
        Status = EnquiryStatus.Spam;
    }
}

