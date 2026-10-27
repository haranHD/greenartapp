using Microsoft.AspNetCore.HttpOverrides;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.Estimation;
using Greenart.Application.Services;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Greenart.Infrastructure.Persistence.Seeding;
using Greenart.Infrastructure.Providers;
using Greenart.Infrastructure.Repositories;
using Greenart.Infrastructure.Services;
using Greenart.Infrastructure.Configuration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Cloud PaaS port binding (e.g. Render, Railway, Cloud Run injects PORT env variable)
var renderPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(renderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
}

// Load .env configuration if present in project or solution root
var envCandidatePaths = new[]
{
    Path.Combine(builder.Environment.ContentRootPath, ".env"),
    Path.Combine(builder.Environment.ContentRootPath, "..", "..", ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), ".env")
};

foreach (var envPath in envCandidatePaths)
{
    if (File.Exists(envPath))
    {
        foreach (var line in File.ReadAllLines(envPath))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith('#') || !trimmed.Contains('='))
                continue;

            var parts = trimmed.Split('=', 2);
            var key = parts[0].Trim();
            var val = parts[1].Trim().Trim('"', '\'');
            if (!string.IsNullOrEmpty(key) && string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
                Environment.SetEnvironmentVariable(key, val);
            }
        }
        break;
    }
}

// Helper to normalize postgres:// and postgresql:// URIs into standard ADO.NET connection strings
static string NormalizePostgresConnectionString(string connection)
{
    if (string.IsNullOrWhiteSpace(connection)) return connection;

    if (connection.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        connection.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(connection);
            var userInfo = uri.UserInfo.Split(':');
            var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var host = uri.Host;
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');

            var builder = new Npgsql.NpgsqlConnectionStringBuilder
            {
                Host = host,
                Port = port,
                Database = database,
                Username = username,
                Password = password,
                SslMode = Npgsql.SslMode.Prefer
            };
            return builder.ConnectionString;
        }
        catch
        {
            return connection;
        }
    }

    return connection;
}

// Configure PostgreSQL + PostGIS Persistence
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? builder.Configuration["DB_CONNECTION_STRING"]
    ?? Environment.GetEnvironmentVariable("DB_CONNECTION_STRING")
    ?? "Host=localhost;Port=5432;Database=greenart_db;Username=postgres";

var connectionString = NormalizePostgresConnectionString(rawConnectionString);

// If connection string lacks password, check DB_PASSWORD
var dbPassword = builder.Configuration["DB_PASSWORD"] ?? Environment.GetEnvironmentVariable("DB_PASSWORD");
if (!string.IsNullOrWhiteSpace(connectionString) && !connectionString.Contains("Password=", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(dbPassword))
{
    connectionString = $"{connectionString.TrimEnd(';')};Password={dbPassword}";
}

builder.Services.AddDbContext<LandPriceDbContext>(options =>
{
    options.UseNpgsql(connectionString, o => o.UseNetTopologySuite());
});

// Register application and infrastructure services
builder.Services.AddScoped<ILandPriceRepository, EfLandPriceRepository>();
builder.Services.AddScoped<IEstimationEngine, EstimationEngine>();
builder.Services.AddScoped<IEstimationService, EstimationService>();
builder.Services.AddScoped<ICsvLandPriceImporter, CsvLandPriceImporter>();
builder.Services.AddScoped<ILandPriceDataProvider, InternalSurveyorDataProvider>();
builder.Services.AddScoped<ILandPriceDataProvider, TnReginetGuidelineProvider>();
builder.Services.AddScoped<ILandPriceDataProvider, CommercialPropTechDataProvider>();
builder.Services.AddScoped<IDataProviderRegistry, DataProviderRegistry>();
builder.Services.AddScoped<IMlReadinessService, MlReadinessService>();

// Register Geocoding and Locality Search Proxy
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<IGeocodingService, GooglePlacesGeocodingService>();

// Register LandLens API Client
builder.Services.AddHttpClient<ILandLensClient, LandLensClient>();

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

// Configure JSON serializer to support both string and numeric enums
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
{
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
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

// 1. Forwarded Headers for Cloud PaaS (Render, Cloudflare, etc.)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// 2. Resilient Global CORS & Error Handling Middleware (Always active, attaches CORS headers to all responses)
app.Use(async (context, next) =>
{
    context.Response.Headers["Access-Control-Allow-Origin"] = "*";
    context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
    context.Response.Headers["Access-Control-Allow-Headers"] = "*";

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    try
    {
        await next();
    }
    catch (Exception ex)
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Server error handling request {Path}", context.Request.Path);

        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Access-Control-Allow-Origin"] = "*";
            await context.Response.WriteAsJsonAsync(new
            {
                status = "error",
                message = "An error occurred while processing your request.",
                detail = ex.Message
            });
        }
    }
});

