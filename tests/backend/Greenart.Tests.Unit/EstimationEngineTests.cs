using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.Estimation;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Xunit;

namespace Greenart.Tests.Unit;

public class EstimationEngineTests
{
    private class MockLandPriceRepository : ILandPriceRepository
    {
        private readonly List<LandPriceRecord> _records;

        public MockLandPriceRepository(List<LandPriceRecord> records)
        {
            _records = records;
        }

        public Task<IReadOnlyList<LandPriceRecord>> GetAllAsync(string? locality = null, LandUsageType? landUsage = null, SourceCategory? sourceCategory = null, string? district = null, CancellationToken cancellationToken = default)
        {
            var result = _records.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(locality))
                result = result.Where(r => r.Locality.Equals(locality, StringComparison.OrdinalIgnoreCase));
            if (landUsage.HasValue)
                result = result.Where(r => r.LandUsage == landUsage.Value);
            if (sourceCategory.HasValue)
                result = result.Where(r => r.SourceCategory == sourceCategory.Value);
            if (!string.IsNullOrWhiteSpace(district))
                result = result.Where(r => r.District.Equals(district, StringComparison.OrdinalIgnoreCase));

            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(result.ToList());
        }

        public Task RecordImportBatchAsync(ImportBatch batch, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<ImportBatch>> GetImportBatchesAsync(int limit = 20, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<ImportBatch>>(new List<ImportBatch>());
        public Task RecordAuditEventAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditEvent>> GetAuditEventsAsync(int limit = 50, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditEvent>>(new List<AuditEvent>());

        public Task<LandPriceRecord?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_records.FirstOrDefault(r => r.Id == id));
        }

        public Task<IReadOnlyList<LandPriceRecord>> GetNearbyComparableAsync(double latitude, double longitude, double radiusMeters, LandUsageType landUsage, CancellationToken cancellationToken = default)
        {
            var target = new GeoCoordinate(latitude, longitude);
            var result = _records
                .Where(r => r.Coordinates.IsWithinRadius(target, radiusMeters) && r.LandUsage == landUsage)
                .ToList();

            return Task.FromResult<IReadOnlyList<LandPriceRecord>>(result);
        }

        public Task<IReadOnlyList<(LandPriceRecord Record, double DistanceMeters)>> GetNearbyAsync(double latitude, double longitude, double radiusMeters, LandUsageType? landUsage = null, CancellationToken cancellationToken = default)
        {
            var target = new GeoCoordinate(latitude, longitude);
            var result = _records
                .Where(r => r.VerificationStatus != VerificationStatus.Rejected && r.VerificationStatus != VerificationStatus.Archived)
                .Where(r => !landUsage.HasValue || r.LandUsage == landUsage.Value)
                .Select(r => (Record: r, DistanceMeters: Math.Round(r.Coordinates.DistanceToMeters(target), 1)))
                .Where(x => x.DistanceMeters <= radiusMeters)
                .OrderBy(x => x.DistanceMeters)
                .ToList();

            return Task.FromResult<IReadOnlyList<(LandPriceRecord Record, double DistanceMeters)>>(result);
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
            var idx = _records.FindIndex(r => r.Id == record.Id);
            if (idx >= 0) _records[idx] = record;
            return Task.CompletedTask;
        }

        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_records.Any(r => r.Id == id));
        }
    }

    // =========================================================================
    // 1. DATA ELIGIBILITY TESTS
    // =========================================================================

    [Fact]
    public async Task WhenLessThanThreeVerifiedRecords_ShouldReturn_InsufficientDataResponse()
    {
        // Only 2 verified records near target
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(2, insufficient.ComparableRecordsFound);
        Assert.Equal(3, insufficient.MinimumRequiredRecords);
        Assert.NotEmpty(insufficient.Recommendations);
    }

    [Fact]
    public async Task AskingPrices_MustBeExcludedFromPrimaryMarketPool_AndPlacedInLayer2()
    {
        // 2 Verified deeds + 2 Asking prices
        // Market pool must contain ONLY the 2 verified deeds -> insufficient data (< 3)!
        // Asking prices must be surfaced in AskingPriceReference (Layer 2)
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m),
            CreateRecordWithStatus(11.0020, 77.0878, 1400000m, SourceCategory.AdvertisedAskingPrice, VerificationStatus.Unverified),
            CreateRecordWithStatus(11.0025, 77.0880, 1500000m, SourceCategory.AdvertisedAskingPrice, VerificationStatus.Unverified)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(2, insufficient.ComparableRecordsFound); // ONLY the 2 verified deeds counted

        // Layer 2 is populated independently
        Assert.NotNull(insufficient.AskingPriceReference);
        Assert.Equal(2, insufficient.AskingPriceReference.ListingCount);
        Assert.Equal(1450000m, insufficient.AskingPriceReference.MedianRatePerCent);
    }

    [Fact]
    public async Task GovernmentGuidelineValues_ShouldNeverBeBlendedIntoMarketPool()
    {
        // 3 verified records (1.0M, 1.1M, 1.2M) + 1 Government Guideline record (600K)
        // Guideline value must NOT drag down the market median to 1.05M!
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m),
            CreateVerifiedDeed(11.0020, 77.0878, 1200000m),
            CreateRecordWithStatus(11.0012, 77.0872, 600000m, SourceCategory.GovernmentGuideline, VerificationStatus.Verified)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);

        // Market pool contains ONLY the 3 verified deeds
        Assert.Equal(3, success.ComparableRecordCount);
        Assert.Equal(1100000.00m, success.PriceRangePerCent.MedianRate);

        // Guideline value is extracted separately
        Assert.NotNull(success.GovernmentGuidelineReference);
        Assert.Equal(600000.00m, success.GovernmentGuidelineReference.GuidelineRatePerCent);
    }

    [Fact]
    public async Task UnverifiedAndSyntheticRecords_MustBeStrictlyExcluded()
    {
        // 2 Verified deeds + 1 ClientResearch (unverified) + 1 Synthetic verified deed
        // Total eligible completed sales = 2 -> InsufficientData (< 3)
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m),
            CreateRecordWithStatus(11.0020, 77.0878, 1200000m, SourceCategory.ClientResearch, VerificationStatus.Unverified),
            CreateSyntheticRecord(11.0025, 77.0880, 1050000m)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(2, insufficient.ComparableRecordsFound);
    }

    [Fact]
    public async Task PendingReviewAndRejectedRecords_MustBeStrictlyExcluded()
    {
        // 2 Verified deeds + 1 PendingReview deed + 1 Rejected deed
        // Total eligible = 2 -> InsufficientData
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m),
            CreateRecordWithStatus(11.0020, 77.0878, 1200000m, SourceCategory.VerifiedTransaction, VerificationStatus.PendingReview),
            CreateRecordWithStatus(11.0025, 77.0880, 1300000m, SourceCategory.VerifiedTransaction, VerificationStatus.Rejected)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(2, insufficient.ComparableRecordsFound);
    }

    [Fact]
    public async Task ExpiredTransactions_OlderThan36Months_MustBeExcluded()
    {
        // 2 fresh verified deeds (2 months old) + 1 expired verified deed (40 months old)
        // Total eligible = 2 -> InsufficientData
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m, ageMonths: 2),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m, ageMonths: 5),
            CreateVerifiedDeed(11.0020, 77.0878, 1200000m, ageMonths: 40)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.Equal(2, insufficient.ComparableRecordsFound);
    }

    // =========================================================================
    // 2. THREE-LAYER SEPARATION TESTS
    // =========================================================================

    [Fact]
    public async Task ThreeDataLayers_MustRemainCleanlySegregated()
    {
        // Layer 1: 3 Verified deeds (1.0M, 1.1M, 1.2M) -> Median = 1.1M
        // Layer 2: 2 Asking prices (1.4M, 1.6M) -> Median = 1.5M
        // Layer 3: 1 Government guideline (650K)
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m),
            CreateVerifiedDeed(11.0020, 77.0878, 1200000m),
            CreateRecordWithStatus(11.0025, 77.0880, 1400000m, SourceCategory.AdvertisedAskingPrice, VerificationStatus.Unverified),
            CreateRecordWithStatus(11.0030, 77.0885, 1600000m, SourceCategory.AdvertisedAskingPrice, VerificationStatus.Unverified),
            CreateRecordWithStatus(11.0012, 77.0872, 650000m, SourceCategory.GovernmentGuideline, VerificationStatus.Verified)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);

        // Layer 1 Check:
        Assert.Equal(3, success.ComparableRecordCount);
        Assert.Equal(1100000.00m, success.PriceRangePerCent.MedianRate);
        Assert.All(success.SourceBreakdown, s => Assert.Equal(nameof(SourceCategory.VerifiedTransaction), s.Category));

        // Layer 2 Check:
        Assert.NotNull(success.AskingPriceReference);
        Assert.Equal(2, success.AskingPriceReference.ListingCount);
        Assert.Equal(1500000.00m, success.AskingPriceReference.MedianRatePerCent);
        Assert.Contains("Independent asking-price reference", success.AskingPriceReference.Notice);

        // Layer 3 Check:
        Assert.NotNull(success.GovernmentGuidelineReference);
        Assert.Equal(650000.00m, success.GovernmentGuidelineReference.GuidelineRatePerCent);
        Assert.Contains("Statutory minimum valuation benchmark", success.GovernmentGuidelineReference.LegalNotice);

        // Explanation Check:
        Assert.NotNull(success.CalculationExplanation);
        Assert.Contains("3 verified completed-sale deed(s)", success.CalculationExplanation);
        Assert.Contains("TNREGINET statutory guideline rate", success.CalculationExplanation);
        Assert.Contains("Advertised asking prices", success.CalculationExplanation);
    }

    // =========================================================================
    // 3. STATISTICAL CALCULATIONS & OUTLIER HANDLING TESTS
    // =========================================================================

    [Fact]
    public async Task SmallSampleOfThree_ShouldRetainAllRecordsWithoutDropping()
    {
        // N = 3: 1,000,000, 1,100,000, 1,200,000
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1100000m),
            CreateVerifiedDeed(11.0020, 77.0878, 1200000m)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal(3, success.ComparableRecordCount);
        Assert.Equal(1100000.00m, success.PriceRangePerCent.MedianRate);
        Assert.Equal(1000000.00m, success.PriceRangePerCent.MinRate);
        Assert.Equal(1200000.00m, success.PriceRangePerCent.MaxRate);
    }

    [Fact]
    public async Task MAD_ZeroDispersionCase_ShouldRetainAllRecords()
    {
        // 5 records where all have identical rates: 1,000,000 INR/cent
        // MAD = 0. Zero dispersion must NOT collapse fences or drop records!
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0011, 77.0871, 1000000m),
            CreateVerifiedDeed(11.0012, 77.0872, 1000000m),
            CreateVerifiedDeed(11.0013, 77.0873, 1000000m),
            CreateVerifiedDeed(11.0014, 77.0874, 1000000m)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal(5, success.ComparableRecordCount);
        Assert.Equal(1000000.00m, success.PriceRangePerCent.MedianRate);
        Assert.Contains("Zero dispersion detected", success.CalculationExplanation);
    }

    [Fact]
    public async Task MAD_ModerateSample_ShouldSafelyFilterExtremeOutlier()
    {
        // 5 records: 4 normal (1.0M, 1.05M, 1.1M, 1.15M) and 1 extreme outlier (10.0M)
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0011, 77.0871, 1050000m),
            CreateVerifiedDeed(11.0012, 77.0872, 1100000m),
            CreateVerifiedDeed(11.0013, 77.0873, 1150000m),
            CreateVerifiedDeed(11.0014, 77.0874, 10000000m) // Extreme outlier
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal(4, success.ComparableRecordCount); // Outlier filtered
        Assert.True(success.PriceRangePerCent.MaxRate <= 1200000m);
    }

    // =========================================================================
    // 4. UNIT CONVERSIONS & TOTAL VALUATION TESTS
    // =========================================================================

    [Fact]
    public async Task UnitConversion_OneCentMustEqual_435Point6SqFt()
    {
        // 3 records at 1,000,000 INR/cent
        // Rate per SqFt = 1,000,000 / 435.6 = 2,295.68 INR/sqft
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1000000m),
            CreateVerifiedDeed(11.0020, 77.0878, 1000000m)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(11.0012, 77.0874, LandUsageType.Residential, RadiusMeters: 1000);
        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.Equal(1000000.00m, success.PriceRangePerCent.MedianRate);
        Assert.Equal(2295.68m, success.PriceRangePerSqFt.MedianRate);

        // Verify conversion ratio within rounding tolerance
        var computedCentFromSqFt = Math.Round(success.PriceRangePerSqFt.MedianRate * LandArea.SqFtPerCent, 2);
        Assert.True(Math.Abs(computedCentFromSqFt - 1000000.00m) <= 5m, $"Expected within ₹5 of ₹1,000,000, got ₹{computedCentFromSqFt}");
    }

    [Fact]
    public async Task WhenTargetAreaProvided_ShouldCompute_AccurateTotalValuation()
    {
        // 3 verified deeds at 1,000,000 INR/cent (2,295.68 INR/sqft)
        // 1 statutory guideline at 600,000 INR/cent (1,377.41 INR/sqft)
        // User requests valuation for 5 Cents (2,178 SqFt)
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateVerifiedDeed(11.0015, 77.0875, 1000000m),
            CreateVerifiedDeed(11.0020, 77.0878, 1000000m),
            CreateRecordWithStatus(11.0012, 77.0872, 600000m, SourceCategory.GovernmentGuideline, VerificationStatus.Verified)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000,
            TargetArea: 5.0m,
            TargetAreaUnit: AreaUnit.Cent
        );

        var response = await engine.EstimateMarketPriceAsync(request);

        var success = Assert.IsType<EstimateSuccessResponse>(response);
        Assert.NotNull(success.TotalValuation);

        // 5 Cents = 2,178 SqFt
        Assert.Equal(5.0m, success.TotalValuation.AreaValue);
        Assert.Equal("Cent", success.TotalValuation.AreaUnit);
        Assert.Equal(2178.00m, success.TotalValuation.EquivalentSqFt);
        Assert.Equal(5.00m, success.TotalValuation.EquivalentCents);

        // Total Market Valuation = 2,295.68 * 2,178 = 4,999,991.04 INR (~5,000,000 INR)
        Assert.True(success.TotalValuation.TotalEstimatedPrice >= 4999900m && success.TotalValuation.TotalEstimatedPrice <= 5000100m);

        // Total Guideline Valuation = 1,377.41 * 2,178 = 2,999,998.98 INR (~3,000,000 INR)
        Assert.NotNull(success.TotalValuation.TotalGuidelinePrice);
        Assert.True(success.TotalValuation.TotalGuidelinePrice >= 2999900m && success.TotalValuation.TotalGuidelinePrice <= 3000100m);
    }

    [Fact]
    public async Task WhenTargetAreaProvidedAndInsufficientRecords_ShouldReturn_TotalGuidelineValuation()
    {
        // Only 1 verified deed + 1 statutory guideline at 600,000 INR/cent (1,377.41 INR/sqft)
        // User requests 10 Cents -> Total Guideline = 6,000,000 INR
        var records = new List<LandPriceRecord>
        {
            CreateVerifiedDeed(11.0010, 77.0870, 1000000m),
            CreateRecordWithStatus(11.0012, 77.0872, 600000m, SourceCategory.GovernmentGuideline, VerificationStatus.Verified)
        };

        var repo = new MockLandPriceRepository(records);
        var engine = new EstimationEngine(repo);

        var request = new CalculateEstimateRequest(
            Latitude: 11.0012,
            Longitude: 77.0874,
            LandUsage: LandUsageType.Residential,
            RadiusMeters: 1000,
            TargetArea: 10.0m,
            TargetAreaUnit: AreaUnit.Cent
        );

        var response = await engine.EstimateMarketPriceAsync(request);

        var insufficient = Assert.IsType<EstimateInsufficientDataResponse>(response);
        Assert.Equal("InsufficientData", insufficient.Status);
        Assert.NotNull(insufficient.TotalGuidelineValuation);
        // 10 Cents = 4356 SqFt * 1377.41 = 5,999,997.96 INR (~6,000,000 INR)
        Assert.True(insufficient.TotalGuidelineValuation >= 5999900m && insufficient.TotalGuidelineValuation <= 6000100m);
    }

    // =========================================================================
    // HELPER CREATORS
    // =========================================================================

    private static LandPriceRecord CreateVerifiedDeed(double lat, double lon, decimal ratePerCent, int ageMonths = 3)
    {
        var area = new LandArea(1.0m, AreaUnit.Cent);
        return new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Main Road",
            surveyNumber: "SF 100",
            coordinates: new GeoCoordinate(lat, lon),
            landUsage: LandUsageType.Residential,
            area: area,
            originalPrice: ratePerCent,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "SRO Sulur Registered Sale Deed",
            observationDate: DateTime.UtcNow.AddMonths(-ageMonths),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: false
        );
    }

    private static LandPriceRecord CreateSyntheticRecord(double lat, double lon, decimal ratePerCent)
    {
        var area = new LandArea(1.0m, AreaUnit.Cent);
        return new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Demo Plot",
            surveyNumber: "SF 999",
            coordinates: new GeoCoordinate(lat, lon),
            landUsage: LandUsageType.Residential,
            area: area,
            originalPrice: ratePerCent,
            sourceCategory: SourceCategory.VerifiedTransaction,
            sourceReference: "Synthetic Fixture",
            observationDate: DateTime.UtcNow.AddMonths(-1),
            verificationStatus: VerificationStatus.Verified,
            isSynthetic: true
        );
    }

    private static LandPriceRecord CreateRecordWithStatus(double lat, double lon, decimal ratePerCent, SourceCategory category, VerificationStatus status)
    {
        var area = new LandArea(1.0m, AreaUnit.Cent);
        return new LandPriceRecord(
            id: Guid.NewGuid(),
            country: "India",
            state: "Tamil Nadu",
            district: "Coimbatore",
            taluk: "Sulur",
            locality: "Kannampalayam",
            streetOrLandmark: "Main Road",
            surveyNumber: "SF 100",
            coordinates: new GeoCoordinate(lat, lon),
            landUsage: LandUsageType.Residential,
            area: area,
            originalPrice: ratePerCent,
            sourceCategory: category,
            sourceReference: "Ref",
            observationDate: DateTime.UtcNow.AddMonths(-2),
            verificationStatus: status,
            isSynthetic: false
        );
    }
}
