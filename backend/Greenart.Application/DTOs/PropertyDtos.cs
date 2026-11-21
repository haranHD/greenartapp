using Greenart.Domain.Entities;
using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record PropertyDraftRequest(
    string? Title = null, string? Description = null, string? State = null, string? District = null,
    string? Taluk = null, string? Village = null, string? Locality = null, string? Landmark = null,
    string? StreetAddress = null, string? SurveyNumber = null, double? Latitude = null, double? Longitude = null,
    LandUsageType? LandUsage = null, string? LandClassification = null, string? SellerRelationship = null,
    decimal? Area = null, AreaUnit? AreaUnit = null, decimal? AskingPriceTotal = null, bool Negotiable = false,
    string? PricingNotes = null, ListingFeatures? Features = null, Guid? RequestId = null, int? Version = null);

public record PropertyVersionRequest(int Version);
public record PropertySaleStatusRequest(int Version, ListingSaleStatus SaleStatus);
public record PropertyEnquiryStatusRequest(EnquiryStatus Status);
public record PropertyReportRequest(string? Reason);
public record PropertyMediaOrderRequest(int Version, Guid CoverId, IReadOnlyList<Guid>? PhotoIds);

public record PropertyMediaDto(Guid Id, ListingMediaKind Kind, string ContentType, bool IsCover, int SortOrder,
    string Url, DateTime CreatedAtUtc);

public record PropertyPage<T>(IReadOnlyList<T> Items, int Page, int PageSize, bool HasMore);

public record PropertyListingDto(
    Guid Id, string Title, string Description, string State, string District, string Locality, string? Taluk,
    string? Village, double? Latitude, double? Longitude, LandUsageType? LandUsage, string? LandClassification,
    decimal? Area, AreaUnit? AreaUnit, decimal ExtentCent, decimal ExtentSqFt,
    decimal AskingPriceTotal, decimal AskingRatePerCent, decimal AskingRatePerSqFt, decimal AskingRatePerAcre,
    bool Negotiable, SourceCategory PriceCategory, ListingFeatures Features, ListingSaleStatus SaleStatus,
    string SellerName, SellerType SellerType, bool SellerApproved, DateTime? PublishedAtUtc,
    DateTime CreatedAtUtc, DateTime UpdatedAtUtc, IReadOnlyList<PropertyMediaDto> Photos);
