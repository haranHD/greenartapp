using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Greenart.Api.Marketplace;

internal static partial class PropertyEndpoints
{
    private static PropertyListingDto ToPublic(MarketplaceListing l, IReadOnlyList<PropertyMediaDto> photos, bool approved) => new(
        l.Id, l.Title, l.Description, l.State, l.District, l.Locality, l.Taluk, l.Village,
        l.HasExactLocation ? PropertyValidation.PublicCoordinate(l.Latitude) : null,
        l.HasExactLocation ? PropertyValidation.PublicCoordinate(l.Longitude) : null,
        Enum.IsDefined(l.LandUsage) ? l.LandUsage : null, l.LandClassification,
        l.EnteredArea ?? (l.ExtentCent > 0 ? l.ExtentCent : null),
        l.EnteredAreaUnit ?? (l.ExtentCent > 0 ? AreaUnit.Cent : null),
        l.ExtentCent, l.ExtentSqFt, l.AskingPriceTotal, l.AskingRatePerCent, l.AskingRatePerSqFt,
        AskingRatePerAcre(l),
        l.Negotiable, SourceCategory.AdvertisedAskingPrice, l.Features with { ApprovalDetails = null },
        l.SaleStatus, l.Seller?.FullName ?? "Property Owner", l.Seller?.SellerType ?? SellerType.IndividualOwner,
        approved, l.PublishedAtUtc, l.CreatedAtUtc, l.UpdatedAtUtc, photos);

    private static decimal AskingRatePerAcre(MarketplaceListing listing)
    {
        var acres = listing.EnteredArea is { } area && listing.EnteredAreaUnit is { } unit
            ? new LandArea(area, unit).ToAcres() : listing.ExtentCent / 100;
        return acres > 0 ? Math.Round(listing.AskingPriceTotal / acres, 2) : 0;
    }

    private static object ToOwner(MarketplaceListing l, IReadOnlyList<PropertyMediaDto> media, bool approved) => new
    {
        l.Id,
        listing = ToPublic(l, media.Where(m => m.Kind == ListingMediaKind.Photo).ToArray(), approved),
        l.Version,
        moderationStatus = ModerationLabel(l.Status),
        l.SaleStatus,
        l.RejectionReason,
        privateDetails = new
        {
            l.SellerId,
            l.StreetAddress,
            l.SurveyNumber,
            l.Landmark,
            l.SellerRelationship,
            latitude = l.HasExactLocation ? (double?)l.Latitude : null,
            longitude = l.HasExactLocation ? (double?)l.Longitude : null,
            l.PricingNotes,
            l.Features.ApprovalDetails
        },
        documents = media.Where(m => m.Kind == ListingMediaKind.VerificationDocument).ToArray()
    };

    private static async Task<PropertyPage<PropertyListingDto>> PublicPage(PropertyPage<MarketplaceListing> page,
        LandPriceDbContext db, CancellationToken ct)
    {
        var ids = page.Items.Select(l => l.Id).ToArray();
        if (ids.Length == 0)
            return new([], page.Page, page.PageSize, page.HasMore);

        var covers = await PublicPhotoQuery(db, ids).Where(m => m.IsCover)
            .Select(m => new { m.ListingId, m.Id, m.Kind, m.ContentType, m.IsCover, m.SortOrder, m.CreatedAtUtc }).ToListAsync(ct);
        var byListing = covers.ToLookup(m => m.ListingId, m => ToMedia(m.ListingId, m.Id, m.Kind,
            m.ContentType, m.IsCover, m.SortOrder, m.CreatedAtUtc));
        return ProjectPage(page, l => ToPublic(l, byListing[l.Id].ToArray(), true));
    }

    private static IQueryable<ListingMedia> PublicPhotoQuery(LandPriceDbContext db, Guid[] ids)
    {
        var published = MarketplaceAccess.PublicListings(db);
        return MediaQuery(db, ids, photosOnly: true).Where(m => published.Any(l => l.Id == m.ListingId));
    }

    private static IQueryable<ListingMedia> MediaQuery(LandPriceDbContext db, Guid[] ids, bool photosOnly) =>
        db.ListingMedia.AsNoTracking()
            .Where(m => ids.Contains(m.ListingId) && (!photosOnly || m.Kind == ListingMediaKind.Photo))
            .OrderByDescending(m => m.IsCover).ThenBy(m => m.SortOrder).ThenBy(m => m.Id);

    private static PropertyMediaDto ToMedia(Guid id, Guid mediaId, ListingMediaKind kind, string contentType,
        bool cover, int order, DateTime created) =>
        new(mediaId, kind, contentType, cover, order, $"/api/v1/properties/{id}/media/{mediaId}", created);

    private static async Task<PropertyMediaDto[]> OwnerMedia(LandPriceDbContext db, Guid id, CancellationToken ct)
    {
        var media = await MediaQuery(db, [id], photosOnly: false)
            .Select(m => new { m.Id, m.Kind, m.ContentType, m.IsCover, m.SortOrder, m.CreatedAtUtc }).ToListAsync(ct);
        return media.Select(m => ToMedia(id, m.Id, m.Kind, m.ContentType, m.IsCover, m.SortOrder, m.CreatedAtUtc)).ToArray();
    }

    private static MarketplaceListingDto ToLegacy(MarketplaceListing l, bool publicView = false) => new(
        l.Id, l.Title, l.Description, l.SellerId, l.Seller?.FullName ?? "Property Owner",
        publicView ? null : l.Seller?.PhoneNumber, publicView || (l.Seller?.IsSellerVerified ?? false),
        l.Locality, l.District, l.State, l.Taluk,
        publicView ? null : l.StreetAddress, publicView ? null : l.SurveyNumber,
        publicView ? PropertyValidation.PublicCoordinate(l.Latitude) : l.Latitude,
        publicView ? PropertyValidation.PublicCoordinate(l.Longitude) : l.Longitude,
        l.LandUsage, l.ExtentCent, l.ExtentSqFt, l.AskingPriceTotal, l.AskingRatePerCent, l.AskingRatePerSqFt,
        l.GuidelineRatePerCent, l.GuidelineRatePerSqFt, l.EstimatedMarketMedianPerCent,
        LegacyStatus(l), publicView ? null : l.RejectionReason, l.CreatedAtUtc, l.UpdatedAtUtc, l.Version,
        SellerEmail: publicView ? null : l.Seller?.Email);

    private static string ModerationLabel(ListingStatus status) =>
        status is ListingStatus.Active or ListingStatus.Sold ? "Published" : status.ToString();

    private static ListingStatus LegacyStatus(MarketplaceListing l)
    {
        if (l.SaleStatus == ListingSaleStatus.Sold)
            return ListingStatus.Sold;
        if (l.SaleStatus == ListingSaleStatus.Withdrawn)
            return ListingStatus.Archived;
        return l.Status switch
        {
            ListingStatus.NeedsChanges => ListingStatus.Rejected,
            ListingStatus.Suspended => ListingStatus.Archived,
            _ => l.Status
        };
    }
}
