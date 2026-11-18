using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

/// <summary>One research exercise; model answers never count as independent sale observations.</summary>
public class PriceResearch
{
    public string PipelineVersion { get; private set; } = "Legacy";
    public Guid? RequestedByUserId { get; private set; }
    public string Taluk { get; private set; } = "";
    public decimal? InputArea { get; private set; }
    public string InputAreaUnit { get; private set; } = "";
    public decimal? AreaSqFt { get; private set; }
    public string AuthorizedSourcesJson { get; private set; } = "[]";
    public string ResearchResultJson { get; private set; } = "{}";
    public string ReviewResultJson { get; private set; } = "{}";
    public string ResearchStatus { get; private set; } = "NotStarted";
    public string AiReviewStatus { get; private set; } = "NotReviewed";
    public Guid? SupersedesResearchId { get; private set; }
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid Version { get; private set; } = Guid.NewGuid();
    public string Locality { get; private set; } = "";
    public string District { get; private set; } = "";
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    public LandUsageType LandUsage { get; private set; }
    public int CoverageRadiusMeters { get; private set; }
    public string RoadAccess { get; private set; } = "";
    public string Context { get; private set; } = "";
    public string Status { get; private set; } = "Draft";
    public DateTime? ResearchStartedAtUtc { get; private set; }
    public string ProposalsJson { get; private set; } = "[]";
    public string BrokerName { get; private set; } = "";
    public string BrokerEvidence { get; private set; } = "";
    public int ObservationCount { get; private set; }
    public decimal? BrokerLowPerCent { get; private set; }
    public decimal? BrokerHighPerCent { get; private set; }
    public decimal? LowPerCent { get; private set; }
    public decimal? HighPerCent { get; private set; }
    public DateTime? BrokerReviewedAtUtc { get; private set; }
    public DateTime? ApprovedAtUtc { get; private set; }
    public DateTime? ValidUntilUtc { get; private set; }
    public string ReviewNotes { get; private set; } = "";
    public string ReviewedBy { get; private set; } = "";
    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;
    private PriceResearch() { }

    public PriceResearch(string locality, string district, double latitude, double longitude,
        LandUsageType landUsage, int coverageRadiusMeters, string roadAccess, string context)
    {
        if (string.IsNullOrWhiteSpace(locality) || string.IsNullOrWhiteSpace(district) ||
            locality.Length > 150 || district.Length > 150 ||
            !double.IsFinite(latitude) || !double.IsFinite(longitude) ||
            latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98 ||
            !Enum.IsDefined(landUsage) || coverageRadiusMeters < 50 || coverageRadiusMeters > 1000 ||
            string.IsNullOrWhiteSpace(roadAccess) || roadAccess.Length > 150 || context.Length > 4000)
            throw new ArgumentException("Supply a locality, district, valid India coordinates, land type, road access and coverage of 50–1,000 metres.");
        Locality = locality.Trim(); District = district.Trim(); Latitude = latitude; Longitude = longitude;
        LandUsage = landUsage; CoverageRadiusMeters = coverageRadiusMeters;
        RoadAccess = roadAccess.Trim(); Context = context.Trim();
    }

