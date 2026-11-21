using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Domain.Entities;

public record ListingFeatures(
    string? RoadAccess = null, decimal? RoadWidthFeet = null, decimal? RoadFrontageFeet = null,
    bool? WaterAvailable = null, bool? ElectricityAvailable = null, bool? Fenced = null,
    string? PlotDimensions = null, string? ApprovalDetails = null);

public record ListingRevision(
    string Title, string Description, string State, string District, string Locality, string? Taluk,
    string? Village, string? Landmark, string? StreetAddress, string? SurveyNumber,
    GeoCoordinate? Coordinates, LandUsageType? LandUsage, string? LandClassification,
    string? SellerRelationship, LandArea? Area, decimal? AskingPrice,
    bool Negotiable, string? PricingNotes, ListingFeatures Features, string? ParcelFingerprint);
