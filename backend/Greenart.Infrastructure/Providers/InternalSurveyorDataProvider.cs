using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Infrastructure.Providers;

public class InternalSurveyorDataProvider : ILandPriceDataProvider
{
    private readonly ILandPriceRepository _repository;

    public string ProviderId => "greenart-surveyor-network";
    public string ProviderName => "Greenart Field Surveyor & Broker Inspection Network";
    public SourceCategory Category => SourceCategory.ClientResearch;
    public ProviderPermittedUsage PermittedUsage => ProviderPermittedUsage.CommercialDisplay;

    public ProviderCoverageDto Coverage => new(
        RegionName: "Tamil Nadu (Pilot: Coimbatore, Tiruppur, Chennai, Madurai)",
        CoveredDistricts: TamilNaduGeoBounds.TamilNaduDistricts,
        Statewide: true,
        SupportedLandUsages: Enum.GetNames<LandUsageType>()
    );

    public DateTime LastUpdatedUtc => DateTime.UtcNow.Date;
    public bool IsLiveFeedAvailable => true;
    public string LicenseTerms => "Internal proprietary dataset collected directly by licensed surveyors under Greenart real-estate research agreements.";
    public string DataIntegrityNote => "All field measurements verified on ground. Requires administrative audit prior to promotion to Verified status.";

    public InternalSurveyorDataProvider(ILandPriceRepository repository)
    {
        _repository = repository;
    }

    public async Task<ProviderQueryResult> FetchRecordsAsync(ProviderQueryRequest request, CancellationToken cancellationToken = default)
    {
        var records = await _repository.GetNearbyComparableAsync(
            request.Latitude,
            request.Longitude,
            request.RadiusMeters,
            request.LandUsage,
            cancellationToken);

        var providerRecords = records
            .Where(r => r.SourceCategory == SourceCategory.ClientResearch)
            .Select(r => new ProviderRecordDto(
                Locality: r.Locality,
                District: r.District,
                Taluk: r.Taluk,
                SurveyNumber: r.SurveyNumber,
                Latitude: r.Latitude,
                Longitude: r.Longitude,
                LandUsage: r.LandUsage.ToString(),
                Area: r.OriginalArea,
                Unit: r.OriginalUnit.ToString(),
                Price: r.OriginalPrice,
                SourceCategory: r.SourceCategory.ToString(),
                SourceReference: r.SourceReference ?? "Field Survey Sheet",
                ObservationDate: r.ObservationDate,
                LegalProvenance: "Greenart surveyor field inspection; GPS pinned with physical boundary check.",
                IsEstimatedOrSynthesized: false
            ))
            .ToList();

        return new ProviderQueryResult(
            ProviderId: ProviderId,
            Success: true,
            RecordsFound: providerRecords.Count,
            Message: $"Retrieved {providerRecords.Count} field surveyor observations within {request.RadiusMeters:N0}m radius.",
            Records: providerRecords
        );
    }
}

