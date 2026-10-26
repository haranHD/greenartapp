namespace Greenart.Domain.Entities;

/// <summary>
/// Normalized junction entity establishing traceability between a computed historical estimate
/// and the empirical ground-truth land price observations that contributed to its calculation.
/// </summary>
public class HistoricalEstimateObservation
{
    public Guid EstimateId { get; private set; }
    public HistoricalEstimate HistoricalEstimate { get; private set; } = null!;

    public Guid ObservationId { get; private set; }
    public LandPriceRecord Observation { get; private set; } = null!;

    public double ContributionWeight { get; private set; }
    public bool IsOutlier { get; private set; }
    public double DistanceMeters { get; private set; }
    public int TemporalOffsetMonths { get; private set; }

    // EF Core constructor
    private HistoricalEstimateObservation() { }

    public HistoricalEstimateObservation(
        Guid estimateId,
        Guid observationId,
        double contributionWeight,
        bool isOutlier,
        double distanceMeters,
        int temporalOffsetMonths)
    {
        if (estimateId == Guid.Empty) throw new ArgumentException("EstimateId is required.", nameof(estimateId));
        if (observationId == Guid.Empty) throw new ArgumentException("ObservationId is required.", nameof(observationId));
        if (contributionWeight < 0.0 || contributionWeight > 1.0)
            throw new ArgumentOutOfRangeException(nameof(contributionWeight), "ContributionWeight must be between 0.0 and 1.0.");

        EstimateId = estimateId;
        ObservationId = observationId;
        ContributionWeight = Math.Round(contributionWeight, 4);
        IsOutlier = isOutlier;
        DistanceMeters = Math.Max(0.0, Math.Round(distanceMeters, 2));
        TemporalOffsetMonths = temporalOffsetMonths;
    }
}

