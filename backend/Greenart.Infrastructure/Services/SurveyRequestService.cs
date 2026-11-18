using System.Collections.Concurrent;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Services;

public class SurveyRequestService : ISurveyRequestService
{
    private readonly ConcurrentDictionary<Guid, SurveyVerificationRequestDto> _store = new();
    private readonly ILogger<SurveyRequestService> _logger;

    public SurveyRequestService(ILogger<SurveyRequestService> logger)
    {
        _logger = logger;
    }

    public Task<SurveyVerificationRequestDto> QueueSurveyAsync(
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
        CancellationToken ct = default)
    {
        // Duplicate check: if a pending request exists within ~200m in the last 24h, return existing
        var recentCutoff = DateTime.UtcNow.AddHours(-24);
        var existing = _store.Values.FirstOrDefault(s =>
            s.Status == "PendingBrokerCall" &&
            s.CreatedAtUtc >= recentCutoff &&
            s.LandUsage == landUsage &&
            Math.Abs(s.Latitude - latitude) < 0.002 &&
            Math.Abs(s.Longitude - longitude) < 0.002);

        if (existing != null)
        {
            return Task.FromResult(existing);
        }

        var newRequest = new SurveyVerificationRequestDto(
            Id: Guid.NewGuid(),
            Latitude: latitude,
            Longitude: longitude,
            Locality: string.IsNullOrWhiteSpace(locality) ? "Selected Pin Location" : locality.Trim(),
            District: string.IsNullOrWhiteSpace(district) ? "Tamil Nadu" : district.Trim(),
            LandUsage: landUsage,
            TargetArea: targetArea,
            TargetAreaUnit: targetAreaUnit,
            EstimatedRatePerCent: estimatedRatePerCent,
            EstimatedRatePerSqFt: estimatedRatePerSqFt,
            GuidelineRatePerCent: guidelineRatePerCent,
            Status: "PendingBrokerCall",
            CreatedAtUtc: DateTime.UtcNow
        );

        _store[newRequest.Id] = newRequest;
        _logger.LogInformation("Queued new survey verification request {Id} for locality {Locality}, {District}",
            newRequest.Id, newRequest.Locality, newRequest.District);

        return Task.FromResult(newRequest);
    }

    public Task<IReadOnlyList<SurveyVerificationRequestDto>> GetAllSurveysAsync(string? status = null, CancellationToken ct = default)
    {
        IEnumerable<SurveyVerificationRequestDto> query = _store.Values;
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(s => string.Equals(s.Status, status, StringComparison.OrdinalIgnoreCase));
        }

        var list = query.OrderByDescending(s => s.CreatedAtUtc).ToList();
        return Task.FromResult<IReadOnlyList<SurveyVerificationRequestDto>>(list);
    }

    public Task<SurveyVerificationRequestDto?> GetSurveyByIdAsync(Guid id, CancellationToken ct = default)
    {
        _store.TryGetValue(id, out var survey);
        return Task.FromResult(survey);
    }

    public Task<SurveyVerificationRequestDto?> ConfirmSurveyAsync(
        Guid id,
        ConfirmSurveyRequest request,
        CancellationToken ct = default)
    {
        if (!_store.TryGetValue(id, out var existing))
        {
            return Task.FromResult<SurveyVerificationRequestDto?>(null);
        }

        var confirmed = existing with
        {
            Status = "Confirmed",
            ConfirmedAtUtc = DateTime.UtcNow,
            BrokerName = request.BrokerName?.Trim(),
            BrokerPhone = request.BrokerPhone?.Trim(),
            ConfirmedRatePerCent = request.ConfirmedRatePerCent,
            Notes = request.Notes?.Trim()
        };

        _store[id] = confirmed;
        _logger.LogInformation("Confirmed survey request {Id} by broker {BrokerName} with ground rate ₹{Rate:N0}/Cent",
            id, confirmed.BrokerName, confirmed.ConfirmedRatePerCent);

        return Task.FromResult<SurveyVerificationRequestDto?>(confirmed);
    }
}
