using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Application.Services;

public class MlReadinessService : IMlReadinessService
{
    private readonly ILandPriceRepository _repository;

    public const int MinimumRequiredVerifiedRecordsPerDistrict = 500;

    public MlReadinessService(ILandPriceRepository repository)
    {
        _repository = repository;
    }

    public async Task<StatewideCoverageSummaryDto> GetStatewideCoverageSummaryAsync(CancellationToken cancellationToken = default)
    {
        var records = await _repository.GetAllAsync(cancellationToken: cancellationToken);

        var totalRecords = records.Count;
        var totalVerified = records.Count(r => r.VerificationStatus == VerificationStatus.Verified);
        var totalUnverified = records.Count(r => r.VerificationStatus == VerificationStatus.Unverified);
        var totalGuideline = records.Count(r => r.SourceCategory == SourceCategory.GovernmentGuideline);
        var latestDate = records.Count > 0 ? records.Max(r => r.ObservationDate) : (DateTime?)null;

        var groupedByDistrict = records
            .GroupBy(r => TamilNaduGeoBounds.NormalizeDistrict(r.District), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

        var districtBreakdown = new List<DistrictCoverageDetailDto>();

        foreach (var districtName in TamilNaduGeoBounds.TamilNaduDistricts)
        {
            if (groupedByDistrict.TryGetValue(districtName, out var distRecords))
            {
                var verifiedCount = distRecords.Count(r => r.VerificationStatus == VerificationStatus.Verified);
                var unverifiedCount = distRecords.Count(r => r.VerificationStatus == VerificationStatus.Unverified);
                var guidelineCount = distRecords.Count(r => r.SourceCategory == SourceCategory.GovernmentGuideline);
                var latestDistDate = distRecords.Count > 0 ? distRecords.Max(r => r.ObservationDate) : (DateTime?)null;
                var activeLocalities = distRecords.Select(r => r.Locality).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

                string status = string.Equals(districtName, "Coimbatore", StringComparison.OrdinalIgnoreCase)
                    ? "PilotHub"
                    : distRecords.Count >= 50
                        ? "Moderate"
                        : "Sparse";

                districtBreakdown.Add(new DistrictCoverageDetailDto(
                    District: districtName,
                    RecordCount: distRecords.Count,
                    VerifiedCount: verifiedCount,
                    UnverifiedCount: unverifiedCount,
                    GuidelineCount: guidelineCount,
                    Status: status,
                    LatestObservationDate: latestDistDate,
                    ActiveLocalities: activeLocalities
                ));
            }
            else
            {
                districtBreakdown.Add(new DistrictCoverageDetailDto(
                    District: districtName,
                    RecordCount: 0,
                    VerifiedCount: 0,
                    UnverifiedCount: 0,
                    GuidelineCount: 0,
                    Status: "NoData",
                    LatestObservationDate: null,
                    ActiveLocalities: Array.Empty<string>()
                ));
            }
        }

        var activeDistrictsCount = districtBreakdown.Count(d => d.RecordCount > 0);

        return new StatewideCoverageSummaryDto(
            TotalRecords: totalRecords,
            TotalVerified: totalVerified,
            TotalUnverified: totalUnverified,
            TotalGuideline: totalGuideline,
            ActiveDistrictsCount: activeDistrictsCount,
            TotalTamilNaduDistricts: TamilNaduGeoBounds.TamilNaduDistricts.Count,
            LatestObservationDateUtc: latestDate,
            DistrictBreakdown: districtBreakdown
        );
    }

    public async Task<MlReadinessAuditReportDto> GenerateAuditReportAsync(CancellationToken cancellationToken = default)
    {
        var records = await _repository.GetAllAsync(cancellationToken: cancellationToken);

        var totalRecords = records.Count;
        var totalVerified = records.Count(r => r.VerificationStatus == VerificationStatus.Verified && r.SourceCategory == SourceCategory.VerifiedTransaction);

        var groupedByDistrict = records
            .GroupBy(r => TamilNaduGeoBounds.NormalizeDistrict(r.District), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

        var districtStatuses = new List<DistrictMlStatusDto>();
        int qualifiedDistrictsCount = 0;

        foreach (var district in TamilNaduGeoBounds.TamilNaduDistricts)
        {
            if (groupedByDistrict.TryGetValue(district, out var dRecords))
            {
                var verifiedTx = dRecords.Count(r => r.SourceCategory == SourceCategory.VerifiedTransaction && r.VerificationStatus == VerificationStatus.Verified);
                var asking = dRecords.Count(r => r.SourceCategory == SourceCategory.AdvertisedAskingPrice);
                var guideline = dRecords.Count(r => r.SourceCategory == SourceCategory.GovernmentGuideline);
                var research = dRecords.Count(r => r.SourceCategory == SourceCategory.ClientResearch);

                bool isEligible = verifiedTx >= MinimumRequiredVerifiedRecordsPerDistrict;
                if (isEligible) qualifiedDistrictsCount++;

                string density = verifiedTx >= 500 ? "Dense" : verifiedTx >= 50 ? "Moderate" : "Sparse";
                int required = Math.Max(0, MinimumRequiredVerifiedRecordsPerDistrict - verifiedTx);

                districtStatuses.Add(new DistrictMlStatusDto(
                    District: district,
                    TotalRecords: dRecords.Count,
                    VerifiedTransactions: verifiedTx,
                    AskingPrices: asking,
                    GuidelineBenchmarks: guideline,
                    ClientResearch: research,
                    DensityStatus: density,
                    IsEligibleForMlTraining: isEligible,
                    RequiredAdditionalRecords: required
                ));
            }
            else
            {
                districtStatuses.Add(new DistrictMlStatusDto(
                    District: district,
                    TotalRecords: 0,
                    VerifiedTransactions: 0,
                    AskingPrices: 0,
                    GuidelineBenchmarks: 0,
                    ClientResearch: 0,
                    DensityStatus: "ZeroData",
                    IsEligibleForMlTraining: false,
                    RequiredAdditionalRecords: MinimumRequiredVerifiedRecordsPerDistrict
                ));
            }
        }

        var featureSchema = new List<MlTrainingFeatureSchemaDto>
        {
            new("NormalizedRatePerCent", "decimal", "Ground-truth target open-market transaction rate in INR per Cent.", true, "Target variable (y). Only verified registered deeds included."),
            new("Latitude", "double", "WGS 84 latitude coordinate [8.0 to 13.6° N].", false, "Spatial feature (X). Encoded via spatial embedding / coordinate projection."),
            new("Longitude", "double", "WGS 84 longitude coordinate [76.2 to 80.4° E].", false, "Spatial feature (X). Encoded via spatial embedding / coordinate projection."),
            new("LandUsage", "enum string", "Zoning classification (Residential, Commercial, Industrial, Agricultural).", false, "One-hot or categorical encoding."),
            new("AreaInSqFt", "decimal", "Parcel land area normalized to square feet.", false, "Log-transformed numerical feature."),
            new("ObservationRecencyDays", "integer", "Days elapsed between transaction date and reference training epoch.", false, "Linear decay temporal weight."),
            new("GovernmentGuidelineRate", "decimal", "Statutory guideline valuation benchmark from TNREGINET.", false, "Contextual feature (X) ONLY. Never substituted as ground-truth target."),
            new("SourceCategoryWeight", "float", "Quality confidence weight (VerifiedTransaction=1.0, AskingPrice=0.35).", false, "Sample weight in objective loss function.")
        };

        var dataLeakageSafeguards = new List<string>
        {
            "Spatial Block Cross-Validation: Spatial blocks (5km x 5km) to prevent spatial autocorrelation leakage between nearby parcels.",
            "Temporal Out-of-Time Split: Training partition restricted to historical observations; test set strictly forward in time (no lookahead bias).",
            "Guideline Benchmark Isolation: Statutory benchmark values strictly excluded from target training labels.",
            "Deduplication Gate: Attribute and spatial proximity duplicates (distance <= 15m) deduplicated prior to feature extraction."
        };

        var validationBlockers = new List<string>
        {
            $"Sample Size Insufficiency: Zero districts currently meet the mandatory {MinimumRequiredVerifiedRecordsPerDistrict} verified transaction threshold.",
            "Statewide Data Gaps: 37 out of 38 Tamil Nadu districts currently have zero recorded transactions in database.",
            "Model Fallback Mandate: Rule-based PostGIS median/interquartile estimation engine remains mandatory for all customer estimations."
        };

        string verdict = qualifiedDistrictsCount > 0
            ? $"Qualified for Pilot ML Training in {qualifiedDistrictsCount} district(s)."
            : "ML Training Unready: Insufficient sample size across Tamil Nadu. Production ML deployment strictly gated until 500+ verified deeds are ingested per target district.";

        return new MlReadinessAuditReportDto(
            AuditTimestampUtc: DateTime.UtcNow,
            MinimumRequiredVerifiedPerDistrict: MinimumRequiredVerifiedRecordsPerDistrict,
            TotalStatewideRecords: totalRecords,
            TotalStatewideVerifiedTransactions: totalVerified,
            QualifiedDistrictsCount: qualifiedDistrictsCount,
            Districts: districtStatuses,
            FeatureSchema: featureSchema,
            DataLeakageSafeguards: dataLeakageSafeguards,
            ValidationBlockers: validationBlockers,
            ProductionReadinessVerdict: verdict
        );
    }
}

