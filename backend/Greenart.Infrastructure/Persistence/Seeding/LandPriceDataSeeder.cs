using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Persistence.Seeding;

public static class LandPriceDataSeeder
{
    public static async Task SeedAsync(LandPriceDbContext context, ILogger logger, CancellationToken cancellationToken = default)
    {
        var pilotRecords = GetPilotRecords();

        int seededCount = 0;
        foreach (var record in pilotRecords)
        {
            var exists = await context.LandPriceRecords.AnyAsync(r => r.Id == record.Id, cancellationToken);
            if (!exists)
            {
                await context.LandPriceRecords.AddAsync(record, cancellationToken);
                seededCount++;
            }
        }

        if (seededCount > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Successfully seeded {Count} Coimbatore pilot land price records into PostGIS database.", seededCount);
        }
        else
        {
            logger.LogInformation("Database already contains all {Total} Coimbatore pilot land price records. Seeding skipped.", pilotRecords.Count);
        }
    }

    public static IReadOnlyList<LandPriceRecord> GetPilotRecords() => new List<LandPriceRecord>
    {
        // ==========================================
        // 1. KANNAMPALAYAM (Center: 11.0012, 77.0874)
        // ==========================================
        new(
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
            observationDate: new DateTime(2023, 11, 14, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Registered sale deed; rectangular plot facing 30ft panchayat road."
        ),
        new(
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
            observationDate: new DateTime(2024, 2, 20, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Verified transaction; DTCP approved layout."
        ),
        new(
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
            observationDate: new DateTime(2024, 4, 10, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Asking rate in local classifieds; negotiation margin expected."
        ),
        new(
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
            observationDate: new DateTime(2023, 9, 15, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Client-supplied historical indicative rate; labelled as research estimate."
        ),
        new(
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
            observationDate: new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Statutory guideline valuation benchmark from TN Registration Dept."
        ),

        // ==========================================
        // 2. SULUR CORRIDOR (Center: 11.0264, 77.1275)
        // ==========================================
        new(
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
            observationDate: new DateTime(2024, 3, 12, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Corner plot with twin road frontage."
        ),
        new(
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
            observationDate: new DateTime(2024, 5, 2, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Clear title verified with encumbrance certificate."
        ),
        new(
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
            observationDate: new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Advertised residential plot rate."
        ),
        new(
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
            observationDate: new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Sulur statutory guideline valuation baseline."
        ),

        // ==========================================
        // 3. SARAVANAMPATTI (Center: 11.0805, 76.9976)
        // ==========================================
        new(
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
            observationDate: new DateTime(2024, 4, 18, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "IT corridor residential development plot."
        ),
        new(
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
            observationDate: new DateTime(2024, 5, 29, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Gated layout near IT SEZ."
        ),
        new(
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
            observationDate: new DateTime(2024, 6, 12, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Unverified,
            isSynthetic: false,
            notes: "Premium asking rate near tech park."
        ),
        new(
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
            observationDate: new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Saravanampatti statutory guideline benchmark."
        )
    };
}

