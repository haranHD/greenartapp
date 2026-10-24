using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Domain.Entities;

public class LandPriceRecord
{
    public Guid Id { get; private set; }
    public string Country { get; private set; } = "India";
    public string State { get; private set; } = "Tamil Nadu";
    public string District { get; private set; } = string.Empty;
    public string? Taluk { get; private set; }
    public string Locality { get; private set; } = string.Empty;
    public string? StreetOrLandmark { get; private set; }
    public string? SurveyNumber { get; private set; }
    public GeoCoordinate Coordinates { get; private set; }
    public LandUsageType LandUsage { get; private set; }
    public LandArea Area { get; private set; }
    public decimal OriginalPrice { get; private set; }
    public decimal NormalizedRatePerCent { get; private set; }
    public decimal NormalizedRatePerSqFt { get; private set; }
    public SourceCategory SourceCategory { get; private set; }
    public string? SourceReference { get; private set; }
    public DateTime ObservationDate { get; private set; }
    public DateTime RetrievalDate { get; private set; }
    public VerificationStatus VerificationStatus { get; private set; }
    public bool IsSynthetic { get; private set; }
    public string? Notes { get; private set; }

    // Navigation / compatibility properties for flat access
    public double Latitude => Coordinates.Latitude;
    public double Longitude => Coordinates.Longitude;
    public decimal OriginalArea => Area.Value;
    public AreaUnit OriginalUnit => Area.Unit;

    // EF Core constructor
    private LandPriceRecord() { }

    public LandPriceRecord(
        Guid id,
        string country,
        string state,
        string district,
        string? taluk,
        string locality,
        string? streetOrLandmark,
        string? surveyNumber,
        GeoCoordinate coordinates,
        LandUsageType landUsage,
        LandArea area,
        decimal originalPrice,
        SourceCategory sourceCategory,
        string? sourceReference,
        DateTime observationDate,
        VerificationStatus verificationStatus = VerificationStatus.Unverified,
        bool isSynthetic = false,
        string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(country)) throw new ArgumentException("Country is required.", nameof(country));
        if (string.IsNullOrWhiteSpace(state)) throw new ArgumentException("State is required.", nameof(state));
        if (string.IsNullOrWhiteSpace(district)) throw new ArgumentException("District is required.", nameof(district));
        if (string.IsNullOrWhiteSpace(locality)) throw new ArgumentException("Locality is required.", nameof(locality));
        if (originalPrice <= 0) throw new ArgumentOutOfRangeException(nameof(originalPrice), "Price must be strictly positive.");

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        Country = country.Trim();
        State = state.Trim();
        District = TamilNaduGeoBounds.NormalizeDistrict(district);
        Taluk = taluk?.Trim();
        Locality = locality.Trim();
        StreetOrLandmark = streetOrLandmark?.Trim();
        SurveyNumber = surveyNumber?.Trim();
        Coordinates = coordinates;
        LandUsage = landUsage;
        Area = area;
        OriginalPrice = originalPrice;
        SourceCategory = sourceCategory;
        SourceReference = sourceReference?.Trim();
        ObservationDate = observationDate;
        RetrievalDate = DateTime.UtcNow;
        VerificationStatus = verificationStatus;
        IsSynthetic = isSynthetic;
        Notes = notes?.Trim();

        // Calculate normalized unit rates preserving precision
        var totalCents = area.ToCents();
        var totalSqFt = area.ToSqFt();

        NormalizedRatePerCent = Math.Round(originalPrice / totalCents, 2);
        NormalizedRatePerSqFt = Math.Round(originalPrice / totalSqFt, 2);
    }

    /// <summary>
    /// Checks if this record is comparable for current market estimation:
    /// - Not archived or rejected
    /// - Observed within the allowed maximum age horizon (default 36 months)
    /// </summary>
    public bool IsEligibleForMarketEstimation(DateTime asOfDate, int maxAgeMonths = 36)
    {
        if (VerificationStatus == VerificationStatus.Rejected || VerificationStatus == VerificationStatus.Archived)
        {
            return false;
        }

        var ageInMonths = ((asOfDate.Year - ObservationDate.Year) * 12) + asOfDate.Month - ObservationDate.Month;
        return ageInMonths <= maxAgeMonths && ageInMonths >= -1; // Allow up to 1 month clock skew
    }

    /// <summary>
    /// Computes distance in meters to target search coordinates.
    /// </summary>
    public double DistanceToMeters(GeoCoordinate target) => Coordinates.DistanceToMeters(target);

    public void MarkVerified(string? auditNote = null)
    {
        VerificationStatus = VerificationStatus.Verified;
        if (!string.IsNullOrWhiteSpace(auditNote))
        {
            Notes = string.IsNullOrWhiteSpace(Notes) ? auditNote : $"{Notes} | Verified: {auditNote}";
        }
    }

    public void MarkPendingReview(string? auditNote = null)
    {
        VerificationStatus = VerificationStatus.PendingReview;
        if (!string.IsNullOrWhiteSpace(auditNote))
        {
            Notes = string.IsNullOrWhiteSpace(Notes) ? $"PendingReview: {auditNote}" : $"{Notes} | PendingReview: {auditNote}";
        }
    }

    public void MarkRejected(string reason)
    {
        VerificationStatus = VerificationStatus.Rejected;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Rejected: {reason}" : $"{Notes} | Rejected: {reason}";
    }

    public void Archive(string reason)
    {
        VerificationStatus = VerificationStatus.Archived;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Archived: {reason}" : $"{Notes} | Archived: {reason}";
    }
}
