using Greenart.Application.DTOs;
namespace Greenart.Application.Common.Interfaces;
public interface ILandMarketResearchService
{
    bool IsConfigured { get; }
    Task<GroundedResearchOutcome> AnalyzeAsync(LandResearchInput input, CancellationToken ct);
}
public interface IMarketEvidenceRetriever
{
    Task<RetrievedMarketSource> RetrieveAsync(string url, CancellationToken ct);
}
