using Greenart.Domain.Enums;
namespace Greenart.Domain.Entities;
/// <summary>Independent local opinion entered by an administrator, not completed-sale evidence.</summary>
public class BrokerMarketObservation
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ResearchId { get; private set; }
    public Guid ResearchVersion { get; private set; }
    public string SourceCategory { get; private set; } = "BrokerMarketOpinion";
    public string BrokerId { get; private set; } = "";
    public string BrokerName { get; private set; } = "";
    public string ContactReference { get; private set; } = "";
    public string BrokerLocality { get; private set; } = "";
    public string EvidenceType { get; private set; } = "BrokerMarketOpinion";
    public string Familiarity { get; private set; } = "NotProvided";
    public string DocumentReference { get; private set; } = "";
    public string EvidenceNotes { get; private set; } = "";
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    public LandUsageType LandUsage { get; private set; }
    public decimal LowPerCent { get; private set; }
    public decimal? TypicalPerCent { get; private set; }
    public decimal HighPerCent { get; private set; }
    public decimal? AiTypicalPerCent { get; private set; }
    public decimal? DifferencePercentage { get; private set; }
    public DateTime AssessmentDateUtc { get; private set; }
    public string VerificationStatus { get; private set; } = "PendingAdminReview";
    public string RecordedBy { get; private set; } = "";
    public string? ReviewedBy { get; private set; }
    public DateTime? ReviewedAtUtc { get; private set; }
    private BrokerMarketObservation() { }
    public BrokerMarketObservation(PriceResearch research, Guid version, string brokerName, string brokerId, string contact,
        string locality, string notes, string familiarity, string document, decimal low, decimal? typical, decimal high,
        DateTime assessed, decimal? aiTypical, string actor, LandUsageType? category = null) {
        PriceResearch.ValidateRange(low, high);
        if (typical.HasValue && (typical <= 0 || typical < low || typical > high) || assessed.Kind != DateTimeKind.Utc || assessed > DateTime.UtcNow || assessed < DateTime.UtcNow.AddDays(-90))
            throw new ArgumentException("Supply a valid broker assessment date and typical rate within the stated range.");
        if (category.HasValue && category != research.LandUsage) throw new ArgumentException("Broker land category must match the research request.");
        if (brokerName.Length > 150 || brokerId.Length > 150 || contact.Length > 250 || locality.Length > 150 || familiarity.Length > 100 || document.Length > 1000 || notes.Length > 6000)
            throw new ArgumentException("Broker metadata is too long.");
        ResearchId = research.Id; ResearchVersion = version; BrokerName = brokerName; BrokerId = brokerId; ContactReference = contact;
        BrokerLocality = locality; EvidenceNotes = notes; Familiarity = familiarity; DocumentReference = document;
        Latitude = research.Latitude; Longitude = research.Longitude; LandUsage = research.LandUsage;
        LowPerCent = low; TypicalPerCent = typical; HighPerCent = high; AssessmentDateUtc = assessed;
        AiTypicalPerCent = aiTypical; RecordedBy = actor;
        if (aiTypical > 0 && typical > 0) DifferencePercentage = Math.Round(Math.Abs(aiTypical.Value - typical.Value) / typical.Value * 100m, 2);
    }
    public void Decide(string status, string actor) {
        if (status is not ("Approved" or "Rejected" or "Withdrawn" or "NeedsCorrection")) throw new ArgumentException("Invalid broker decision.");
        VerificationStatus = status; ReviewedBy = actor; ReviewedAtUtc = DateTime.UtcNow;
    }
}
