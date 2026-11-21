using System.Buffers;
using System.Security.Claims;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static Greenart.Api.Marketplace.MarketplaceAccess;

namespace Greenart.Api.Marketplace;

internal static partial class PropertyEndpoints
{
    private const int MaxPhotos = 10;
    private const int MaxDocuments = 5;
    private static readonly SemaphoreSlim UploadSlots = new(2, 2);

    private static async Task<IResult> Upload(Guid id, int version, ListingMediaKind kind, HttpRequest request,
        ClaimsPrincipal principal, LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        if (await ApprovedSeller(db, actor, ct) is null)
            return Results.Forbid();
        if (!await db.MarketplaceListings.AnyAsync(l => l.Id == id && l.SellerId == actor, ct))
            return Results.NotFound();

        if (!Enum.IsDefined(kind))
            return Bad("Choose Photo or VerificationDocument.");
        if (request.ContentLength > PropertyMediaContent.MaxBytes)
            return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);

        var contentType = request.ContentType?.Split(';', 2)[0].Trim().ToLowerInvariant();
        var image = contentType is "image/png" or "image/jpeg";
        if (!image && !(kind == ListingMediaKind.VerificationDocument && contentType == "application/pdf"))
            return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);

        if (!await UploadSlots.WaitAsync(0, ct))
            return Results.StatusCode(StatusCodes.Status429TooManyRequests);

        byte[]? content;
        try
        {
            var uploaded = await ReadUpload(request.Body, ct);
            if (uploaded is null)
                return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
            content = image
                ? PropertyMediaContent.NormalizeImage(uploaded, contentType!)
                : PropertyMediaContent.HasPdfEnvelope(uploaded) ? uploaded : null;
        }
        finally
        {
            UploadSlots.Release();
        }
        if (content is null)
            return Bad("The file is invalid or exceeds the image size limit.");

        await using var transaction = await LockUsers(db, ct, actor);
        var (listing, error) = await OwnedMutation(db, id, actor, version, ct);
        if (listing is null)
            return error!;
        if (!listing.CanEdit)
            return Conflict("This listing is closed or restricted.");

        var siblings = await db.ListingMedia.Where(m => m.ListingId == id && m.Kind == kind)
            .OrderBy(m => m.SortOrder).ToListAsync(ct);
        var limit = kind == ListingMediaKind.Photo ? MaxPhotos : MaxDocuments;
        if (siblings.Count >= limit)
            return Conflict($"This listing already has the maximum of {limit} files of this kind.");

        var sortOrder = siblings.Count == 0 ? 0 : siblings[^1].SortOrder + 1;
        var media = new ListingMedia(id, kind, contentType!, sortOrder,
            kind == ListingMediaKind.Photo && siblings.Count == 0);
        db.ListingMedia.Add(media);
        db.ListingMediaBlobs.Add(new ListingMediaBlob(media.Id, content));
        RecordMediaChange(db, listing, actor, media.Kind, "ListingMediaAdded", media.Id.ToString());
        await Save(db, transaction, ct);
        var response = ToMedia(id, media.Id, media.Kind, media.ContentType, media.IsCover, media.SortOrder, media.CreatedAtUtc);
        return Results.Created(response.Url, new { media = response, listing.Version });
    }

    private static async Task<byte[]?> ReadUpload(Stream body, CancellationToken ct)
    {
        var buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);
        try
        {
            using var content = new MemoryStream();
            int read;
            while ((read = await body.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
            {
                if (content.Length + read > PropertyMediaContent.MaxBytes)
                    return null;
                content.Write(buffer, 0, read);
            }
            return content.ToArray();
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
        }
    }

    private static async Task<IResult> RetrieveMedia(Guid id, Guid mediaId, HttpContext context,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(context.User);
        var adminClaim = context.User.IsInRole(UserRole.Administrator.ToString());
        var allowedPrivate = from listing in db.MarketplaceListings
                             where listing.Id == id && db.Users.Any(u => u.Id == actor &&
                                 u.AccountStatus == AccountStatus.Active &&
                                 (u.Id == listing.SellerId || adminClaim && u.Role == UserRole.Administrator))
                             select listing.Id;
        var publicListings = PublicListings(db);
        var media = await (from metadata in db.ListingMedia.AsNoTracking()
                           join blob in db.ListingMediaBlobs.AsNoTracking() on metadata.Id equals blob.MediaId
                           where metadata.Id == mediaId && metadata.ListingId == id &&
                                 (allowedPrivate.Any() || metadata.Kind == ListingMediaKind.Photo &&
                                     publicListings.Any(l => l.Id == id))
                           select new { metadata.Kind, metadata.ContentType, blob.Content }).SingleOrDefaultAsync(ct);
        if (media is null)
            return Results.NotFound();

        context.Response.Headers.CacheControl = "private, no-store";
        context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Response.Headers.ContentSecurityPolicy = "sandbox; default-src 'none'";
        if (media.Kind == ListingMediaKind.Photo)
            return Results.File(media.Content, media.ContentType);
        var extension = media.ContentType switch
        {
            "application/pdf" => "pdf",
            "image/jpeg" => "jpg",
            _ => "png"
        };
        return Results.File(media.Content, "application/octet-stream", $"verification-document.{extension}");
    }

    private static async Task<IResult> OrderMedia(Guid id, PropertyMediaOrderRequest request, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        await using var transaction = await LockUsers(db, ct, actor);
        var (listing, error) = await OwnedMutation(db, id, actor, request.Version, ct);
        if (listing is null)
            return error!;
        if (!listing.CanEdit)
            return Conflict("This listing is closed or restricted.");
        if (request.PhotoIds is not { Count: > 0 and <= MaxPhotos } ordered || !ordered.Contains(request.CoverId) ||
            ordered.Distinct().Count() != ordered.Count)
            return Bad("Provide each photo ID once and choose one as the cover.");

        var photos = await db.ListingMedia.Where(m => m.ListingId == id && m.Kind == ListingMediaKind.Photo)
            .ToDictionaryAsync(m => m.Id, ct);
        if (photos.Count != ordered.Count || ordered.Any(photo => !photos.ContainsKey(photo)))
            return Bad("All ordered photos must belong to this listing.");

        for (var index = 0; index < ordered.Count; index++)
            photos[ordered[index]].Arrange(index, ordered[index] == request.CoverId);
        RecordMediaChange(db, listing, actor, ListingMediaKind.Photo, "ListingPhotosArranged", request.CoverId.ToString());
        await Save(db, transaction, ct);
        return Results.Ok(new { listing.Version, media = await OwnerMedia(db, id, ct) });
    }

    private static async Task<IResult> DeleteMedia(Guid id, Guid mediaId, int version, ClaimsPrincipal principal,
        LandPriceDbContext db, CancellationToken ct)
    {
        var actor = UserId(principal);
        await using var transaction = await LockUsers(db, ct, actor);
        var (listing, error) = await OwnedMutation(db, id, actor, version, ct);
        if (listing is null)
            return error!;
        if (!listing.CanEdit)
            return Conflict("This listing is closed or restricted.");

        var media = await db.ListingMedia.SingleOrDefaultAsync(m => m.Id == mediaId && m.ListingId == id, ct);
        if (media is null)
            return Results.NotFound();
        if (media.IsCover)
        {
            var next = await db.ListingMedia.Where(m => m.ListingId == id && m.Id != mediaId && m.Kind == ListingMediaKind.Photo)
                .OrderBy(m => m.SortOrder).ThenBy(m => m.Id).FirstOrDefaultAsync(ct);
            next?.Arrange(next.SortOrder, isCover: true);
        }
        db.ListingMedia.Remove(media);
        RecordMediaChange(db, listing, actor, media.Kind, "ListingMediaRemoved", media.Id.ToString());
        await Save(db, transaction, ct);
        return Results.Ok(new { listing.Version });
    }

    private static void RecordMediaChange(LandPriceDbContext db, MarketplaceListing listing, Guid actor,
        ListingMediaKind kind, string action, string details)
    {
        var before = listing.Status;
        if (kind == ListingMediaKind.Photo)
            listing.ChangeMedia();
        else
            listing.ChangePrivateDocuments();
        if (before != listing.Status)
            RecordModeration(db, listing, actor, before, "ListingMediaRequiresReview");
        AddAudit(db, listing.Id, actor, action, details);
    }
}
