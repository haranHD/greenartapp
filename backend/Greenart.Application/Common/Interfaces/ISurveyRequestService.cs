using Greenart.Application.DTOs;
using Greenart.Domain.Enums;

namespace Greenart.Application.Common.Interfaces;

public interface ISurveyRequestService
{
    Task<SurveyVerificationRequestDto> QueueSurveyAsync(
        double latitude,
        double longitude,
        string locality,
        string district,
        LandUsageType landUsage,
        decimal? targetArea,
        AreaUnit? targetAreaUnit,
        decimal estimatedRatePerCent,
        decimal estimatedRatePerSqFt,
        decimal? guidelineRatePerCent,
        CancellationToken ct = default);

    Task<IReadOnlyList<SurveyVerificationRequestDto>> GetAllSurveysAsync(string? status = null, CancellationToken ct = default);

    Task<SurveyVerificationRequestDto?> GetSurveyByIdAsync(Guid id, CancellationToken ct = default);

    Task<SurveyVerificationRequestDto?> ConfirmSurveyAsync(
        Guid id,
        ConfirmSurveyRequest request,
        CancellationToken ct = default);
}