app.UseCors();

// Enable Swagger in all environments (Development, Staging, and Production) for client demo & API documentation
app.Use(async (context, next) =>
{
    if (context.Request.Path.Value?.EndsWith("/swagger.json", StringComparison.OrdinalIgnoreCase) == true)
    {
        var originalBodyStream = context.Response.Body;
        using var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        await next();

        if (context.Response.StatusCode == StatusCodes.Status200OK)
        {
            responseBody.Seek(0, SeekOrigin.Begin);
            using var reader = new StreamReader(responseBody);
            var json = await reader.ReadToEndAsync();

            if (json.Contains("\"openapi\": \"3.0.4\""))
            {
                json = json.Replace("\"openapi\": \"3.0.4\"", "\"openapi\": \"3.0.1\"");
            }

            var bytes = System.Text.Encoding.UTF8.GetBytes(json);
            context.Response.Body = originalBodyStream;
            context.Response.ContentLength = bytes.Length;
            await context.Response.Body.WriteAsync(bytes);
        }
        else
        {
            context.Response.Body = originalBodyStream;
            responseBody.Seek(0, SeekOrigin.Begin);
            await responseBody.CopyToAsync(originalBodyStream);
        }
        return;
    }

    await next();
});

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Greenart Properties API v1");
    c.RoutePrefix = "swagger";
});

// Root redirect to Swagger
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

// API v1 welcome & status endpoint (Prevents 404 when directly visiting /api/v1)
app.MapGet("/api/v1", () => Results.Ok(new
{
    status = "online",
    application = "Greenart Properties — Land Market Rate Analyst API",
    version = "1.0.0-pilot",
    documentation = "/swagger",
    health = "/api/v1/health",
    endpoints = new
    {
        health = "/api/v1/health",
        localities = "/api/v1/reference/localities",
        estimates = "/api/v1/estimates/calculate",
        records = "/api/v1/land-records",
        nearby = "/api/v1/land-records/nearby",
        coverage = "/api/v1/coverage/summary",
        mlReadiness = "/api/v1/ml/readiness"
    }
})).ExcludeFromDescription();

app.MapGet("/api", () => Results.Redirect("/api/v1")).ExcludeFromDescription();

// Controlled database startup migration and health diagnostic
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var dbContext = services.GetRequiredService<LandPriceDbContext>();
        if (await dbContext.Database.CanConnectAsync())
        {
            var pendingMigrations = (await dbContext.Database.GetPendingMigrationsAsync()).ToList();
            bool isDev = app.Environment.IsDevelopment();
            bool autoMigrateConfigured = app.Configuration.GetValue<bool>("Database:AutoMigrate", false);

            if (pendingMigrations.Count > 0)
            {
                if (isDev && autoMigrateConfigured)
                {
                    logger.LogInformation("Development auto-migration enabled: applying {Count} pending migration(s)...", pendingMigrations.Count);
                    await dbContext.Database.MigrateAsync();
                    await LandPriceDataSeeder.SeedAsync(dbContext, logger);
                }
                else
                {
                    logger.LogWarning(
                        "Database has {Count} pending migration(s) ({Migrations}). Automatic migration is DISABLED in environment '{Env}' (Database:AutoMigrate={Flag}). Schema will NOT be modified. To apply migrations manually, run: dotnet ef database update --project Greenart.Infrastructure --startup-project Greenart.Api",
                        pendingMigrations.Count,
                        string.Join(", ", pendingMigrations),
                        app.Environment.EnvironmentName,
                        autoMigrateConfigured);
                }
            }
            else
            {
                logger.LogInformation("Database schema is up to date. No pending migrations.");
                if (isDev && autoMigrateConfigured)
                {
                    await LandPriceDataSeeder.SeedAsync(dbContext, logger);
                }
            }
        }
        else
        {
            logger.LogWarning("PostgreSQL database is currently unreachable. Database migration and seeding postponed.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Notice: Database startup diagnostic encountered an exception: {Message}", ex.Message);
    }
}

