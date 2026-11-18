namespace Greenart.Domain.Entities;
/// <summary>Asking-source evidence for a research request; never a completed transaction.</summary>
public class MarketResearchEvidence
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ResearchId { get; private set; }
    public string EvidenceId { get; private set; } = "";
    public string SourceCategory { get; private set; } = "AdvertisedAskingPrice";
    public string SourceName { get; private set; } = "";
    public string SourceUrl { get; private set; } = "";
    public DateTime? ObservationDateUtc { get; private set; }
    public DateTime RetrievedAtUtc { get; private set; }
    public decimal? OriginalPrice { get; private set; }
    public decimal? OriginalArea { get; private set; }
    public string OriginalAreaUnit { get; private set; } = "";
    public decimal? AreaSqFt { get; private set; }
    public decimal? RatePerCent { get; private set; }
    public decimal? RatePerSqFt { get; private set; }
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public string Status { get; private set; } = "Rejected";
    public string ChecksJson { get; private set; } = "[]";
    private MarketResearchEvidence() { }
    public MarketResearchEvidence(Guid researchId, string evidenceId, string name, string url, DateTime? date, DateTime retrieved,
        decimal price, decimal area, string unit, decimal? sqFt, decimal? perCent, decimal? perSqFt, double? latitude, double? longitude,
        string status, string checksJson) {
        ResearchId = researchId; EvidenceId = evidenceId; SourceName = name[..Math.Min(name.Length, 300)]; SourceUrl = url[..Math.Min(url.Length, 4000)];
        ObservationDateUtc = date.HasValue ? DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc) : null;
        RetrievedAtUtc = retrieved; OriginalPrice = price is > 0 and <= 100000000000m ? price : null; OriginalArea = area is > 0 and <= 100000000m ? area : null; OriginalAreaUnit = unit[..Math.Min(unit.Length, 30)];
        AreaSqFt = sqFt; RatePerCent = perCent; RatePerSqFt = perSqFt; Latitude = latitude; Longitude = longitude;
        Status = status; ChecksJson = checksJson;
    }
}
