using Greenart.Domain.Enums;
namespace Greenart.Application.DTOs;

public record LandResearchInput(Guid ResearchId, double Latitude, double Longitude, string Locality, string District,
    string Taluk, LandUsageType LandUsage, decimal Area, string AreaUnit, int RadiusMeters, string RoadAccess, string Context, AuthorizedMarketSourceInput[]? AuthorizedSources = null);
public class MarketEvidenceCandidate
{
    public string SourceName { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public string SourceCategory { get; set; } = "";
    public string Currency { get; set; } = "";
    public string LocationDescription { get; set; } = "";
    public int LandCategory { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public decimal Area { get; set; }
    public string AreaUnit { get; set; } = "";
    public decimal AskingPrice { get; set; }
    public DateTime? ObservationDate { get; set; }
    public string AskingContextQuote { get; set; } = "";
    public string PriceQuote { get; set; } = "";
    public string AreaQuote { get; set; } = "";
    public string DateQuote { get; set; } = "";
    public string LocationQuote { get; set; } = "";
    public string CategoryQuote { get; set; } = "";
    public string CoordinateQuote { get; set; } = "";
}
public class MarketEvidenceAssessment
{
    public string Id { get; set; } = "";
    public MarketEvidenceCandidate Observation { get; set; } = new();
    public string ResolvedUrl { get; set; } = "";
    public string RetrievalStatus { get; set; } = "NotRetrieved";
    public DateTime RetrievedAtUtc { get; set; }
    public decimal? AreaSqFt { get; set; }
    public decimal? RatePerCent { get; set; }
    public decimal? RatePerSqFt { get; set; }
    public double? DistanceMeters { get; set; }
    public string Status { get; set; } = "Rejected";
    public List<string> Checks { get; set; } = [];
}
public class GroundedMarketAssessment
{
    public Guid ResearchId { get; set; }
    public string Location { get; set; } = "";
    public string District { get; set; } = "";
    public string Taluk { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int LandCategory { get; set; }
    public decimal RequestedArea { get; set; }
    public string RequestedAreaUnit { get; set; } = "";
    public int RadiusMeters { get; set; }
    public string ModelVersion { get; set; } = "";
    public decimal? CandidateLowPerCent { get; set; }
    public decimal? CandidateTypicalPerCent { get; set; }
    public decimal? CandidateHighPerCent { get; set; }
    public string Status { get; set; } = "InsufficientEvidence";
    public string SourceCategory { get; set; } = "AIResearchEstimate";
    public string GroundingStatus { get; set; } = "Unavailable";
    public string ModelName { get; set; } = "";
    public string PromptVersion { get; set; } = "land-research-v1";
    public DateTime ResearchTimestampUtc { get; set; } = DateTime.UtcNow;
    public decimal? LowPerCent { get; set; }
    public decimal? TypicalPerCent { get; set; }
    public decimal? HighPerCent { get; set; }
    public decimal? TypicalPerSqFt { get; set; }
    public int SourceCount { get; set; }
    public List<MarketEvidenceAssessment> Evidence { get; set; } = [];
    public List<string> Assumptions { get; set; } = [];
    public List<string> Limitations { get; set; } = [];
    public string[] SearchQueries { get; set; } = [];
    public string SearchAttributionHtml { get; set; } = "";
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public int TotalTokens { get; set; }
    public int AttemptedCalls { get; set; }
}
public class MarketEvidenceReview
{
    public Guid ReviewId { get; set; } = Guid.NewGuid();
    public Guid ResearchId { get; set; }
    public string Status { get; set; } = "InsufficientEvidence";
    public string EvidenceQuality { get; set; } = "Insufficient";
    public string[] AcceptedEvidenceIds { get; set; } = [];
    public string[] RejectedEvidenceIds { get; set; } = [];
    public string[] CalculationErrors { get; set; } = [];
    public bool LocationMismatch { get; set; }
    public bool CategoryMismatch { get; set; }
    public string[] Contradictions { get; set; } = [];
    public string[] RecommendedCorrections { get; set; } = [];
    public string ReviewerModel { get; set; } = "";
    public string PromptVersion { get; set; } = "land-evidence-review-v1";
    public DateTime ReviewedAtUtc { get; set; } = DateTime.UtcNow;
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public int TotalTokens { get; set; }
    public int AttemptedCalls { get; set; }
}
public record GroundedResearchOutcome(GroundedMarketAssessment Research, MarketEvidenceReview Review);
public record RetrievedMarketSource(string Status, string Url, string Text, DateTime RetrievedAtUtc);
public record DetailedBrokerReviewRequest(Guid Version, string BrokerName, string Evidence, int ObservationCount,
    decimal LowPerCent, decimal HighPerCent, DateTime ObservedAtUtc, decimal? TypicalPerCent = null,
    string? BrokerId = null, string? ContactReference = null, string? BrokerLocality = null,
    string? EvidenceType = null, string? Familiarity = null, string? DocumentReference = null, LandUsageType? LandCategory = null);

public record AuthorizedMarketSourceInput(string Name, string Url, string RightsReference,
    bool RetrievalAndStorageAuthorized, bool PublicDisplayAuthorized, Guid? RegisteredForResearchId = null, string? RegisteredBy = null, DateTime? RegisteredAtUtc = null);
public record AuthorizedMarketSourcesRequest(Guid Version, AuthorizedMarketSourceInput[] Sources);