// ---------------------------------------------------------
// 1. Healthcheck Endpoint (Probes DB & PostGIS Extension)
// ---------------------------------------------------------
app.MapGet("/api/v1/health", async (
    [FromServices] LandPriceDbContext dbContext,
    CancellationToken ct) =>
{
    bool dbConnected = false;
    bool postgisEnabled = false;
    string? postgisVersion = null;
    int pendingMigrationsCount = 0;

    try
    {
        dbConnected = await dbContext.Database.CanConnectAsync(ct);
        if (dbConnected)
        {
            await using var conn = (NpgsqlConnection)dbContext.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
            {
                await conn.OpenAsync(ct);
            }

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT PostGIS_Version();";
            var result = await cmd.ExecuteScalarAsync(ct);
            if (result != null)
            {
                postgisEnabled = true;
                postgisVersion = result.ToString();
            }

            var pendingList = await dbContext.Database.GetPendingMigrationsAsync(ct);
            pendingMigrationsCount = pendingList.Count();
        }
    }
    catch
    {
        // Suppress detailed connection exceptions to prevent secret leakage
    }

    var isHealthy = dbConnected && postgisEnabled;

    var response = new
    {
        Status = isHealthy ? "Healthy" : "Degraded",
        Application = "Greenart Properties — Land Market Rate Analyst API",
        Environment = app.Environment.EnvironmentName,
        Version = "1.0.0-pilot",
        Database = new
        {
            Connected = dbConnected,
            PostgisEnabled = postgisEnabled,
            PostgisVersion = postgisVersion ?? "Unavailable",
            Engine = "PostgreSQL 16 + PostGIS",
            PendingMigrations = pendingMigrationsCount,
            SchemaStatus = pendingMigrationsCount > 0 ? "PendingMigrations" : "UpToDate"
        },
        TimestampUtc = DateTime.UtcNow
    };

    return isHealthy ? Results.Ok(response) : Results.Json(response, statusCode: 503);
})
.WithName("GetHealth")
.WithSummary("System Health & Database Status")
.WithDescription("Checks application availability, PostgreSQL connectivity, and PostGIS spatial extension status.")
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

    if (TamilNaduGeoBounds.AreCoordinatesTransposed(request.Latitude, request.Longitude))
    {
        return Results.BadRequest(new { Error = "Coordinates appear to be transposed (Latitude in India is [6-38], Longitude is [68-98])." });
    }

    if (!TamilNaduGeoBounds.IsWithinIndia(request.Latitude, request.Longitude))
    {
        return Results.BadRequest(new { Error = $"Coordinates ({request.Latitude:F4}, {request.Longitude:F4}) fall outside Indian geographic territory." });
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
    [FromQuery] string? district,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    var records = await repository.GetAllAsync(locality, landUsage, sourceCategory, district, ct);
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
// 3b. Dedicated Server-Side Spatial Nearby Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/land-records/nearby", async (
    [FromQuery] double? latitude,
    [FromQuery] double? longitude,
    [FromQuery] double? radiusMeters,
    [FromQuery] LandUsageType? landUsage,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    if (!latitude.HasValue || !longitude.HasValue)
    {
        return Results.BadRequest(new { Error = "Both latitude and longitude query parameters are required." });
    }

    var lat = latitude.Value;
    var lng = longitude.Value;

    if (lat < -90.0 || lat > 90.0)
    {
        return Results.BadRequest(new { Error = "Latitude must be between -90.0 and 90.0." });
    }

    if (lng < -180.0 || lng > 180.0)
    {
        return Results.BadRequest(new { Error = "Longitude must be between -180.0 and 180.0." });
    }

    if (TamilNaduGeoBounds.AreCoordinatesTransposed(lat, lng))
    {
        return Results.BadRequest(new { Error = "Coordinates appear to be transposed (Latitude in India is [6-38], Longitude is [68-98])." });
    }

    if (!TamilNaduGeoBounds.IsWithinIndia(lat, lng))
    {
        return Results.BadRequest(new { Error = $"Coordinates ({lat:F4}, {lng:F4}) fall outside Indian geographic territory." });
    }

    var radius = radiusMeters.GetValueOrDefault(1000.0);
    if (radius <= 0 || radius > 10000.0)
    {
        return Results.BadRequest(new { Error = "Radius must be greater than 0 and not exceed 10,000 meters." });
    }

    if (landUsage.HasValue && !Enum.IsDefined(typeof(LandUsageType), landUsage.Value))
    {
        return Results.BadRequest(new { Error = $"Invalid landUsage value: {landUsage.Value}." });
    }

    var results = await repository.GetNearbyAsync(lat, lng, radius, landUsage, ct);

    var dtos = results.Select(item => new NearbyLandRecordDto(
        item.Record.Id,
        item.Record.Country,
        item.Record.State,
        item.Record.District,
        item.Record.Taluk,
        item.Record.Locality,
        item.Record.StreetOrLandmark,
        item.Record.SurveyNumber,
        item.Record.Latitude,
        item.Record.Longitude,
        item.Record.LandUsage.ToString(),
        item.Record.OriginalArea,
        item.Record.OriginalUnit.ToString(),
        item.Record.OriginalPrice,
        item.Record.NormalizedRatePerCent,
        item.Record.NormalizedRatePerSqFt,
        item.Record.SourceCategory.ToString(),
        item.Record.SourceReference,
        item.Record.ObservationDate,
        item.Record.VerificationStatus.ToString(),
        item.Record.IsSynthetic,
        item.Record.Notes,
        item.DistanceMeters
    )).ToList();

    return Results.Ok(dtos);
})
.WithName("GetNearbyLandRecords")
.WithSummary("Retrieve Nearby Land Records Within Spatial Radius")
.WithDescription("Performs a PostGIS spatial query returning eligible land records within the requested geodesic radius sorted by increasing distance.")
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
// Administrative Authorization Helper
// ---------------------------------------------------------
static bool IsAuthorizedAdmin(string? adminKey, IConfiguration config)
{
    var configuredKey = config["AdminSettings:ApiKey"]
        ?? config["ADMIN_API_KEY"]
        ?? "greenart-admin-secret-key-2024";

    return !string.IsNullOrWhiteSpace(adminKey) && string.Equals(adminKey.Trim(), configuredKey.Trim(), StringComparison.Ordinal);
}

