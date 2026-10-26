using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Domain.Entities;

/// <summary>
/// Domain entity representing an evidentiary historical land price estimate for a target year and locality.
/// Market-derived rates represent calculated median values, bounded by empirical minimum and maximum ranges.
/// When status is InsufficientData, all market rate fields must be null (never 0.00).
/// </summary>
public class HistoricalEstimate
{
    public Guid Id { get; private set; }
    public string Country { get; private set; } = "India";
    public string State { get; private set; } = "Tamil Nadu";
    public string District { get; private set; } = string.Empty;
    public string? Taluk { get; private set; }
    public string Locality { get; private set; } = string.Empty;
    public int TargetYear { get; private set; }
    public LandUsageType LandUsage { get; private set; }
    public GeoCoordinate Coordinates { get; private set; }

    // --- Market Rate Estimations (Median, Min, Max) ---
    // EstimatedRatePerCent and EstimatedRatePerSqFt represent the central / median market estimate.
    // When Status == InsufficientData, these fields MUST be null.
    public decimal? EstimatedRatePerCent { get; private set; }
    public decimal? EstimatedRatePerSqFt { get; private set; }

    // Semantic read-only aliases for explicit clarity in valuation workflows
    public decimal? MedianRatePerCent => EstimatedRatePerCent;
    public decimal? MedianRatePerSqFt => EstimatedRatePerSqFt;

    public decimal? MinRatePerCent { get; private set; }
    public decimal? MinRatePerSqFt { get; private set; }
    public decimal? MaxRatePerCent { get; private set; }
    public decimal? MaxRatePerSqFt { get; private set; }

    // --- Separate Government Guideline Benchmark Rates ---
    // Official guideline value for the target year / locality, distinct from market rates
    public decimal? GuidelineRatePerCent { get; private set; }
    public decimal? GuidelineRatePerSqFt { get; private set; }

    // --- Evidence Metrics & Status ---
    public ConfidenceLevel ConfidenceLevel { get; private set; }
    public HistoricalEstimateStatus Status { get; private set; }
    public HistoricalReviewStatus ReviewStatus { get; private set; }
    public int SampleCount { get; private set; }
    public int VerifiedSampleCount { get; private set; }

    // --- Provenance & Limitations ---
    public string Methodology { get; private set; } = string.Empty;
    public string AlgorithmVersion { get; private set; } = string.Empty;
    public string? Limitations { get; private set; }
    public DateTime CalculatedAtUtc { get; private set; }
    public string? ReviewedBy { get; private set; }
    public DateTime? ReviewedAtUtc { get; private set; }

    // Readonly geographic helpers
    public double Latitude => Coordinates.Latitude;
    public double Longitude => Coordinates.Longitude;

    // Traceability links to empirical ground-truth observations
    public ICollection<HistoricalEstimateObservation> SupportingObservations { get; private set; } = new List<HistoricalEstimateObservation>();

    // EF Core constructor
    private HistoricalEstimate() { }

