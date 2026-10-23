using System.Text;
using Greenart.Application.Services;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Repositories;
using Microsoft.Extensions.Logging.Abstractions;

namespace Greenart.Tests.Integration;

public class CsvBulkIngestionIntegrationTests
{
    private readonly NullLogger<CsvLandPriceImporter> _logger = NullLogger<CsvLandPriceImporter>.Instance;

    private static Stream CreateStream(string csvContent)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(csvContent));
    }

    [Fact]
    public async Task ProcessCsvAsync_WithValidRecords_ShouldPersistToRepository_AndAllowRetrieval()
    {
        var repo = new CoimbatorePilotRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);
        var initialCount = (await repo.GetAllAsync()).Count;

        var csv = @"locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate,district,notes
Kannampalayam,Sulur,Kavundampalayam Road,SF 955,11.0040,77.0860,Residential,4.0,Cent,4800000,AdvertisedAskingPrice,Broker #KP-955,2024-03-15,Coimbatore,Near school
Sulur,Sulur,Aerodrome Road,SF 320,11.0290,77.1260,Commercial,2.0,Cent,3200000,ClientResearch,Field Visit Sheet #44,2024-02-10,Coimbatore,Commercial plot";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false);

        Assert.Equal(2, result.TotalRows);
        Assert.Equal(2, result.ValidRows);
        Assert.Equal(2, result.ImportedRows);
        Assert.Equal(0, result.InvalidRows);

        var allRecords = await repo.GetAllAsync();
        Assert.Equal(initialCount + 2, allRecords.Count);

        var kannampalayam = allRecords.FirstOrDefault(r => r.SurveyNumber == "SF 955");
        Assert.NotNull(kannampalayam);
        Assert.Equal(1200000m, kannampalayam.NormalizedRatePerCent); // 48L / 4 cents = 12L
        Assert.Equal(VerificationStatus.Unverified, kannampalayam.VerificationStatus);
        Assert.Equal(SourceCategory.AdvertisedAskingPrice, kannampalayam.SourceCategory);
    }

    [Fact]
    public async Task ProcessCsvAsync_WithGovernmentGuideline_ShouldIsolateSourceCategory()
    {
        var repo = new CoimbatorePilotRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var csv = @"locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate
Saravanampatti,Annur,Sathy Road Main,SF 800,11.0810,76.9990,Commercial,1.0,Cent,1500000,GovernmentGuideline,TNREGINET 2024 Benchmark,2024-01-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: false);

        Assert.Equal(1, result.ValidRows);
        Assert.Equal(1, result.ImportedRows);

        var allRecords = await repo.GetAllAsync(sourceCategory: SourceCategory.GovernmentGuideline);
        var importedGuideline = allRecords.FirstOrDefault(r => r.SurveyNumber == "SF 800");

        Assert.NotNull(importedGuideline);
        Assert.Equal(SourceCategory.GovernmentGuideline, importedGuideline.SourceCategory);
        Assert.Equal(VerificationStatus.Unverified, importedGuideline.VerificationStatus);
    }

    [Fact]
    public async Task ProcessCsvAsync_WithSequentialBatches_ShouldDetectDuplicatesAcrossBatches()
    {
        var repo = new CoimbatorePilotRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);

        var batch1 = @"locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate
Sulur,Sulur,Trichy Highway,SF 777,11.0270,77.1270,Residential,3.0,Cent,3600000,AdvertisedAskingPrice,Listing #S-777,2024-02-01";

        var result1 = await importer.ProcessCsvAsync(CreateStream(batch1), dryRun: false);
        Assert.Equal(1, result1.ImportedRows);

        // Batch 2 imports the identical survey number and locality
        var batch2 = @"locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate
Sulur,Sulur,Trichy Highway,SF 777,11.0270,77.1270,Residential,3.0,Cent,3600000,AdvertisedAskingPrice,Listing #S-777,2024-02-01";

        var result2 = await importer.ProcessCsvAsync(CreateStream(batch2), dryRun: false, skipDuplicates: true);
        Assert.Equal(1, result2.TotalRows);
        Assert.Equal(1, result2.DuplicateRows);
        Assert.Equal(0, result2.ImportedRows);
        Assert.Equal(1, result2.SkippedRows);
    }

    [Fact]
    public async Task ProcessCsvAsync_PreviewMode_ShouldNeverAlterRepositoryState()
    {
        var repo = new CoimbatorePilotRepository();
        var importer = new CsvLandPriceImporter(repo, _logger);
        var baseline = (await repo.GetAllAsync()).Count;

        var csv = @"locality,latitude,longitude,landUsage,area,unit,price,sourceCategory,observationDate
Kannampalayam,11.0025,77.0875,Residential,5.0,Cent,6000000,ClientResearch,2024-03-01";

        var result = await importer.ProcessCsvAsync(CreateStream(csv), dryRun: true);

        Assert.True(result.DryRun);
        Assert.Equal(1, result.ValidRows);
        Assert.Equal(0, result.ImportedRows);

        var afterDryRun = (await repo.GetAllAsync()).Count;
        Assert.Equal(baseline, afterDryRun);
    }
}