// ---------------------------------------------------------
// 5. Create New Land Record Endpoint
// ---------------------------------------------------------
app.MapPost("/api/v1/land-records", async (
    [FromBody] CreateLandRecordRequest request,
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] IConfiguration config,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }
    if (string.IsNullOrWhiteSpace(request.Locality))
    {
        return Results.BadRequest(new { Error = "Locality is required." });
    }

    if (request.Latitude < -90.0 || request.Latitude > 90.0)
    {
        return Results.BadRequest(new { Error = "Latitude must be between -90.0 and 90.0." });
    }

    if (request.Longitude < -180.0 || request.Longitude > 180.0)
    {
        return Results.BadRequest(new { Error = "Longitude must be between -180.0 and 180.0." });
    }

    if (TamilNaduGeoBounds.AreCoordinatesTransposed(request.Latitude, request.Longitude))
    {
        return Results.BadRequest(new { Error = "Coordinates appear to be transposed (Latitude in India is [6-38], Longitude is [68-98])." });
    }

    if (!TamilNaduGeoBounds.IsWithinIndia(request.Latitude, request.Longitude))
    {
        return Results.BadRequest(new { Error = $"Coordinates ({request.Latitude:F4}, {request.Longitude:F4}) fall outside Indian geographic territory." });
    }

    if (request.Price <= 0)
    {
        return Results.BadRequest(new { Error = "Price must be strictly positive." });
    }

    if (request.Area <= 0)
    {
        return Results.BadRequest(new { Error = "Area must be strictly positive." });
    }

    // Default status is Unverified unless audited by administrator
    var record = new LandPriceRecord(
        id: Guid.NewGuid(),
        country: string.IsNullOrWhiteSpace(request.Country) ? "India" : request.Country.Trim(),
        state: string.IsNullOrWhiteSpace(request.State) ? "Tamil Nadu" : request.State.Trim(),
        district: TamilNaduGeoBounds.NormalizeDistrict(request.District, "Coimbatore"),
        taluk: request.Taluk,
        locality: request.Locality.Trim(),
        streetOrLandmark: request.StreetOrLandmark?.Trim(),
        surveyNumber: request.SurveyNumber?.Trim(),
        coordinates: new GeoCoordinate(request.Latitude, request.Longitude),
        landUsage: request.LandUsage,
        area: new LandArea(request.Area, request.Unit),
        originalPrice: request.Price,
        sourceCategory: request.SourceCategory,
        sourceReference: request.SourceReference?.Trim(),
        observationDate: request.ObservationDate ?? DateTime.UtcNow,
        verificationStatus: VerificationStatus.Unverified,
        isSynthetic: false,
        notes: request.Notes?.Trim()
    );

    await repository.AddAsync(record, ct);

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

    return Results.Created($"/api/v1/land-records/{record.Id}", dto);
})
.WithName("CreateLandRecord")
.WithSummary("Create and Persist New Land Record")
.WithDescription("Inserts a validated land record into PostgreSQL + PostGIS, automatically computing normalized unit rates and geographical Point.")
.WithOpenApi();

