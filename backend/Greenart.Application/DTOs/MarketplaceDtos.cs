using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record CreateListingRequestDto(
    string Title,
    string Description,
    string Locality,
    string District,
    string? State,
    string? Taluk,
    string? StreetAddress,
    string? SurveyNumber,
    double Latitude,
    double Longitude,
    LandUsageType LandUsage,
    decimal ExtentCent,
    decimal AskingPriceTotal);

public record UpdateListingRequestDto(
    string Title,
    string Description,
    string? Taluk,
    string? StreetAddress,
    string? SurveyNumber,
    decimal AskingPriceTotal);

public record MarketplaceListingDto(
    Guid Id,
    string Title,
    string Description,
    Guid SellerId,
    string SellerName,
    string? SellerPhone,
    bool IsSellerVerified,
    string Locality,
    string District,
    string State,
    string? Taluk,
    string? StreetAddress,
    string? SurveyNumber,
    double Latitude,
    double Longitude,
    LandUsageType LandUsage,
    decimal ExtentCent,
    decimal ExtentSqFt,
    decimal AskingPriceTotal,
    decimal AskingRatePerCent,
    decimal AskingRatePerSqFt,
    decimal? GuidelineRatePerCent,
    decimal? GuidelineRatePerSqFt,
    decimal? EstimatedMarketMedianPerCent,
    ListingStatus Status,
    string? RejectionReason,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public record SubmitEnquiryRequestDto(
    string Message,
    decimal? OfferedPriceTotal = null);

public record ListingEnquiryDto(
    Guid Id,
    Guid ListingId,
    string ListingTitle,
    Guid BuyerUserId,
    string BuyerName,
    string BuyerEmail,
    string? BuyerPhone,
    decimal? OfferedPriceTotal,
    string Message,
    EnquiryStatus Status,
    DateTime SubmittedAtUtc);

public record ReviewListingRequestDto(
    string Action, // "Approve" or "Reject"
    string? Reason = null,
    string? Notes = null);

