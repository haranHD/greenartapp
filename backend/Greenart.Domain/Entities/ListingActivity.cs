using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

public record ListingPriceChange(
    Guid Id, Guid ListingId, Guid ChangedByUserId, decimal? PreviousPrice, decimal? NewPrice, DateTime ChangedAtUtc);

public record ListingModerationChange(
    Guid Id, Guid ListingId, Guid ActorUserId, ListingStatus PreviousStatus, ListingStatus NewStatus,
    int ListingVersion, string? Reason, string? Notes, DateTime CreatedAtUtc);

public record ListingFavourite(Guid UserId, Guid ListingId, DateTime CreatedAtUtc);

public record ListingReport(Guid Id, Guid ListingId, Guid ReporterUserId, string Reason, DateTime CreatedAtUtc);

public class ListingMedia
{
    public Guid Id { get; private set; }
    public Guid ListingId { get; private set; }
    public ListingMediaKind Kind { get; private set; }
    public string ContentType { get; private set; } = string.Empty;
    public bool IsCover { get; private set; }
    public int SortOrder { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private ListingMedia() { }

    public ListingMedia(Guid listingId, ListingMediaKind kind, string contentType, int sortOrder, bool isCover)
    {
        Id = Guid.NewGuid();
        ListingId = listingId;
        Kind = kind;
        ContentType = contentType;
        SortOrder = sortOrder;
        IsCover = isCover;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void Arrange(int sortOrder, bool isCover)
    {
        SortOrder = sortOrder;
        IsCover = Kind == ListingMediaKind.Photo && isCover;
    }
}

public record ListingMediaBlob(Guid MediaId, byte[] Content);