// ---------------------------------------------------------
// 6. Update Land Record Verification Status Endpoint
// ---------------------------------------------------------
app.MapPatch("/api/v1/land-records/{id:guid}/verification", async (
    Guid id,
    [FromBody] UpdateVerificationRequest request,
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] IConfiguration config,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }

    var record = await repository.GetByIdAsync(id, ct);
    if (record == null)
    {
        return Results.NotFound(new { Error = $"Land record with ID {id} was not found." });
    }

    switch (request.Status)
    {
        case VerificationStatus.Verified:
            record.MarkVerified(request.AuditNote);
            break;
        case VerificationStatus.PendingReview:
            record.MarkPendingReview(request.AuditNote);
            break;
        case VerificationStatus.Rejected:
            record.MarkRejected(request.AuditNote ?? "Rejected by administrative audit.");
            break;
        case VerificationStatus.Archived:
            record.Archive(request.AuditNote ?? "Archived by administrative audit.");
            break;
        default:
            return Results.BadRequest(new { Error = $"Unsupported status transition to '{request.Status}'." });
    }

    await repository.UpdateAsync(record, ct);

    var auditEvent = new AuditEvent(
        id: Guid.NewGuid(),
        entityType: "LandPriceRecord",
        entityId: record.Id,
        action: $"VerificationStatusChanged:{request.Status}",
        performedBy: "Administrator",
        details: request.AuditNote ?? $"Status transitioned to {request.Status}"
    );
    try
    {
        await repository.RecordAuditEventAsync(auditEvent, ct);
    }
    catch
    {
        // Suppress audit log failure if audit table not initialized
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
.WithName("UpdateVerificationStatus")
.WithSummary("Update Land Record Verification Status")
.WithDescription("Transitions land record verification status to Verified, Rejected, or Archived.")
.WithOpenApi();

// ---------------------------------------------------------
// 5. Reference Pilot Localities Endpoint (Database-Aggregated)
// ---------------------------------------------------------
app.MapGet("/api/v1/reference/localities", async (
    [FromQuery] string? district,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    var records = await repository.GetAllAsync(district: district, cancellationToken: ct);

    if (records.Count == 0)
    {
        // Only provide baseline fallback if no district was specified or Coimbatore was specifically queried
        if (string.IsNullOrWhiteSpace(district) || district.Equals("Coimbatore", StringComparison.OrdinalIgnoreCase))
        {
            var fallback = new List<LocalityReferenceDto>
            {
                new("Kannampalayam", "Coimbatore", 11.0012, 77.0874, 650000m, 1492.20m, 0),
                new("Sulur", "Coimbatore", 11.0264, 77.1275, 800000m, 1836.55m, 0),
                new("Saravanampatti", "Coimbatore", 11.0805, 76.9976, 1200000m, 2754.82m, 0),
                new("Pollachi", "Coimbatore", 10.6609, 77.0089, 450000m, 1033.06m, 0)
            };
            return Results.Ok(fallback);
        }

        // Return empty list if a specific district filter yielded zero records
        return Results.Ok(Array.Empty<LocalityReferenceDto>());
    }

    var localities = records
        .GroupBy(r => r.Locality, StringComparer.OrdinalIgnoreCase)
        .Select(g =>
        {
            var localityName = g.Key;
            var dist = g.First().District;
            var avgLat = Math.Round(g.Average(r => r.Latitude), 4);
            var avgLon = Math.Round(g.Average(r => r.Longitude), 4);

            var guideline = g.FirstOrDefault(r => r.SourceCategory == SourceCategory.GovernmentGuideline);
            var guidelinePerCent = guideline?.NormalizedRatePerCent ?? Math.Round(g.Average(r => r.NormalizedRatePerCent), 2);
            var guidelinePerSqFt = guideline?.NormalizedRatePerSqFt ?? Math.Round(g.Average(r => r.NormalizedRatePerSqFt), 2);

            return new LocalityReferenceDto(
                localityName,
                dist,
                avgLat,
                avgLon,
                guidelinePerCent,
                guidelinePerSqFt,
                g.Count()
            );
        })
        .OrderBy(l => l.Name)
        .ToList();

    return Results.Ok(localities);
})
.WithName("GetReferenceLocalities")
.WithSummary("Get Pilot Localities Reference")
.WithDescription("Returns supported pilot localities with coordinates and baseline guideline benchmarks aggregated from the database.")
.WithOpenApi();

// ---------------------------------------------------------
// 6. External Geocoding & Locality Search Proxy Endpoints
// ---------------------------------------------------------
app.MapGet("/api/v1/localities/search", async (
    [FromQuery] string? q,
    [FromServices] IGeocodingService geocodingService,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
    {
        return Results.Ok(Array.Empty<LocalitySuggestionDto>());
    }

    if (q.Length > 100)
    {
        return Results.BadRequest(new { Error = "Query length cannot exceed 100 characters." });
    }

    var suggestions = await geocodingService.SearchLocalitiesAsync(q.Trim(), ct);
    return Results.Ok(suggestions);
})
.WithName("SearchLocalities")
.WithSummary("Search Localities and Places")
.WithDescription("Queries Google Places API (New) via a secure backend proxy with 30-minute caching and zero client secret exposure.")
.WithOpenApi();

app.MapGet("/api/v1/localities/details", async (
    [FromQuery] string? placeId,
    [FromServices] IGeocodingService geocodingService,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(placeId))
    {
        return Results.BadRequest(new { Error = "placeId parameter is required." });
    }

    if (placeId.Length > 200)
    {
        return Results.BadRequest(new { Error = "placeId length cannot exceed 200 characters." });
    }

    var details = await geocodingService.GetPlaceDetailsAsync(placeId.Trim(), ct);
    if (details == null)
    {
        return Results.NotFound(new { Error = $"Locality details for placeId '{placeId}' could not be resolved." });
    }

    return Results.Ok(details);
})
.WithName("GetLocalityDetails")
.WithSummary("Get Place Details & Geographic Coordinates")
.WithDescription("Resolves coordinates, formatted address, and administrative hierarchy for a place identifier with 24-hour caching.")
.WithOpenApi();

