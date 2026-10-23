using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Infrastructure.Providers;

public class TnReginetGuidelineProvider : ILandPriceDataProvider
{
    private readonly ILandPriceRepository _repository;

    public string ProviderId => "tnreginet-guideline-feed";
    public string ProviderName => "Tamil Nadu Registration Department (TNREGINET) Statutory Benchmark Feed";
    public SourceCategory Category => SourceCategory.GovernmentGuideline;
    public ProviderPermittedUsage PermittedUsage => ProviderPermittedUsage.BenchmarkReferenceOnly;

    public ProviderCoverageDto Coverage => new(
        RegionName: "All 38 Districts of Tamil Nadu (Statewide Statutory Coverage)",
        CoveredDistricts: TamilNaduGeoBounds.TamilNaduDistricts,
        Statewide: true,
        SupportedLandUsages: Enum.GetNames<LandUsageType>()
    );

    public DateTime LastUpdatedUtc => new DateTime(2024, 7, 1, 0, 0, 0, DateTimeKind.Utc);
    public bool IsLiveFeedAvailable => true;
    public string LicenseTerms => "Public statutory reference benchmark published under the Tamil Nadu Stamp Act for stamp duty assessment.";
    public string DataIntegrityNote => "Statutory benchmark valuation ONLY. Strictly isolated and never commingled into open-market transaction estimation calculations.";

    public TnReginetGuidelineProvider(ILandPriceRepository repository)
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

        var guidelineRecords = records
            .Where(r => r.SourceCategory == SourceCategory.GovernmentGuideline)
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
                SourceReference: r.SourceReference ?? "TNREGINET Guideline Register",
                ObservationDate: r.ObservationDate,
                LegalProvenance: "Official Tamil Nadu Registration Department guideline value register.",
                IsEstimatedOrSynthesized: false
            ))
            .ToList();

        return new ProviderQueryResult(
            ProviderId: ProviderId,
            Success: true,
            RecordsFound: guidelineRecords.Count,
            Message: $"Retrieved {guidelineRecords.Count} statutory guideline benchmarks. These rates are never used to compute open-market prices.",
            Records: guidelineRecords
        );
    }
}

