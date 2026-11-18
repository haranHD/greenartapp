using Greenart.Domain.Enums;
namespace Greenart.Application.DTOs;

public record CreatePriceResearchRequest(string Locality, string District, double Latitude, double Longitude,
    LandUsageType LandUsage, int CoverageRadiusMeters, string RoadAccess, string? Context, string? Taluk = null, decimal? Area = null, string? AreaUnit = null);
public record ResearchVersionRequest(Guid Version);
public record BrokerPriceReviewRequest(Guid Version, string BrokerName, string Evidence, int ObservationCount,
    decimal LowPerCent, decimal HighPerCent, DateTime ObservedAtUtc);
public record PriceApprovalRequest(Guid Version, string Action, decimal LowPerCent, decimal HighPerCent,
    DateTime ValidUntilUtc, string Notes);
public record ModelPriceProposal(string Provider, string Model, string Status, decimal? LowPerCent,
    decimal? HighPerCent, string Reasoning, string[] Sources, DateTime GeneratedAtUtc);
public record ResearchProviderStatus(string Provider, bool Configured);
public record BrokerPriceRangeDto(Guid ResearchId, string Locality, string District, string LandUsage,
    string RoadAccess, int CoverageRadiusMeters, decimal LowPerCent, decimal HighPerCent,
    decimal LowPerSqFt, decimal HighPerSqFt, int ObservationCount, DateTime ReviewedAtUtc,
    DateTime ValidUntilUtc, string Label = "Broker-reviewed market estimate",
    string Notice = "Indicative range checked with a local broker and approved for publication. Not a registered-sale valuation or a guaranteed transaction price.");

public record MarketPriceRangeDto(Guid ResearchId, string Locality, string District, string LandUsage,
    string RoadAccess, int CoverageRadiusMeters, decimal LowPerCent, decimal HighPerCent,
    decimal LowPerSqFt, decimal HighPerSqFt, string Basis, int ObservationCount,
    DateTime? ReviewedAtUtc, DateTime? GeneratedAtUtc, DateTime ValidUntilUtc,
    string[] Providers, string Label, string Notice, int SourceCount = 0, string? EvidenceUrl = null,
    string ReviewStatus = "NotReviewed", string GroundingStatus = "Unavailable", decimal? TypicalPerCent = null);

public record MobilePriceResearchRequest(Guid RequestId, string Locality, string District, double Latitude,
    double Longitude, LandUsageType LandUsage, string RoadAccess, decimal? Area = null, string? AreaUnit = null, string? Taluk = null);