// ---------------------------------------------------------
// 7. Bulk CSV Land Records Import Endpoint (Admin Protected)
// ---------------------------------------------------------
app.MapPost("/api/v1/land-records/import/csv", async (
    IFormFile? file,
    [FromQuery] bool? dryRun,
    [FromQuery] bool? skipDuplicates,
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] ICsvLandPriceImporter importer,
    [FromServices] IConfiguration config,
    [FromServices] ILogger<Program> logger,
    CancellationToken ct) =>
{
    var isDryRun = dryRun ?? false;
    var shouldSkipDuplicates = skipDuplicates ?? true;

    // Administrator authorization verification
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }

    if (file == null || file.Length == 0)
    {
        return Results.BadRequest(new { Error = "No CSV file was uploaded or the uploaded file is empty." });
    }

    // Enforce 5MB limit
    const long maxFileSize = 5 * 1024 * 1024;
    if (file.Length > maxFileSize)
    {
        return Results.BadRequest(new { Error = $"File exceeds the maximum allowed size limit of 5 MB ({file.Length / (1024 * 1024):F1} MB uploaded)." });
    }

    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (extension != ".csv" && !string.Equals(file.ContentType, "text/csv", StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { Error = "Invalid file type. Only CSV files (.csv) are accepted for batch dataset ingestion." });
    }

    try
    {
        using var stream = file.OpenReadStream();
        var result = await importer.ProcessCsvAsync(
            csvStream: stream,
            dryRun: isDryRun,
            skipDuplicates: shouldSkipDuplicates,
            fileName: file.FileName,
            fileSizeBytes: file.Length,
            triggeredBy: "Administrator",
            cancellationToken: ct);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Unexpected error during batch CSV ingestion");
        return Results.Json(new { Error = $"CSV Ingestion error: {ex.Message}" }, statusCode: StatusCodes.Status500InternalServerError);
    }
})
.DisableAntiforgery()
.WithName("ImportLandRecordsCsv")
.WithSummary("Bulk Ingest Land Records from CSV")
.WithDescription("Accepts multipart CSV upload, executes PostGIS coordinate validation, normalizes land units, flags duplicate records, and imports records as Unverified status. Supports ?dryRun=true.")
.WithOpenApi();

