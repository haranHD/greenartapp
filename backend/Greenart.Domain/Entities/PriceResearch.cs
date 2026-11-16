using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

/// <summary>One research exercise; model answers never count as independent sale observations.</summary>
public class PriceResearch
{
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
        RequireStatus("Draft");
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
