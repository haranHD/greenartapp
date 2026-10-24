using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Greenart.Tests.Integration;

public class CsvImportEndpointHttpTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string AdminKey = "greenart-admin-secret-key-2024";

    public CsvImportEndpointHttpTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ILandPriceRepository));
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }
                services.AddScoped<ILandPriceRepository, CoimbatorePilotRepository>();
            });
        });
    }

    [Fact]
    public async Task GetCsvTemplate_ShouldReturn200Ok_WithCsvHeaders()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/land-records/import/csv-template");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude", content);
        Assert.Contains("Kannampalayam", content);
    }

    [Fact]
    public async Task ImportCsv_WithoutAdminKey_ShouldReturn401Unauthorized()
    {
        var client = _factory.CreateClient();

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("locality,latitude,longitude\nKannampalayam,11.001,77.087"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("text/csv");
        content.Add(fileContent, "file", "records.csv");

        var response = await client.PostAsync("/api/v1/land-records/import/csv", content);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ImportCsv_WithInvalidAdminKey_ShouldReturn401Unauthorized()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", "invalid-fake-key-1234");

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("locality,latitude,longitude\nKannampalayam,11.001,77.087"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("text/csv");
        content.Add(fileContent, "file", "records.csv");

        var response = await client.PostAsync("/api/v1/land-records/import/csv", content);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ImportCsv_WithValidKey_AndNonCsvFile_ShouldReturn400BadRequest()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("binary executable content"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/octet-stream");
        content.Add(fileContent, "file", "malicious_file.exe");

        var response = await client.PostAsync("/api/v1/land-records/import/csv", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("Invalid file type", json);
    }

    [Fact]
    public async Task ImportCsv_WithValidKey_AndDryRun_ShouldReturnBatchSummaryResponse()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);

        var csv = "locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate\r\n" +
                  "Sulur,Sulur,Airport Bypass,SF 555/1,11.0265,77.1275,Residential,3.0,Cent,3600000,AdvertisedAskingPrice,Listing #S-555,2024-03-01\r\n";

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("text/csv");
        content.Add(fileContent, "file", "sulur_records.csv");

        var response = await client.PostAsync("/api/v1/land-records/import/csv?dryRun=true&skipDuplicates=true", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        var summary = JsonSerializer.Deserialize<BatchImportSummaryResponse>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(summary);
        Assert.True(summary.DryRun);
        Assert.Equal(1, summary.TotalRows);
        Assert.Equal(1, summary.ValidRows);
        Assert.Equal(0, summary.ImportedRows); // dryRun = true
        Assert.Single(summary.Previews);
        Assert.Equal("Unverified", summary.Previews[0].VerificationStatus);
    }

    [Fact]
    public async Task ImportCsv_WithMissingRequiredHeaders_ShouldReturnDiagnostics()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);

        var badCsv = "wrong_header1,wrong_header2\r\nvalue1,value2\r\n";

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(badCsv));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("text/csv");
        content.Add(fileContent, "file", "invalid_headers.csv");

        var response = await client.PostAsync("/api/v1/land-records/import/csv?dryRun=true", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        var summary = JsonSerializer.Deserialize<BatchImportSummaryResponse>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(summary);
        Assert.Equal(0, summary.ValidRows);
        Assert.True(summary.InvalidRows > 0);
        Assert.NotEmpty(summary.Diagnostics);
        Assert.Equal("Headers", summary.Diagnostics[0].Field);
        Assert.Contains("Missing required CSV column", summary.Diagnostics[0].Message);
    }

    [Fact]
    public async Task PatchVerification_PendingReview_WithAdminKey_ShouldReturn200Ok()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var recordId = Guid.Parse("11111111-1111-1111-1111-111111111101");

        var requestBody = new
        {
            Status = 1, // PendingReview
            AuditNote = "Field verification pending on site inspection"
        };

        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await client.PatchAsync($"/api/v1/land-records/{recordId}/verification", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<LandRecordDto>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(result);
        Assert.Equal("PendingReview", result.VerificationStatus);
        Assert.Contains("PendingReview: Field verification pending", result.Notes);
    }

    [Fact]
    public async Task PatchVerification_WithoutAdminKey_ShouldReturn401Unauthorized()
    {
        var client = _factory.CreateClient();
        var recordId = Guid.Parse("11111111-1111-1111-1111-111111111101");

        var requestBody = new { Status = 2, AuditNote = "Unauthorized attempt" };
        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        var response = await client.PatchAsync($"/api/v1/land-records/{recordId}/verification", content);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PatchVerification_WithInvalidAdminKey_ShouldReturn401Unauthorized()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", "invalid-key-9999");
        var recordId = Guid.Parse("11111111-1111-1111-1111-111111111101");

        var requestBody = new { Status = 2, AuditNote = "Invalid key attempt" };
        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        var response = await client.PatchAsync($"/api/v1/land-records/{recordId}/verification", content);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PatchVerification_NonExistentRecord_ShouldReturn404NotFound()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var missingId = Guid.NewGuid();

        var requestBody = new { Status = 2, AuditNote = "Validating non-existent record" };
        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        var response = await client.PatchAsync($"/api/v1/land-records/{missingId}/verification", content);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PatchVerification_UnsupportedStatus_ShouldReturn400BadRequest()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);
        var recordId = Guid.Parse("11111111-1111-1111-1111-111111111101");

        var requestBody = new { Status = 99, AuditNote = "Invalid status" };
        var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        var response = await client.PatchAsync($"/api/v1/land-records/{recordId}/verification", content);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateLandRecord_WithoutAdminKey_ShouldReturn401Unauthorized()
    {
        var client = _factory.CreateClient();

        var request = new
        {
            Locality = "Kannampalayam",
            Latitude = 11.0012,
            Longitude = 77.0874,
            LandUsage = 1,
            Area = 3.0,
            Unit = 2,
            Price = 3000000,
            SourceCategory = 2
        };

        var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/land-records", content);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateLandRecord_WithInvalidAdminKey_ShouldReturn401Unauthorized()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", "bad-key-123");

        var request = new
        {
            Locality = "Kannampalayam",
            Latitude = 11.0012,
            Longitude = 77.0874,
            LandUsage = 1,
            Area = 3.0,
            Unit = 2,
            Price = 3000000,
            SourceCategory = 2
        };

        var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/land-records", content);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateLandRecord_WithValidAdminKey_ShouldReturn201Created()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", AdminKey);

        var request = new
        {
            Country = "India",
            State = "Tamil Nadu",
            District = "Coimbatore",
            Taluk = "Sulur",
            Locality = "Kannampalayam",
            StreetOrLandmark = "SRO Branch Road",
            SurveyNumber = "SF 777/A",
            Latitude = 11.0022,
            Longitude = 77.0868,
            LandUsage = 1,
            Area = 3.0,
            Unit = 2, // Cent
            Price = 3600000,
            SourceCategory = 2 // VerifiedTransaction
        };

        var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/land-records", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var record = JsonSerializer.Deserialize<LandRecordDto>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(record);
        Assert.Equal("Kannampalayam", record.Locality);
        Assert.Equal("Unverified", record.VerificationStatus); // Always starts Unverified
        Assert.Equal(1200000m, record.NormalizedRatePerCent);
    }

    [Fact]
    public async Task PublicEndpoints_ShouldRemainAccessibleWithoutAdminKey()
    {
        var client = _factory.CreateClient();

        // 1. Health endpoint (returns 200 OK when DB is reachable, or 503 when unseeded; never 401)
        var healthRes = await client.GetAsync("/api/v1/health");
        Assert.NotEqual(HttpStatusCode.Unauthorized, healthRes.StatusCode);

        // 2. Reference localities
        var locRes = await client.GetAsync("/api/v1/reference/localities");
        Assert.Equal(HttpStatusCode.OK, locRes.StatusCode);

        // 3. Public land records listing
        var recordsRes = await client.GetAsync("/api/v1/land-records?locality=Kannampalayam");
        Assert.Equal(HttpStatusCode.OK, recordsRes.StatusCode);

        // 4. Public nearby records
        var nearbyRes = await client.GetAsync("/api/v1/land-records/nearby?latitude=11.0012&longitude=77.0874&radiusMeters=1000");
        Assert.Equal(HttpStatusCode.OK, nearbyRes.StatusCode);

        // 5. Estimate calculate endpoint
        var estimatePayload = new
        {
            Latitude = 11.0012,
            Longitude = 77.0874,
            LandUsage = 1,
            RadiusMeters = 1000
        };
        var estimateContent = new StringContent(JsonSerializer.Serialize(estimatePayload), Encoding.UTF8, "application/json");
        var estimateRes = await client.PostAsync("/api/v1/estimates/calculate", estimateContent);
        Assert.Equal(HttpStatusCode.OK, estimateRes.StatusCode);
    }
}

