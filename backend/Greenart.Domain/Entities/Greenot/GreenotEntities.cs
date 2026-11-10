using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities.Greenot;

[Table("greenot_properties")]
public class GreenotProperty
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Address { get; set; } = string.Empty;
    public string Category { get; set; } = "residential_land";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public decimal? ExtentValue { get; set; }
    public string ExtentUnit { get; set; } = "cent";
    public decimal? ExtentSqFt { get; set; }
    public string? SurveyNumber { get; set; }
    public string? Subdivision { get; set; }
    public decimal? RoadWidthFt { get; set; }
    public decimal? FrontageFt { get; set; }
    public string? ApprovalStatus { get; set; }
    public string? OwnerAttributesJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("greenot_comparable_properties")]
public class GreenotComparableProperty
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Category { get; set; } = "residential_land";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public decimal AreaSqFt { get; set; }
    public decimal? OriginalArea { get; set; }
    public string OriginalUnit { get; set; } = "sqft";
    public string? DimensionsFt { get; set; }
    public decimal? RoadWidthFt { get; set; }
    public decimal? FrontageFt { get; set; }
    public string? ApprovalStatus { get; set; }
    public string? Locality { get; set; }
    public string? District { get; set; }
    public string? SurveyNumber { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("greenot_evidence_sources")]
public class GreenotEvidenceSource
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty; // government_registry, portal_listing, broker_quote
    public string? UrlOrDocId { get; set; }
    public string? TermsAccessNotes { get; set; }
    public string ReliabilityClass { get; set; } = "portal_asking"; // authoritative, verified_institution, portal_asking
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("greenot_property_evidence")]
public class GreenotPropertyEvidence
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? PropertyId { get; set; }
    public Guid? ComparableId { get; set; }
    public Guid? SourceId { get; set; }
    public string EvidenceKind { get; set; } = "asking_listing"; // registered_transaction, asking_listing, guideline_benchmark
    public DateTime EvidenceDate { get; set; }
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
    public decimal TotalPriceInr { get; set; }
    public decimal LandAreaSqFt { get; set; }
    public decimal? OriginalPrice { get; set; }
    public decimal? OriginalArea { get; set; }
    public string OriginalUnit { get; set; } = "sqft";
    public decimal RatePerSqFt { get; set; }
    public decimal RatePerCent { get; set; }
    public decimal RatePerGround { get; set; }
    public decimal RatePerAcre { get; set; }
    public decimal? AdvertisedRatePerSqFt { get; set; }
    public string VerificationStatus { get; set; } = "unverified"; // unverified, pending_review, verified, quarantined
    public string ArithmeticStatus { get; set; } = "valid"; // valid, mismatch_flagged
    public decimal ArithmeticDiscrepancyPct { get; set; } = 0.00m;
    public string? ReviewerNotes { get; set; }
    public string? RawPayloadJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("greenot_guideline_values")]
public class GreenotGuidelineValue
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public string District { get; set; } = string.Empty;
    public string Village { get; set; } = string.Empty;
    public string StreetOrSurvey { get; set; } = string.Empty;
    public string? Zone { get; set; }
    public decimal ValueInr { get; set; }
    public string Unit { get; set; } = "sqft";
    public decimal RatePerSqFt { get; set; }
    public decimal RatePerCent { get; set; }
    public decimal RatePerGround { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string? OfficialReference { get; set; }
    public string Status { get; set; } = "verified";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("greenot_historical_rates")]
public class GreenotHistoricalRate
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Locality { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public int Year { get; set; }
    public string Category { get; set; } = "residential_land";
    public string SeriesType { get; set; } = "observed_transaction"; // observed_transaction, observed_listing, statutory_guideline, modelled_market
    public decimal RatePerSqFt { get; set; }
    public decimal RatePerCent { get; set; }
    public decimal RatePerGround { get; set; }
    public decimal RatePerAcre { get; set; }
    public int EvidenceCount { get; set; }
    public decimal? ConfidenceScore { get; set; }
    public string MethodVersion { get; set; } = "1.0";
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("greenot_valuation_runs")]
public class GreenotValuationRun
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? PropertyId { get; set; }
    public DateTime RunTimestamp { get; set; } = DateTime.UtcNow;
    public string MethodVersion { get; set; } = "1.0";
    public string InputsSnapshotJson { get; set; } = "{}";
    public int SearchRadiusMeters { get; set; } = 1000;
    public int EligibleComparableCount { get; set; }
    public decimal? RateSqFtLow { get; set; }
    public decimal? RateSqFtMedian { get; set; }
    public decimal? RateSqFtHigh { get; set; }
    public decimal? RateGroundMedian { get; set; }
    public decimal? RateCentMedian { get; set; }
    public decimal? RateAcreMedian { get; set; }
    public decimal? ConfidenceScore { get; set; }
    public string ConfidenceLabel { get; set; } = "insufficient";
    public string Basis { get; set; } = "insufficient_evidence"; // registered_transactions, asking_listings_only, insufficient_evidence
    public string Status { get; set; } = "ok";
    public string? HardGateReasonsJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("greenot_building_valuations")]
public class GreenotBuildingValuation
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ValuationRunId { get; set; }
    public decimal BuiltUpAreaSqFt { get; set; }
    public string ConstructionType { get; set; } = "RCC_Framed";
    public int AgeYears { get; set; }
    public string Condition { get; set; } = "average";
    public decimal ReplacementCostPerSqFt { get; set; }
    public decimal GrossReplacementCost { get; set; }
    public string DepreciationMethod { get; set; } = "straight_line";
    public decimal DepreciationPct { get; set; }
    public decimal DepreciatedBuildingValue { get; set; }
    public decimal RepairOrDemolitionCost { get; set; } = 0.00m;
    public bool IsDemolitionIntended { get; set; } = false;
    public decimal NetBuildingValue { get; set; }
    public decimal TotalPropertyValue { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