    public void ConfigureGroundedRequest(Guid? userId, string taluk, decimal? area, string unit, decimal? areaSqFt, Guid? supersedes = null) {
        RequireStatus("Draft");
        if (ProposalsJson != "[]" || ResearchResultJson != "{}") throw new InvalidOperationException("Saved research inputs are immutable.");
        if ((taluk ?? "").Length > 150 || (unit ?? "").Length > 30 || area <= 0 || areaSqFt <= 0)
            throw new ArgumentException("Invalid taluk, area or unit.");
        PipelineVersion = "GroundedGeminiV1"; RequestedByUserId = userId; Taluk = (taluk ?? "").Trim();
        InputArea = area; InputAreaUnit = unit ?? ""; AreaSqFt = areaSqFt; SupersedesResearchId = supersedes;
    }
    public void SetAuthorizedSources(string sourcesJson) {
        RequireStatus("Draft");
        if (ResearchResultJson != "{}" || ProposalsJson != "[]") throw new InvalidOperationException("Original research inputs cannot be overwritten. Create a follow-up exercise.");
        if (string.IsNullOrWhiteSpace(sourcesJson) || sourcesJson.Length > 50000) throw new ArgumentException("Invalid authorized-source input.");
        AuthorizedSourcesJson = sourcesJson; Touch();
    }
    public void FinishGroundedResearch(string researchJson, string reviewJson, string proposalsJson, string researchStatus, string reviewStatus) {
        RequireStatus("Researching");
        if (ResearchResultJson != "{}") throw new InvalidOperationException("Original AI evidence cannot be overwritten.");
        ResearchResultJson = researchJson; ReviewResultJson = reviewJson;
        ResearchStatus = researchStatus; AiReviewStatus = reviewStatus;
        FinishResearch(proposalsJson);
    }
    public void RequestCorrection(string notes, string actor) {
        if (Status != "Draft" && Status != "BrokerReviewed" && Status != "InsufficientEvidence") throw new InvalidOperationException("This research cannot request correction.");
        RecordDecision("NeedsCorrection", notes, actor);
    }
    public void MarkInsufficient(string notes, string actor) {
        if (Status != "Draft" && Status != "NeedsCorrection") throw new InvalidOperationException("This research cannot be marked insufficient.");
        RecordDecision("InsufficientEvidence", notes, actor);
    }
    public void StartResearch()
    {
        RequireStatus("Draft");
        if (ProposalsJson != "[]") throw new InvalidOperationException("Proposals are already saved. Create a new research exercise to run providers again.");
        Status = "Researching"; ResearchStartedAtUtc = DateTime.UtcNow; Touch();
    }
    public void FinishResearch(string proposalsJson)
    {
        RequireStatus("Researching"); ProposalsJson = proposalsJson; Status = "Draft"; Touch();
    }
    public void RecordBrokerReview(string brokerName, string evidence, int observationCount,
        decimal lowPerCent, decimal highPerCent, DateTime observedAtUtc)
    {
        if (Status != "Draft" && Status != "NeedsCorrection" && Status != "InsufficientEvidence")
            throw new InvalidOperationException("This research is not awaiting broker assessment.");
        if (string.IsNullOrWhiteSpace(brokerName) || brokerName.Length > 150 ||
            string.IsNullOrWhiteSpace(evidence) || evidence.Trim().Length < 20 || evidence.Length > 6000 ||
            observationCount < 1 || observationCount > 10000 ||
            observedAtUtc.Kind != DateTimeKind.Utc || observedAtUtc > DateTime.UtcNow ||
            observedAtUtc < DateTime.UtcNow.AddDays(-90))
            throw new ArgumentException("Record the broker, supporting evidence (at least 20 characters), observation count and an observation date within the past 90 days.");
        ValidateRange(lowPerCent, highPerCent);
        BrokerName = brokerName.Trim(); BrokerEvidence = evidence.Trim(); ObservationCount = observationCount;
        BrokerLowPerCent = lowPerCent; BrokerHighPerCent = highPerCent;
        LowPerCent = lowPerCent; HighPerCent = highPerCent; BrokerReviewedAtUtc = observedAtUtc;
        Status = "BrokerReviewed"; Touch();
    }
    public void Approve(decimal lowPerCent, decimal highPerCent, DateTime validUntilUtc, string notes, string actor)
    {
        RequireStatus("BrokerReviewed"); ValidateRange(lowPerCent, highPerCent);
        if (validUntilUtc.Kind != DateTimeKind.Utc || validUntilUtc <= DateTime.UtcNow ||
            validUntilUtc > BrokerReviewedAtUtc!.Value.AddDays(90) || string.IsNullOrWhiteSpace(notes) || notes.Length > 4000)
            throw new ArgumentException("Provide approval notes and an expiry within 90 days of the broker observation.");
        LowPerCent = lowPerCent; HighPerCent = highPerCent; ValidUntilUtc = validUntilUtc;
        ReviewNotes = notes.Trim(); ReviewedBy = actor; ApprovedAtUtc = DateTime.UtcNow;
        Status = "Approved"; Touch();
    }
    public void Reject(string notes, string actor)
    {
        if (Status != "Draft" && Status != "BrokerReviewed") throw new InvalidOperationException("This research cannot be rejected in its current state.");
        RecordDecision("Rejected", notes, actor);
    }
    public void Withdraw(string notes, string actor)
    {
        RequireStatus("Approved"); RecordDecision("Withdrawn", notes, actor);
    }
    private void RecordDecision(string status, string notes, string actor)
    {
        if (string.IsNullOrWhiteSpace(notes) || notes.Length > 4000) throw new ArgumentException("Provide a review reason.");
        Status = status; ReviewNotes = notes.Trim(); ReviewedBy = actor; Touch();
    }
    private void RequireStatus(string status)
    {
        if (Status != status) throw new InvalidOperationException($"Expected {status}; current status is {Status}. Create a new research exercise to revise a published range.");
    }
    public static void ValidateRange(decimal low, decimal high)
    {
        if (low <= 0 || high < low || high > 1000000000m) throw new ArgumentException("Enter a positive ordered range in INR per cent (maximum ₹100 crore per cent).");
    }
    private void Touch() => Version = Guid.NewGuid();
}
