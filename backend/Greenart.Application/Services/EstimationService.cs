using Greenart.Application.DTOs;
using Greenart.Application.Estimation;

namespace Greenart.Application.Services;

public interface IEstimationService
{
    Task<object> CalculateEstimateAsync(CalculateEstimateRequest request, CancellationToken cancellationToken = default);
}

public class EstimationService : IEstimationService
{
    private readonly IEstimationEngine _engine;

    public EstimationService(IEstimationEngine engine)
    {
        _engine = engine;
    }

    public Task<object> CalculateEstimateAsync(CalculateEstimateRequest request, CancellationToken cancellationToken = default)
    {
        return _engine.EstimateMarketPriceAsync(request, cancellationToken);
    }
}
