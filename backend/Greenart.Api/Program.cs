using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.Estimation;
using Greenart.Application.Services;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Register application and infrastructure services
builder.Services.AddSingleton<ILandPriceRepository, CoimbatorePilotRepository>();
builder.Services.AddScoped<IEstimationEngine, EstimationEngine>();
builder.Services.AddScoped<IEstimationService, EstimationService>();

// Enable CORS for frontend and mobile access
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Greenart Properties — Land Market Rate Analyst API",
        Version = "v1",
        Description = "API for spatial land price estimation, comparable record retrieval, and Coimbatore pilot reference data."
    });
});

var app = builder.Build();

app.UseCors();

// Enable Swagger in Development with clean relative path
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Greenart Properties API v1");
        c.RoutePrefix = "swagger";
    });
}

// Do not force HTTPS redirection in local dev to avoid SSL certificate errors on http://localhost:5039
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// ---------------------------------------------------------
// 1. Healthcheck Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/health", () => Results.Ok(new
{
    Status = "Healthy",
    Application = "Greenart Properties — Land Market Rate Analyst API",
    Environment = app.Environment.EnvironmentName,
    Version = "1.0.0-pilot",
    TimestampUtc = DateTime.UtcNow
}))
.WithName("GetHealth")
.WithSummary("System Health & Status")
.WithOpenApi();

// ---------------------------------------------------------
// 2. Spatial Land Price Estimation Endpoint
// ---------------------------------------------------------
app.MapPost("/api/v1/estimates/calculate", async (
    [FromBody] CalculateEstimateRequest request,
    [FromServices] IEstimationService estimationService,
    CancellationToken ct) =>
{
    if (request.Latitude < -90.0 || request.Latitude > 90.0)
    {
        return Results.BadRequest(new { Error = "Latitude must be between -90.0 and 90.0." });
    }

    if (request.Longitude < -180.0 || request.Longitude > 180.0)
    {
        return Results.BadRequest(new { Error = "Longitude must be between -180.0 and 180.0." });
    }

    var result = await estimationService.CalculateEstimateAsync(request, ct);
    return Results.Ok(result);
})
.WithName("CalculateEstimate")
.WithSummary("Calculate Indicative Land Market Rate")
.WithDescription("Queries comparable land records within a 1,000-meter radius of the selected coordinates and returns median/percentile ranges or an InsufficientData notice.")
.WithOpenApi();

// ---------------------------------------------------------
// 3. Land Records Registry Query Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/land-records", async (
    [FromQuery] string? locality,
    [FromQuery] LandUsageType? landUsage,
    [FromQuery] SourceCategory? sourceCategory,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    var records = await repository.GetAllAsync(locality, landUsage, sourceCategory, ct);
    var dtos = records.Select(r => new LandRecordDto(
        r.Id,
        r.Country,
        r.State,
        r.District,
        r.Taluk,
        r.Locality,
        r.StreetOrLandmark,
        r.SurveyNumber,
        r.Latitude,
        r.Longitude,
        r.LandUsage.ToString(),
        r.OriginalArea,
        r.OriginalUnit.ToString(),
        r.OriginalPrice,
        r.NormalizedRatePerCent,
        r.NormalizedRatePerSqFt,
        r.SourceCategory.ToString(),
        r.SourceReference,
        r.ObservationDate,
        r.VerificationStatus.ToString(),
        r.IsSynthetic,
        r.Notes
    ));

    return Results.Ok(dtos);
})
.WithName("GetLandRecords")
.WithSummary("List Land Price Records")
.WithDescription("Retrieve filtered land price records across Coimbatore pilot areas (Kannampalayam, Sulur, Saravanampatti).")
.WithOpenApi();

// ---------------------------------------------------------
// 4. Get Land Record by ID
// ---------------------------------------------------------
app.MapGet("/api/v1/land-records/{id:guid}", async (
    Guid id,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    var record = await repository.GetByIdAsync(id, ct);
    if (record == null)
    {
        return Results.NotFound(new { Error = $"Land record with ID {id} was not found." });
    }

    var dto = new LandRecordDto(
        record.Id,
        record.Country,
        record.State,
        record.District,
        record.Taluk,
        record.Locality,
        record.StreetOrLandmark,
        record.SurveyNumber,
        record.Latitude,
        record.Longitude,
        record.LandUsage.ToString(),
        record.OriginalArea,
        record.OriginalUnit.ToString(),
        record.OriginalPrice,
        record.NormalizedRatePerCent,
        record.NormalizedRatePerSqFt,
        record.SourceCategory.ToString(),
        record.SourceReference,
        record.ObservationDate,
        record.VerificationStatus.ToString(),
        record.IsSynthetic,
        record.Notes
    );

    return Results.Ok(dto);
})
.WithName("GetLandRecordById")
.WithSummary("Get Single Land Record Details")
.WithOpenApi();

// ---------------------------------------------------------
// 5. Reference Pilot Localities Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/reference/localities", () =>
{
    var localities = new List<LocalityReferenceDto>
    {
        new("Kannampalayam", "Coimbatore", 11.0012, 77.0874, 650000m, 1492.20m, 5),
        new("Sulur", "Coimbatore", 11.0264, 77.1275, 800000m, 1836.55m, 4),
        new("Saravanampatti", "Coimbatore", 11.0805, 76.9976, 1200000m, 2754.82m, 4),
        new("Pollachi", "Coimbatore", 10.6609, 77.0089, 450000m, 1033.06m, 1)
    };

    return Results.Ok(localities);
})
.WithName("GetReferenceLocalities")
.WithSummary("Get Pilot Localities Reference")
.WithDescription("Returns supported Coimbatore pilot localities with coordinates and baseline guideline benchmarks.")
.WithOpenApi();

app.Run();
