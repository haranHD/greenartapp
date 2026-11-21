using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.ValueObjects;

namespace Greenart.Api.Marketplace;

internal static class PropertyValidation
{
    private const decimal MaxPrice = 100_000_000_000m;
    private const decimal MaxArea = 1_000_000m;

    public static bool ValidPoint(double latitude, double longitude) =>
        double.IsFinite(latitude) && double.IsFinite(longitude) &&
        latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180 &&
        (latitude != 0 || longitude != 0);

    public static bool ValidPrice(decimal price) => price is >= 0.01m and <= MaxPrice;

    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static double PublicCoordinate(double value) =>
        (double)Math.Round((decimal)value, 2, MidpointRounding.AwayFromZero);

    public static ListingRevision? Read(PropertyDraftRequest input)
    {
        var title = Clean(input.Title);
        var description = Clean(input.Description);
        var state = Clean(input.State);
        var district = Clean(input.District);
        var locality = Clean(input.Locality);
        var taluk = Clean(input.Taluk);
        var village = Clean(input.Village);
        var landmark = Clean(input.Landmark);
        var address = Clean(input.StreetAddress);
        var survey = Clean(input.SurveyNumber);
        var classification = Clean(input.LandClassification);
        var relationship = Clean(input.SellerRelationship);
        var pricingNotes = Clean(input.PricingNotes);
        var features = input.Features ?? new ListingFeatures();
        features = features with
        {
            RoadAccess = Clean(features.RoadAccess),
            PlotDimensions = Clean(features.PlotDimensions),
            ApprovalDetails = Clean(features.ApprovalDetails)
        };

        if (title?.Length > 250 || description?.Length > 10_000 || state?.Length > 100 ||
            district?.Length > 100 || locality?.Length > 150 || taluk?.Length > 100 ||
            village?.Length > 150 || landmark?.Length > 200 || address?.Length > 250 ||
            survey?.Length > 100 || classification?.Length > 100 || relationship?.Length > 100 ||
            pricingNotes?.Length > 1000 || features.RoadAccess?.Length > 100 ||
            features.PlotDimensions?.Length > 120 || features.ApprovalDetails?.Length > 500 ||
            features.RoadWidthFeet is <= 0 or > 100_000 || features.RoadFrontageFeet is <= 0 or > 100_000 ||
            input.LandUsage is { } usage && !Enum.IsDefined(usage) ||
            input.AskingPriceTotal is { } price && !ValidPrice(price) ||
            input.RequestId == Guid.Empty)
            return null;

        GeoCoordinate? coordinates = null;
        if (input.Latitude.HasValue || input.Longitude.HasValue)
        {
            if (input.Latitude is not { } latitude || input.Longitude is not { } longitude ||
                !ValidPoint(latitude, longitude))
                return null;
            coordinates = new GeoCoordinate(latitude, longitude);
        }

        LandArea? area = null;
        if (input.Area.HasValue || input.AreaUnit.HasValue)
        {
            if (input.Area is not { } value || input.AreaUnit is not { } unit ||
                !Enum.IsDefined(unit) || value is < 0.0001m or > MaxArea)
                return null;
            area = new LandArea(value, unit);
            if (area.Value.ToCents() < 0.0001m || area.Value.ToSqFt() < 0.01m)
                return null;
        }

        var fingerprint = Fingerprint(district, village ?? locality, survey, coordinates, area);
        var askingPrice = input.AskingPriceTotal is { } asking ? Math.Round(asking, 2) : (decimal?)null;
        return new ListingRevision(title ?? "", description ?? "", state ?? "Tamil Nadu", district ?? "",
            locality ?? "", taluk, village, landmark, address, survey, coordinates, input.LandUsage,
            classification, relationship, area, askingPrice,
            input.Negotiable, pricingNotes, features, fingerprint);
    }

    private static string? Fingerprint(string? district, string? locality, string? survey,
        GeoCoordinate? coordinates, LandArea? area)
    {
        if (district is null || locality is null || coordinates is not { } point || area is not { } landArea)
            return null;

        // Survey identifiers are scoped to locality. The fallback matches essentially identical plot pins and areas.
        var identifier = survey ?? string.Create(CultureInfo.InvariantCulture,
            $"{point.Latitude:F5},{point.Longitude:F5},{landArea.ToSqFt():F2}");
        var parcel = string.Join('\u001f', district, locality, identifier).ToUpperInvariant();
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(parcel)));
    }
}
