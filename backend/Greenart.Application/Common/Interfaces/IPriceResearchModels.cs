using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
namespace Greenart.Application.Common.Interfaces;
public interface IPriceResearchModels
{
    IReadOnlyList<ResearchProviderStatus> GetStatus();
    Task<IReadOnlyList<ModelPriceProposal>> ResearchAsync(PriceResearch research, CancellationToken ct);
}
