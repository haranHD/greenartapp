using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class HistoricalIntelligenceDomainTests
{
    [Fact]
    public void SourceDocument_ShouldInitializeWithValidParameters()
    {
        var docId = Guid.NewGuid();
        var doc = new SourceDocument(
            id: docId,
            fileName: "deed_2015_extract.pdf",
            storagePath: "/storage/docs/2015/deed_2015_extract.pdf",
            mimeType: "application/pdf",
            fileSizeBytes: 1048576,
            fileChecksumSha256: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
            documentType: SourceDocumentType.SroDeedExtract,
            uploadedBy: "AnalystUser"
        );

        Assert.Equal(docId, doc.Id);
        Assert.Equal("deed_2015_extract.pdf", doc.FileName);
        Assert.Equal(1048576, doc.FileSizeBytes);
        Assert.Equal("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", doc.FileChecksumSha256);
        Assert.Equal(DocumentProcessingStatus.Pending, doc.ProcessingStatus);
        Assert.Equal(DocumentValidationStatus.Unreviewed, doc.ValidationStatus);
        Assert.False(doc.IsArchived);
        Assert.Null(doc.ArchivedAtUtc);
        Assert.Null(doc.ArchivalReason);
        Assert.Equal("AnalystUser", doc.UploadedBy);
        Assert.Empty(doc.LandPriceRecords);
    }

    [Fact]
    public void SourceDocument_Archive_ShouldProtectProvenanceWithoutHardDeletion()
    {
        var doc = new SourceDocument(
            Guid.NewGuid(), "deed_2014.pdf", "/storage/deed_2014.pdf", "application/pdf", 4096, "checksum12345", SourceDocumentType.SroDeedExtract);

        doc.Archive("ComplianceOfficer", "Superseded by certified copy from District Registrar");

        Assert.True(doc.IsArchived);
        Assert.NotNull(doc.ArchivedAtUtc);
        Assert.Equal("Superseded by certified copy from District Registrar", doc.ArchivalReason);
        Assert.Equal(DocumentValidationStatus.Archived, doc.ValidationStatus);
        Assert.Equal("ComplianceOfficer", doc.ReviewedBy);
        Assert.Contains("Archived", doc.Notes);
    }

    [Fact]
    public void SourceDocument_ShouldEnforceRequiredFields()
    {
        Assert.Throws<ArgumentException>(() => new SourceDocument(
            Guid.NewGuid(), "", "/path", "application/pdf", 100, "checksum", SourceDocumentType.Other));

        Assert.Throws<ArgumentException>(() => new SourceDocument(
            Guid.NewGuid(), "file.pdf", "", "application/pdf", 100, "checksum", SourceDocumentType.Other));

        Assert.Throws<ArgumentException>(() => new SourceDocument(
            Guid.NewGuid(), "file.pdf", "/path", "application/pdf", 100, "", SourceDocumentType.Other));

        Assert.Throws<ArgumentOutOfRangeException>(() => new SourceDocument(
            Guid.NewGuid(), "file.pdf", "/path", "application/pdf", -1, "checksum", SourceDocumentType.Other));
    }

    [Fact]
    public void SourceDocument_ShouldTransitionStatusesCorrectly()
    {
        var doc = new SourceDocument(
            Guid.NewGuid(), "report.pdf", "/storage/report.pdf", "application/pdf", 2048, "abc123sha", SourceDocumentType.SurveyorValuationReport);

        doc.MarkExtracted("{\"sroOffice\":\"Sulur\",\"regYear\":2018}");
        Assert.Equal(DocumentProcessingStatus.Extracted, doc.ProcessingStatus);
        Assert.NotNull(doc.ProcessedAtUtc);
        Assert.Contains("Sulur", doc.ExtractedMetadataJson);

        doc.MarkValidated("Cross-checked with TN Reginet");
        Assert.Equal(DocumentProcessingStatus.Validated, doc.ProcessingStatus);
        Assert.Contains("Cross-checked", doc.Notes);

        doc.Approve("LeadAuditor", "All 5 deed entries verified");
        Assert.Equal(DocumentValidationStatus.Approved, doc.ValidationStatus);
        Assert.Equal("LeadAuditor", doc.ReviewedBy);
        Assert.NotNull(doc.ReviewedAtUtc);

        doc.Reject("LeadAuditor", "Mismatch in survey number");
        Assert.Equal(DocumentValidationStatus.Rejected, doc.ValidationStatus);
        Assert.Contains("Mismatch", doc.Notes);
    }

    [Fact]
    public void HistoricalEstimate_SuccessfulEstimate_ShouldSupportAllRateFieldsAndAliases()
    {
        var estId = Guid.NewGuid();
        var coords = new GeoCoordinate(11.0012, 77.0874);

        var estimate = new HistoricalEstimate(
            id: estId,
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            targetYear: 2018,
            landUsage: LandUsageType.Residential,
            coordinates: coords,
            status: HistoricalEstimateStatus.Success,
            confidenceLevel: ConfidenceLevel.Moderate,
            reviewStatus: HistoricalReviewStatus.SystemGenerated,
            estimatedRatePerCent: 2450000.50m,
            estimatedRatePerSqFt: 5624.71m,
            minRatePerCent: 2200000.00m,
            minRatePerSqFt: 5050.50m,
            maxRatePerCent: 2700000.00m,
            maxRatePerSqFt: 6200.00m,
            guidelineRatePerCent: 1800000.00m,
            guidelineRatePerSqFt: 4132.23m,
            sampleCount: 8,
            verifiedSampleCount: 5,
            methodology: "SpatialKnnTemporalWeighting_v1",
            algorithmVersion: "v1.2",
            limitations: "Sparse historical transactions in 2018"
        );

        Assert.Equal(estId, estimate.Id);
        Assert.Equal("Kannampalayam", estimate.Locality);
        Assert.Equal(2018, estimate.TargetYear);

        // Verify rates & semantic aliases for median rate
        Assert.Equal(2450000.50m, estimate.EstimatedRatePerCent);
        Assert.Equal(2450000.50m, estimate.MedianRatePerCent);
        Assert.Equal(5624.71m, estimate.EstimatedRatePerSqFt);
        Assert.Equal(5624.71m, estimate.MedianRatePerSqFt);

        // Verify min/max ranges for both cent and sq.ft
        Assert.Equal(2200000.00m, estimate.MinRatePerCent);
        Assert.Equal(5050.50m, estimate.MinRatePerSqFt);
        Assert.Equal(2700000.00m, estimate.MaxRatePerCent);
        Assert.Equal(6200.00m, estimate.MaxRatePerSqFt);

        // Verify separate guideline benchmark rates
        Assert.Equal(1800000.00m, estimate.GuidelineRatePerCent);
        Assert.Equal(4132.23m, estimate.GuidelineRatePerSqFt);

        // Verify sample counts
        Assert.Equal(8, estimate.SampleCount);
        Assert.Equal(5, estimate.VerifiedSampleCount);
        Assert.Equal(ConfidenceLevel.Moderate, estimate.ConfidenceLevel);
        Assert.Equal(HistoricalEstimateStatus.Success, estimate.Status);
    }

    [Fact]
    public void HistoricalEstimate_InsufficientData_MustHaveNullRates_AndRejectZeroPrices()
    {
        var coords = new GeoCoordinate(11.0012, 77.0874);

        // 1. Valid InsufficientData estimate: all market rates MUST be null
        var estimate = new HistoricalEstimate(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "OutlyingSector",
            targetYear: 2012,
            landUsage: LandUsageType.AgriculturalDry,
            coordinates: coords,
            status: HistoricalEstimateStatus.InsufficientData,
            confidenceLevel: ConfidenceLevel.Insufficient,
            reviewStatus: HistoricalReviewStatus.SystemGenerated,
            estimatedRatePerCent: null,
            estimatedRatePerSqFt: null,
            minRatePerCent: null,
            minRatePerSqFt: null,
            maxRatePerCent: null,
            maxRatePerSqFt: null,
            guidelineRatePerCent: 500000m, // Guideline benchmark may exist even when market evidence is insufficient
            guidelineRatePerSqFt: 1147.84m,
            sampleCount: 0,
            verifiedSampleCount: 0,
            limitations: "No registered sale deeds or surveyor reports available for 2012"
        );

        Assert.Equal(HistoricalEstimateStatus.InsufficientData, estimate.Status);
        Assert.Null(estimate.EstimatedRatePerCent);
        Assert.Null(estimate.MedianRatePerCent);
        Assert.Null(estimate.EstimatedRatePerSqFt);
        Assert.Null(estimate.MedianRatePerSqFt);
        Assert.Null(estimate.MinRatePerCent);
        Assert.Null(estimate.MinRatePerSqFt);
        Assert.Null(estimate.MaxRatePerCent);
        Assert.Null(estimate.MaxRatePerSqFt);
        Assert.Equal(500000m, estimate.GuidelineRatePerCent);

        // 2. DOMAIN INVARIANT: Throw if InsufficientData attempts to represent unavailable market prices as 0.00
        var exZeroCent = Assert.Throws<InvalidOperationException>(() => new HistoricalEstimate(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "OutlyingSector",
            targetYear: 2012,
            landUsage: LandUsageType.AgriculturalDry,
            coordinates: coords,
            status: HistoricalEstimateStatus.InsufficientData,
            confidenceLevel: ConfidenceLevel.Insufficient,
            reviewStatus: HistoricalReviewStatus.SystemGenerated,
            estimatedRatePerCent: 0.00m, // FORBIDDEN: unavailable price represented as 0.00
            estimatedRatePerSqFt: null
        ));
        Assert.Contains("unavailable prices as 0.00", exZeroCent.Message);

        var exZeroSqFt = Assert.Throws<InvalidOperationException>(() => new HistoricalEstimate(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "OutlyingSector",
            targetYear: 2012,
            landUsage: LandUsageType.AgriculturalDry,
            coordinates: coords,
            status: HistoricalEstimateStatus.InsufficientData,
            confidenceLevel: ConfidenceLevel.Insufficient,
            reviewStatus: HistoricalReviewStatus.SystemGenerated,
            estimatedRatePerCent: null,
            estimatedRatePerSqFt: 0.00m // FORBIDDEN
        ));
        Assert.Contains("unavailable prices as 0.00", exZeroSqFt.Message);
    }

    [Fact]
    public void HistoricalEstimate_ShouldEnforceBoundsAndRanges()
    {
        var coords = new GeoCoordinate(11.0, 77.0);

        // Verified count cannot exceed sample count
        Assert.Throws<ArgumentException>(() => new HistoricalEstimate(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", null, "Sulur", 2020,
            LandUsageType.Residential, coords, HistoricalEstimateStatus.Success,
            ConfidenceLevel.Moderate, HistoricalReviewStatus.SystemGenerated,
            estimatedRatePerCent: 2000000m, estimatedRatePerSqFt: 4500m,
            sampleCount: 5, verifiedSampleCount: 8)); // 8 > 5

        // Min cannot exceed Max
        Assert.Throws<ArgumentException>(() => new HistoricalEstimate(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", null, "Sulur", 2020,
            LandUsageType.Residential, coords, HistoricalEstimateStatus.Success,
            ConfidenceLevel.Moderate, HistoricalReviewStatus.SystemGenerated,
            estimatedRatePerCent: 2000000m, estimatedRatePerSqFt: 4500m,
            minRatePerCent: 3000000m, maxRatePerCent: 2000000m)); // Min > Max

        // Target year out of valid range
        Assert.Throws<ArgumentOutOfRangeException>(() => new HistoricalEstimate(
            Guid.NewGuid(), "India", "Tamil Nadu", "Coimbatore", null, "Sulur", 1920,
            LandUsageType.Residential, coords, HistoricalEstimateStatus.InsufficientData,
            ConfidenceLevel.Insufficient, HistoricalReviewStatus.SystemGenerated,
            null, null));
    }

    [Fact]
    public void HistoricalEstimateObservation_ShouldEnforceJunctionConstraints()
    {
        var estId = Guid.NewGuid();
        var obsId = Guid.NewGuid();

        var junction = new HistoricalEstimateObservation(
            estimateId: estId,
            observationId: obsId,
            contributionWeight: 0.8500,
            isOutlier: false,
            distanceMeters: 450.25,
            temporalOffsetMonths: -6
        );

        Assert.Equal(estId, junction.EstimateId);
        Assert.Equal(obsId, junction.ObservationId);
        Assert.Equal(0.8500, junction.ContributionWeight);
        Assert.False(junction.IsOutlier);
        Assert.Equal(450.25, junction.DistanceMeters);
        Assert.Equal(-6, junction.TemporalOffsetMonths);

        Assert.Throws<ArgumentException>(() => new HistoricalEstimateObservation(
            Guid.Empty, obsId, 0.5, false, 100, 0));

        Assert.Throws<ArgumentException>(() => new HistoricalEstimateObservation(
            estId, Guid.Empty, 0.5, false, 100, 0));

        Assert.Throws<ArgumentOutOfRangeException>(() => new HistoricalEstimateObservation(
            estId, obsId, 1.5, false, 100, 0));

        Assert.Throws<ArgumentOutOfRangeException>(() => new HistoricalEstimateObservation(
            estId, obsId, -0.1, false, 100, 0));
    }

    [Fact]
    public void LandPriceRecord_ShouldSupportSourceDocumentAndQualityFlags_WithBackwardsCompatibility()
    {
        var docId = Guid.NewGuid();
        var record = new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Trichy Road",
            surveyNumber: "142/1",
            coordinates: new GeoCoordinate(11.0012, 77.0874),
            landUsage: LandUsageType.Residential,
            area: new LandArea(5, AreaUnit.Cent),
            originalPrice: 4000000m,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "Deed 2024/1101",
            observationDate: new DateTime(2024, 3, 15, 0, 0, 0, DateTimeKind.Utc),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false,
            notes: "Verified against registered sale deed",
            sourceDocumentId: docId,
            dataQualityFlags: "SroCrossChecked,SurveyVerified"
        );

        Assert.Equal(docId, record.SourceDocumentId);
        Assert.Equal("SroCrossChecked,SurveyVerified", record.DataQualityFlags);

        // Test mutating methods
        var newDocId = Guid.NewGuid();
        record.AttachSourceDocument(newDocId);
        Assert.Equal(newDocId, record.SourceDocumentId);

        record.SetDataQualityFlags("ManualAuditApproved");
        Assert.Equal("ManualAuditApproved", record.DataQualityFlags);
    }
}
