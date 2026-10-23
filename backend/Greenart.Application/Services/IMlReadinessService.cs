using Greenart.Application.DTOs;

namespace Greenart.Application.Services;

public interface IMlReadinessService
{
    Task<MlReadinessAuditReportDto> GenerateAuditReportAsync(CancellationToken cancellationToken = default);
    Task<StatewideCoverageSummaryDto> GetStatewideCoverageSummaryAsync(CancellationToken cancellationToken = default);
}