// ---------------------------------------------------------
// 8. Download Sample CSV Template Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/land-records/import/csv-template", () =>
{
    var templateContent = "locality,taluk,streetOrLandmark,surveyNumber,latitude,longitude,landUsage,area,unit,price,sourceCategory,sourceReference,observationDate,district,state,country,notes\r\n" +
                          "Kannampalayam,Sulur,Trichy Road Branch,SF 142/2A,11.0015,77.0878,Residential,3.5,Cent,3675000,VerifiedTransaction,SRO Sulur Doc 3412/2023,2023-11-14,Coimbatore,Tamil Nadu,India,Registered sale deed; rectangular plot facing 30ft road\r\n" +
                          "Sulur,Sulur,Airport Road Bypass,SF 88/1,11.0260,77.1280,Commercial,2400,SqFt,4800000,AdvertisedAskingPrice,Local Broker Listing #SLR-22,2024-03-01,Coimbatore,Tamil Nadu,India,Commercial frontage plot asking rate\r\n" +
                          "Saravanampatti,Annur,Sathy Road Junction,SF 210/3,11.0820,76.9985,Residential,1.0,Acre,120000000,ClientResearch,Surveyor Field Valuation Sheet #12,2024-01-15,Coimbatore,Tamil Nadu,India,One acre parcel assessed by field surveyor\r\n";

    var bytes = System.Text.Encoding.UTF8.GetBytes(templateContent);
    return Results.File(bytes, "text/csv", "greenart_land_records_template.csv");
})
.WithName("GetCsvImportTemplate")
.WithSummary("Download Sample Ingestion CSV Template")
.WithDescription("Provides standard RFC 4180 CSV template formatted with canonical headers, valid coordinate ranges, and unit notations.")
.WithOpenApi();

// ---------------------------------------------------------
// 9. Statewide Coverage Summary Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/coverage/summary", async (
    [FromServices] IMlReadinessService mlService,
    CancellationToken ct) =>
{
    var summary = await mlService.GetStatewideCoverageSummaryAsync(ct);
    return Results.Ok(summary);
})
.WithName("GetStatewideCoverageSummary")
.WithSummary("Statewide Tamil Nadu Geographic Data Coverage")
.WithDescription("Reports record counts, verified transactions, baseline rates, and readiness tiers across all 38 revenue districts in Tamil Nadu.")
.WithOpenApi();

// ---------------------------------------------------------
// 10. Import Batch History Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/land-records/import/history", async (
    [FromQuery] int? limit,
    [FromServices] ILandPriceRepository repository,
    CancellationToken ct) =>
{
    var batchLimit = (limit.HasValue && limit.Value > 0) ? Math.Min(limit.Value, 100) : 20;
    var batches = await repository.GetImportBatchesAsync(batchLimit, ct);
    return Results.Ok(batches);
})
.WithName("GetImportHistory")
.WithSummary("CSV Ingestion Batch Audit History")
.WithDescription("Lists historic bulk ingestion executions, audit metrics, validation counts, and duplicate statistics.")
.WithOpenApi();

// ---------------------------------------------------------
// 11. External Data Providers Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/providers", (
    [FromServices] IDataProviderRegistry registry) =>
{
    var providers = registry.GetProviderSummaries();
    return Results.Ok(providers);
})
.WithName("GetDataProviders")
.WithSummary("Registered Land Price Data Providers")
.WithDescription("Lists data providers including Internal Surveyor, TNREGINET Statutory Benchmarks, and Commercial PropTech Feeds.")
.WithOpenApi();

// ---------------------------------------------------------
// 12. ML Readiness Assessment Endpoint
// ---------------------------------------------------------
app.MapGet("/api/v1/ml/readiness", async (
    [FromServices] IMlReadinessService mlService,
    CancellationToken ct) =>
{
    var report = await mlService.GenerateAuditReportAsync(ct);
    return Results.Ok(report);
})
.WithName("GetMlReadinessReport")
.WithSummary("Machine Learning Production Readiness Assessment")
.WithDescription("Audits dataset volume, spatial/temporal distributions, and 500-sample promotion gates to govern transition from heuristic to ML models.")
.WithOpenApi();

// ---------------------------------------------------------
// 13. LandLens Integration Endpoints (Administrative)
// ---------------------------------------------------------
var landlensGroup = app.MapGroup("/api/v1/integrations/landlens")
    .WithTags("LandLens Integration");

landlensGroup.MapGet("/status", (
    [FromServices] ILandLensClient client,
    [FromServices] IConfiguration config) =>
{
    var baseUrl = config["LandLens:BaseUrl"] ?? "https://verified.realestate/api/v1";
    var timeout = int.TryParse(config["LandLens:TimeoutSeconds"], out var t) ? t : 30;
    return Results.Ok(new LandLensStatusResponse(
        Configured: client.IsConfigured,
        BaseUrl: baseUrl,
        TimeoutSeconds: timeout,
        Status: client.IsConfigured ? "Ready" : "Unconfigured"
    ));
})
.WithName("GetLandLensStatus")
.WithSummary("LandLens Integration Configuration Status")
.WithDescription("Checks whether the LandLens API key is present without exposing the credential.")
.WithOpenApi();