    public HistoricalEstimate(
        Guid id,
        string country,
        string state,
        string district,
        string? taluk,
        string locality,
        int targetYear,
        LandUsageType landUsage,
        GeoCoordinate coordinates,
        HistoricalEstimateStatus status,
        ConfidenceLevel confidenceLevel,
        HistoricalReviewStatus reviewStatus,
        decimal? estimatedRatePerCent,
        decimal? estimatedRatePerSqFt,
        decimal? minRatePerCent = null,
        decimal? minRatePerSqFt = null,
        decimal? maxRatePerCent = null,
        decimal? maxRatePerSqFt = null,
        decimal? guidelineRatePerCent = null,
        decimal? guidelineRatePerSqFt = null,
        int sampleCount = 0,
        int verifiedSampleCount = 0,
        string methodology = "SpatialKnnTemporalWeighting_v1",
        string algorithmVersion = "v1.0",
        string? limitations = null,
        string? reviewedBy = null,
        DateTime? reviewedAtUtc = null)
    {
        if (string.IsNullOrWhiteSpace(country)) throw new ArgumentException("Country is required.", nameof(country));
        if (string.IsNullOrWhiteSpace(state)) throw new ArgumentException("State is required.", nameof(state));
        if (string.IsNullOrWhiteSpace(district)) throw new ArgumentException("District is required.", nameof(district));
        if (string.IsNullOrWhiteSpace(locality)) throw new ArgumentException("Locality is required.", nameof(locality));
        if (targetYear < 1950 || targetYear > 2100) throw new ArgumentOutOfRangeException(nameof(targetYear), "TargetYear is out of valid historical range.");
        if (sampleCount < 0) throw new ArgumentOutOfRangeException(nameof(sampleCount), "SampleCount cannot be negative.");
        if (verifiedSampleCount < 0) throw new ArgumentOutOfRangeException(nameof(verifiedSampleCount), "VerifiedSampleCount cannot be negative.");
        if (verifiedSampleCount > sampleCount) throw new ArgumentException("VerifiedSampleCount cannot exceed total SampleCount.", nameof(verifiedSampleCount));

        // --- Domain Invariant: InsufficientData Handling ---
        if (status == HistoricalEstimateStatus.InsufficientData)
        {
            if (estimatedRatePerCent.HasValue || estimatedRatePerSqFt.HasValue ||
                minRatePerCent.HasValue || minRatePerSqFt.HasValue ||
                maxRatePerCent.HasValue || maxRatePerSqFt.HasValue)
            {
                throw new InvalidOperationException(
                    "An InsufficientData estimate must not represent unavailable prices as 0.00 or any numeric value. All market rate fields must be null.");
            }

            if (confidenceLevel != ConfidenceLevel.Insufficient)
            {
                throw new ArgumentException(
                    "An InsufficientData estimate must have ConfidenceLevel.Insufficient.", nameof(confidenceLevel));
            }
        }
        else // status == HistoricalEstimateStatus.Success
        {
            if (!estimatedRatePerCent.HasValue || estimatedRatePerCent.Value <= 0)
            {
                throw new ArgumentException("A successful estimate must have a strictly positive EstimatedRatePerCent.", nameof(estimatedRatePerCent));
            }
            if (!estimatedRatePerSqFt.HasValue || estimatedRatePerSqFt.Value <= 0)
            {
                throw new ArgumentException("A successful estimate must have a strictly positive EstimatedRatePerSqFt.", nameof(estimatedRatePerSqFt));
            }
            if (confidenceLevel == ConfidenceLevel.Insufficient)
            {
                throw new ArgumentException("A successful estimate cannot have ConfidenceLevel.Insufficient.", nameof(confidenceLevel));
            }

            // Validate cent bounds if provided
            if (minRatePerCent.HasValue && minRatePerCent.Value <= 0)
                throw new ArgumentOutOfRangeException(nameof(minRatePerCent), "MinRatePerCent must be strictly positive.");
            if (maxRatePerCent.HasValue && maxRatePerCent.Value <= 0)
                throw new ArgumentOutOfRangeException(nameof(maxRatePerCent), "MaxRatePerCent must be strictly positive.");
            if (minRatePerCent.HasValue && maxRatePerCent.HasValue && minRatePerCent.Value > maxRatePerCent.Value)
                throw new ArgumentException("MinRatePerCent cannot exceed MaxRatePerCent.", nameof(minRatePerCent));

            // Validate sq.ft bounds if provided
            if (minRatePerSqFt.HasValue && minRatePerSqFt.Value <= 0)
                throw new ArgumentOutOfRangeException(nameof(minRatePerSqFt), "MinRatePerSqFt must be strictly positive.");
            if (maxRatePerSqFt.HasValue && maxRatePerSqFt.Value <= 0)
                throw new ArgumentOutOfRangeException(nameof(maxRatePerSqFt), "MaxRatePerSqFt must be strictly positive.");
            if (minRatePerSqFt.HasValue && maxRatePerSqFt.HasValue && minRatePerSqFt.Value > maxRatePerSqFt.Value)
                throw new ArgumentException("MinRatePerSqFt cannot exceed MaxRatePerSqFt.", nameof(minRatePerSqFt));
        }

        // Validate guideline benchmark fields if provided
        if (guidelineRatePerCent.HasValue && guidelineRatePerCent.Value <= 0)
            throw new ArgumentOutOfRangeException(nameof(guidelineRatePerCent), "GuidelineRatePerCent must be strictly positive.");
        if (guidelineRatePerSqFt.HasValue && guidelineRatePerSqFt.Value <= 0)
            throw new ArgumentOutOfRangeException(nameof(guidelineRatePerSqFt), "GuidelineRatePerSqFt must be strictly positive.");

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        Country = country.Trim();
        State = state.Trim();
        District = TamilNaduGeoBounds.NormalizeDistrict(district);
        Taluk = taluk?.Trim();
        Locality = locality.Trim();
        TargetYear = targetYear;
        LandUsage = landUsage;
        Coordinates = coordinates;
        Status = status;
        ConfidenceLevel = confidenceLevel;
        ReviewStatus = reviewStatus;

        EstimatedRatePerCent = estimatedRatePerCent.HasValue ? Math.Round(estimatedRatePerCent.Value, 2) : null;
        EstimatedRatePerSqFt = estimatedRatePerSqFt.HasValue ? Math.Round(estimatedRatePerSqFt.Value, 2) : null;
        MinRatePerCent = minRatePerCent.HasValue ? Math.Round(minRatePerCent.Value, 2) : null;
        MinRatePerSqFt = minRatePerSqFt.HasValue ? Math.Round(minRatePerSqFt.Value, 2) : null;
        MaxRatePerCent = maxRatePerCent.HasValue ? Math.Round(maxRatePerCent.Value, 2) : null;
        MaxRatePerSqFt = maxRatePerSqFt.HasValue ? Math.Round(maxRatePerSqFt.Value, 2) : null;
        GuidelineRatePerCent = guidelineRatePerCent.HasValue ? Math.Round(guidelineRatePerCent.Value, 2) : null;
        GuidelineRatePerSqFt = guidelineRatePerSqFt.HasValue ? Math.Round(guidelineRatePerSqFt.Value, 2) : null;

        SampleCount = sampleCount;
        VerifiedSampleCount = verifiedSampleCount;
        Methodology = string.IsNullOrWhiteSpace(methodology) ? "SpatialKnnTemporalWeighting_v1" : methodology.Trim();
        AlgorithmVersion = string.IsNullOrWhiteSpace(algorithmVersion) ? "v1.0" : algorithmVersion.Trim();
        Limitations = limitations?.Trim();
        CalculatedAtUtc = DateTime.UtcNow;
        ReviewedBy = reviewedBy?.Trim();
        ReviewedAtUtc = reviewedAtUtc;
    }

    public void Approve(string reviewer, string? auditNote = null)
    {
        ReviewStatus = HistoricalReviewStatus.Approved;
        ReviewedBy = string.IsNullOrWhiteSpace(reviewer) ? "Administrator" : reviewer.Trim();
        ReviewedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(auditNote))
        {
            Limitations = string.IsNullOrWhiteSpace(Limitations) ? $"Approval Note: {auditNote}" : $"{Limitations} | Approval Note: {auditNote}";
        }
    }

    public void Flag(string reviewer, string reason)
    {
        ReviewStatus = HistoricalReviewStatus.Flagged;
        ReviewedBy = string.IsNullOrWhiteSpace(reviewer) ? "Administrator" : reviewer.Trim();
        ReviewedAtUtc = DateTime.UtcNow;
        Limitations = string.IsNullOrWhiteSpace(Limitations) ? $"Flagged: {reason}" : $"{Limitations} | Flagged: {reason}";
    }
}
