namespace Greenart.Application.DTOs;

/// <summary>
/// Verified account metadata and credits balance returned by GET /api/v1/me.
/// </summary>
public record LandLensAccountResponse(
    string Credential,
    int Balance,
    decimal SpentToday,
    string? Currency = "Credits",
    string? Status = "Active"
);

/// <summary>
/// LandLens tool definition returned by GET /api/v1/tools.
/// </summary>
public record LandLensToolDefinition(
    string Name,
    string? Summary,
    string? Description,
    int CostCredits,
    bool IsFree,
    string? Category
);

/// <summary>
/// Standard response envelope for all LandLens API endpoints.
/// </summary>
public class LandLensEnvelope<T>
{
    public bool Ok { get; set; }
    public string? Status { get; set; }
    public T? Data { get; set; }
    public int CreditsCharged { get; set; }
    public int BalanceAfter { get; set; }
    public string? RequestId { get; set; }
    public string? Error { get; set; }
    public string? Message { get; set; }
}

/// <summary>
/// Request to resolve a GPS coordinate to a Tamil Nadu land parcel.
/// </summary>
public record ResolveParcelRequest(
    double Lat,
    double Lng
);

/// <summary>
/// Resolved parcel details from LandLens resolve_parcel tool.
/// </summary>
public record ResolveParcelResult(
    string? SurveyNumber,
    string? SubDivision,
    string? VillageName,
    string? TalukName,
    string? DistrictName,
    string? RuralUrban,
    string? Ulpin,
    decimal? ExtentSqFt,
    decimal? ExtentCents,
    object? BoundaryGeoJson,
    string? FirkaWardNumber,
    string? UrbanBlockNumber
);

/// <summary>
/// Request for statutory government guideline valuation benchmark.
/// </summary>
public record GuidelineValueRequest(
    string? SurveyNumber = null,
    string? SubDivision = null,
    string? VillageName = null,
    string? DistrictName = null,
    string? RuralUrban = null,
    double? Lat = null,
    double? Lng = null,
    string? RoadName = null,
    string? Zone = null,
    string? Sro = null,
    string? UrbanBlockNumber = null,
    string? FirkaWardNumber = null,
    string? TalukName = null
);

/// <summary>
/// Village-level guideline distribution and price bands from locality_value_context tool.
/// </summary>
public record LocalityValueContextResult(
    string VillageName,
    int PricedStreetsCount,
    decimal MinRatePerSqFt,
    decimal MedianRatePerSqFt,
    decimal MaxRatePerSqFt,
    string? CheapestStreet,
    string? DearestStreet,
    string? ZoneName
);

/// <summary>
/// Statutory guideline value benchmark result.
/// </summary>
public record GuidelineValueResult(
    decimal? GuidelineRatePerSqFt,
    decimal? GuidelineRatePerCent,
    string? Classification,
    string? StreetName,
    string? Unit,
    string? Zone,
    string? Sro
);

/// <summary>
/// Request for historical year-by-year guideline series.
/// </summary>
public record GuidelineHistoryRequest(
    string? SurveyNumber = null,
    string? SubDivision = null,
    string? VillageName = null,
    string? DistrictName = null,
    string? RuralUrban = null
);

public record GuidelineHistoryEntry(
    int Year,
    decimal RatePerSqFt,
    decimal RatePerCent,
    string? Classification
);

public record GuidelineHistoryResult(
    IReadOnlyList<GuidelineHistoryEntry> Entries
);

/// <summary>
/// Request for Price Map (registered deed-based market rates) report.
/// Cost: 4 credits.
/// </summary>
public record PriceMapRequest(
    double Lat,
    double Lng,
    string SurveyNumber,
    string? SubDivision = null
);

public record PriceMapInitiationResult(
    bool Initiated,
    string? JobId,
    string? Message,
    int CreditsCharged,
    int BalanceAfter
);

/// <summary>
/// Request to read deeds from an existing Price Map.
/// </summary>
public record PriceMapTransactionsRequest(
    int? PriceMapId = null,
    string? SurveyNumber = null
);

public record PriceMapTransactionDeed(
    string? DocumentNumber,
    DateTime? RegistrationDate,
    string? PropertyType,
    decimal? AreaSqFt,
    decimal? TotalValue,
    decimal? RatePerSqFt
);

public record PriceMapTransactionsResult(
    int? PriceMapId,
    string? SurveyNumber,
    IReadOnlyList<PriceMapTransactionDeed> Transactions
);

/// <summary>
/// Health and diagnostic status response for LandLens integration.
/// </summary>
public record LandLensStatusResponse(
    bool Configured,
    string BaseUrl,
    int TimeoutSeconds,
    string Status
);