landlensGroup.MapGet("/me", async (
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] ILandLensClient client,
    [FromServices] IConfiguration config,
    CancellationToken ct) =>
{
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!client.IsConfigured)
    {
        return Results.BadRequest(new { Error = "LandLens API key is not configured. Please set LANDLENS_API_KEY in .env." });
    }

    try
    {
        var account = await client.GetAccountStatusAsync(ct);
        if (account == null)
        {
            return Results.Problem("Could not retrieve account details from LandLens.", statusCode: StatusCodes.Status502BadGateway);
        }
        return Results.Ok(account);
    }
    catch (UnauthorizedAccessException ex)
    {
        return Results.Json(new { Error = ex.Message }, statusCode: StatusCodes.Status401Unauthorized);
    }
})
.WithName("GetLandLensAccount")
.WithSummary("LandLens Account Balance & Spend Diagnostics")
.WithDescription("Queries verified account credentials, spent today, and remaining credit balance.")
.WithOpenApi();

landlensGroup.MapGet("/tools", async (
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] ILandLensClient client,
    [FromServices] IConfiguration config,
    CancellationToken ct) =>
{
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!client.IsConfigured)
    {
        return Results.BadRequest(new { Error = "LandLens API key is not configured. Please set LANDLENS_API_KEY in .env." });
    }

    var tools = await client.GetToolsAsync(ct);
    return Results.Ok(tools);
})
.WithName("GetLandLensTools")
.WithSummary("LandLens Tools Catalog")
.WithDescription("Lists all ~130 available tools, categories, and credit pricing.")
.WithOpenApi();

landlensGroup.MapPost("/resolve-parcel", async (
    [FromBody] ResolveParcelRequest request,
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] ILandLensClient client,
    [FromServices] IConfiguration config,
    CancellationToken ct) =>
{
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!client.IsConfigured)
    {
        return Results.BadRequest(new { Error = "LandLens API key is not configured. Please set LANDLENS_API_KEY in .env." });
    }

    var result = await client.ResolveParcelAsync(request.Lat, request.Lng, ct);
    if (result == null)
    {
        return Results.NotFound(new { Message = "No parcel resolved for the given coordinates." });
    }
    return Results.Ok(result);
})
.WithName("ResolveLandParcel")
.WithSummary("Resolve GPS Coordinates to Land Parcel")
.WithDescription("Resolves latitude/longitude to Tamil Nadu survey number, subdivision, village, and GeoJSON boundary (Free endpoint).")
.WithOpenApi();

landlensGroup.MapPost("/guideline-value", async (
    [FromBody] GuidelineValueRequest request,
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] ILandLensClient client,
    [FromServices] IConfiguration config,
    CancellationToken ct) =>
{
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!client.IsConfigured)
    {
        return Results.BadRequest(new { Error = "LandLens API key is not configured. Please set LANDLENS_API_KEY in .env." });
    }

    var result = await client.GetGuidelineValueAsync(request, ct);
    if (result == null)
    {
        return Results.NotFound(new { Message = "Guideline value not found for the requested criteria." });
    }
    return Results.Ok(result);
})
.WithName("GetGuidelineValue")
.WithSummary("Fetch Government Guideline Value")
.WithDescription("Returns official registration benchmark value used for stamp duty (Free endpoint).")
.WithOpenApi();

landlensGroup.MapPost("/guideline-history", async (
    [FromBody] GuidelineHistoryRequest request,
    [FromHeader(Name = "X-Admin-Key")] string? adminKey,
    [FromServices] ILandLensClient client,
    [FromServices] IConfiguration config,
    CancellationToken ct) =>
{
    if (!IsAuthorizedAdmin(adminKey, config))
    {
        return Results.Json(
            new { Error = "Unauthorized: A valid administrative API key must be supplied via 'X-Admin-Key' header." },
            statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!client.IsConfigured)
    {
        return Results.BadRequest(new { Error = "LandLens API key is not configured. Please set LANDLENS_API_KEY in .env." });
    }

    var result = await client.GetGuidelineHistoryAsync(request, ct);
    if (result == null)
    {
        return Results.NotFound(new { Message = "Guideline history series not found." });
    }
    return Results.Ok(result);
})
.WithName("GetGuidelineHistory")
.WithSummary("Historical Guideline Value Series")
.WithDescription("Returns year-by-year guideline series from 2002 to 2024 (Free endpoint).")
.WithOpenApi();

app.Run();

public partial class Program { }
