using Greenart.Application.Common.Interfaces;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;

namespace Greenart.Infrastructure.Repositories;

public class CoimbatorePilotRepository : ILandPriceRepository
{
    private readonly List<LandPriceRecord> _records;
    private readonly List<ImportBatch> _batches = new();
    private readonly List<AuditEvent> _auditEvents = new();

    public CoimbatorePilotRepository()
    {
        _records = GetInitialRecords();
    }

    private static List<LandPriceRecord> GetInitialRecords() => new()
    {
        // ==========================================
        // 1. KANNAMPALAYAM (Center: 11.0012, 77.0874)
        // ==========================================
        new LandPriceRecord(
            id: Guid.Parse("11111111-1111-1111-1111-111111111101"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Trichy Road Branch",
            surveyNumber: "SF 142/2A",
            coordinates: new GeoCoordinate(11.0015, 77.0878),
            landUsage: LandUsageType.Residential,
            area: new LandArea(3.5m, AreaUnit.Cent),
            originalPrice: 3675000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Sulur Doc 3412/2023",
            observationDate: new DateTime(2023, 11, 14),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Registered sale deed; rectangular plot facing 30ft panchayat road."
        ),
        new LandPriceRecord(
            id: Guid.Parse("11111111-1111-1111-1111-111111111102"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Green Enclave Layout",
            surveyNumber: "SF 144/1",
            coordinates: new GeoCoordinate(11.0021, 77.0869),
            landUsage: LandUsageType.Residential,
            area: new LandArea(4.0m, AreaUnit.Cent),
            originalPrice: 4400000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Sulur Doc 1089/2024",
            observationDate: new DateTime(2024, 2, 20),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Verified transaction; DTCP approved layout."
        ),
        new LandPriceRecord(
            id: Guid.Parse("11111111-1111-1111-1111-111111111103"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "SF 143 Adjacent",
            surveyNumber: "SF 143",
            coordinates: new GeoCoordinate(11.0008, 77.0881),
            landUsage: LandUsageType.Residential,
            area: new LandArea(5.2m, AreaUnit.Cent),
            originalPrice: 5096000m,
            sourceCategory: SourceCategory.AdvertisedAskingPrice,
            sourceReference: "Local Broker Listing #KP-94",
            observationDate: new DateTime(2024, 4, 10),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Asking rate in local classifieds; negotiation margin expected."
        ),
        new LandPriceRecord(
            id: Guid.Parse("11111111-1111-1111-1111-111111111104"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Panchayat Office Road",
            surveyNumber: "SF 138/B",
            coordinates: new GeoCoordinate(11.0030, 77.0855),
            landUsage: LandUsageType.Residential,
            area: new LandArea(3.0m, AreaUnit.Cent),
            originalPrice: 3060000m,
            sourceCategory: SourceCategory.ClientResearch,
            sourceReference: "Client Research Document: Kannampalayam Layout Breakup",
            observationDate: new DateTime(2023, 9, 15),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Client-supplied historical indicative rate; labelled as research estimate."
        ),
        new LandPriceRecord(
            id: Guid.Parse("11111111-1111-1111-1111-111111111105"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Revenue Ward 2",
            surveyNumber: "SF 140",
            coordinates: new GeoCoordinate(11.0010, 77.0870),
            landUsage: LandUsageType.Residential,
            area: new LandArea(1.0m, AreaUnit.Cent),
            originalPrice: 650000m,
            sourceCategory: SourceCategory.GovernmentGuideline,
            sourceReference: "TNREGINET 2024 Guideline Value",
            observationDate: new DateTime(2024, 1, 1),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Statutory guideline valuation benchmark from TN Registration Dept."
        ),

        // ==========================================
        // 2. SULUR CORRIDOR (Center: 11.0264, 77.1275)
        // ==========================================
        new LandPriceRecord(
            id: Guid.Parse("22222222-2222-2222-2222-222222222201"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Sulur",
            streetOrLandmark: "Aerodrome Road",
            surveyNumber: "SF 210/1",
            coordinates: new GeoCoordinate(11.0260, 77.1270),
            landUsage: LandUsageType.Residential,
            area: new LandArea(4.5m, AreaUnit.Cent),
            originalPrice: 5400000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Sulur Doc 844/2024",
            observationDate: new DateTime(2024, 3, 12),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Corner plot with twin road frontage."
        ),
        new LandPriceRecord(
            id: Guid.Parse("22222222-2222-2222-2222-222222222202"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Sulur",
            streetOrLandmark: "Ranganathapuram",
            surveyNumber: "SF 215/3",
            coordinates: new GeoCoordinate(11.0272, 77.1281),
            landUsage: LandUsageType.Residential,
            area: new LandArea(3.2m, AreaUnit.Cent),
            originalPrice: 3776000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Sulur Doc 1420/2024",
            observationDate: new DateTime(2024, 5, 2),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Clear title verified with encumbrance certificate."
        ),
        new LandPriceRecord(
            id: Guid.Parse("22222222-2222-2222-2222-222222222203"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Sulur",
            streetOrLandmark: "NH 81 Bypass",
            surveyNumber: "SF 222",
            coordinates: new GeoCoordinate(11.0250, 77.1265),
            landUsage: LandUsageType.Residential,
            area: new LandArea(5.0m, AreaUnit.Cent),
            originalPrice: 6250000m,
            sourceCategory: SourceCategory.AdvertisedAskingPrice,
            sourceReference: "Portal Listing #SLR-202",
            observationDate: new DateTime(2024, 6, 1),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Advertised residential plot rate."
        ),
        new LandPriceRecord(
            id: Guid.Parse("22222222-2222-2222-2222-222222222204"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Sulur",
            streetOrLandmark: "Town Center",
            surveyNumber: "SF 208",
            coordinates: new GeoCoordinate(11.0264, 77.1275),
            landUsage: LandUsageType.Residential,
            area: new LandArea(1.0m, AreaUnit.Cent),
            originalPrice: 800000m,
            sourceCategory: SourceCategory.GovernmentGuideline,
            sourceReference: "TNREGINET 2024 Guideline Value",
            observationDate: new DateTime(2024, 1, 1),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Sulur statutory guideline valuation baseline."
        ),

        // ==========================================
        // 3. SARAVANAMPATTI (Center: 11.0805, 76.9976)
        // ==========================================
        new LandPriceRecord(
            id: Guid.Parse("33333333-3333-3333-3333-333333333301"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Coimbatore North",
            locality: "Saravanampatti",
            streetOrLandmark: "Keeranatham Road",
            surveyNumber: "SF 89/1",
            coordinates: new GeoCoordinate(11.0810, 76.9980),
            landUsage: LandUsageType.Residential,
            area: new LandArea(3.0m, AreaUnit.Cent),
            originalPrice: 5400000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Gandhipuram Doc 5122/2024",
            observationDate: new DateTime(2024, 4, 18),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "IT corridor residential development plot."
        ),
        new LandPriceRecord(
            id: Guid.Parse("33333333-3333-3333-3333-333333333302"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Coimbatore North",
            locality: "Saravanampatti",
            streetOrLandmark: "Sathy Road Hub",
            surveyNumber: "SF 94/2",
            coordinates: new GeoCoordinate(11.0798, 76.9971),
            landUsage: LandUsageType.Residential,
            area: new LandArea(4.0m, AreaUnit.Cent),
            originalPrice: 7400000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Gandhipuram Doc 6204/2024",
            observationDate: new DateTime(2024, 5, 29),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Gated layout near IT SEZ."
        ),
        new LandPriceRecord(
            id: Guid.Parse("33333333-3333-3333-3333-333333333303"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Coimbatore North",
            locality: "Saravanampatti",
            streetOrLandmark: "Vellakinar Junction",
            surveyNumber: "SF 101",
            coordinates: new GeoCoordinate(11.0819, 76.9965),
            landUsage: LandUsageType.Residential,
            area: new LandArea(3.5m, AreaUnit.Cent),
            originalPrice: 6650000m,
            sourceCategory: SourceCategory.AdvertisedAskingPrice,
            sourceReference: "Online Listing #SVP-882",
            observationDate: new DateTime(2024, 6, 12),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Premium asking rate near tech park."
        ),
        new LandPriceRecord(
            id: Guid.Parse("33333333-3333-3333-3333-333333333304"),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Coimbatore North",
            locality: "Saravanampatti",
            streetOrLandmark: "Guideline Survey",
            surveyNumber: "SF 90",
            coordinates: new GeoCoordinate(11.0805, 76.9976),
            landUsage: LandUsageType.Residential,
            area: new LandArea(1.0m, AreaUnit.Cent),
            originalPrice: 1200000m,
            sourceCategory: SourceCategory.GovernmentGuideline,
            sourceReference: "TNREGINET 2024 Guideline Value",
            observationDate: new DateTime(2024, 1, 1),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Saravanampatti statutory guideline benchmark."
        )
    };

    public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(
        string? locality = null,
        LandUsageType? landUsage = null,
        SourceCategory? sourceCategory = null,
        string? district = null,
        CancellationToken cancellationToken = default)
    {
        var query = _records.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(district))
        {
            query = query.Where(r => r.District.Contains(district, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(locality))
        {
            query = query.Where(r => r.Locality.Contains(locality, StringComparison.OrdinalIgnoreCase));
        }

        if (landUsage.HasValue)
        {
            query = query.Where(r => r.LandUsage == landUsage.Value);
        }

        if (sourceCategory.HasValue)
        {
            query = query.Where(r => r.SourceCategory == sourceCategory.Value);
        }

        IReadOnlyList<LandPriceRecord> result = query.ToList();
        return Task.FromResult(result);
    }

    public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var record = _records.FirstOrDefault(r => r.Id == id);
        return Task.FromResult(record);
    }

    public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(
        double latitude,
        double longitude,
        double radiusMeters,
        LandUsageType landUsage,
        CancellationToken cancellationToken = default)
    {
        var target = new GeoCoordinate(latitude, longitude);

        var nearby = _records.Where(r =>
        {
            var isWithin = r.Coordinates.IsWithinRadius(target, radiusMeters);
            var isCompatibleUsage = r.LandUsage == landUsage;
            return isWithin && isCompatibleUsage;
        }).ToList();

        IReadOnlyList<LandPriceRecord> result = nearby;
        return Task.FromResult(result);
    }

    public Task AddAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
    {
        _records.Add(record);
        return Task.CompletedTask;
    }

    public Task AddRangeAsync(IEnumerable<LandPriceRecord> records, CancellationToken cancellationToken = default)
    {
        _records.AddRange(records);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(LandPriceRecord record, CancellationToken cancellationToken = default)
    {
        var index = _records.FindIndex(r => r.Id == record.Id);
        if (index >= 0)
        {
            _records[index] = record;
        }
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var exists = _records.Any(r => r.Id == id);
        return Task.FromResult(exists);
    }

    public Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default)
    {
        _batches.Insert(0, batch);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ImportBatch> result = _batches.Take(limit).ToList();
        return Task.FromResult(result);
    }

    public Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default)
    {
        _auditEvents.Insert(0, auditEvent);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<AuditEvent> result = _auditEvents.Take(limit).ToList();
        return Task.FromResult(result);
    }
}
