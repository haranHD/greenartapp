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
}

