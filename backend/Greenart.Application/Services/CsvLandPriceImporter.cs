using System.Globalization;
using System.Text;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Greenart.Application.Services;

public class CsvLandPriceImporter : ICsvLandPriceImporter
{
    private readonly ILandPriceRepository _repository;
    private readonly ILogger<CsvLandPriceImporter> _logger;

    public const int MaxAllowedRows = 1000;

    public CsvLandPriceImporter(
        ILandPriceRepository repository,
        ILogger<CsvLandPriceImporter> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<BatchImportSummaryResponse> ProcessCsvAsync(
        Stream csvStream,
        bool dryRun = false,
        bool skipDuplicates = true,
        string fileName = "upload.csv",
        long fileSizeBytes = 0,
        string triggeredBy = "Administrator",
        CancellationToken cancellationToken = default)
    {
        var diagnostics = new List<CsvRowDiagnostic>();
        var previews = new List<ValidatedRecordPreview>();

        // 1. Streaming RFC 4180 CSV parsing
        List<List<string>> rawRows;
        try
        {
            rawRows = ParseCsvStream(csvStream);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse CSV stream");
            diagnostics.Add(new CsvRowDiagnostic(
                RowNumber: 1,
                Locality: null,
                SurveyNumber: null,
                Severity: "Error",
                Field: "File",
                Message: $"Malformed CSV formatting: {ex.Message}"
            ));

            return new BatchImportSummaryResponse(
                DryRun: dryRun,
                TotalRows: 0,
                ValidRows: 0,
                InvalidRows: 1,
                DuplicateRows: 0,
                ImportedRows: 0,
                SkippedRows: 0,
                TimestampUtc: DateTime.UtcNow,
                Diagnostics: diagnostics,
                Previews: previews
            );
        }

        if (rawRows.Count == 0)
        {
            diagnostics.Add(new CsvRowDiagnostic(
                RowNumber: 1,
                Locality: null,
                SurveyNumber: null,
                Severity: "Error",
                Field: "File",
                Message: "Uploaded CSV file contains no data."
            ));

            return new BatchImportSummaryResponse(
                DryRun: dryRun,
                TotalRows: 0,
                ValidRows: 0,
                InvalidRows: 1,
                DuplicateRows: 0,
                ImportedRows: 0,
                SkippedRows: 0,
                TimestampUtc: DateTime.UtcNow,
                Diagnostics: diagnostics,
                Previews: previews
            );
        }

        // 2. Header resolution
        var headerRow = rawRows[0];
        var headerMap = BuildHeaderIndexMap(headerRow);

        var requiredHeaders = new[]
        {
            "locality", "latitude", "longitude", "landusage",
            "area", "unit", "price", "sourcecategory", "observationdate"
        };

        var missingRequired = requiredHeaders
            .Where(req => !headerMap.ContainsKey(req))
            .ToList();

        if (missingRequired.Count > 0)
        {
            diagnostics.Add(new CsvRowDiagnostic(
                RowNumber: 1,
                Locality: null,
                SurveyNumber: null,
                Severity: "Error",
                Field: "Headers",
                Message: $"Missing required CSV column(s): {string.Join(", ", missingRequired)}. Please verify against template."
            ));

            return new BatchImportSummaryResponse(
                DryRun: dryRun,
                TotalRows: 0,
                ValidRows: 0,
                InvalidRows: 1,
                DuplicateRows: 0,
                ImportedRows: 0,
                SkippedRows: 0,
                TimestampUtc: DateTime.UtcNow,
                Diagnostics: diagnostics,
                Previews: previews
            );
        }

        var dataRows = rawRows.Skip(1).ToList();
        var totalRows = dataRows.Count;

        // 3. Batch row count ceiling
        if (totalRows > MaxAllowedRows)
        {
            diagnostics.Add(new CsvRowDiagnostic(
                RowNumber: 1,
                Locality: null,
                SurveyNumber: null,
                Severity: "Error",
                Field: "RowCount",
                Message: $"CSV exceeds the allowed batch limit of {MaxAllowedRows} rows (found {totalRows} rows). Split the file and retry."
            ));

            return new BatchImportSummaryResponse(
                DryRun: dryRun,
                TotalRows: totalRows,
                ValidRows: 0,
                InvalidRows: totalRows,
                DuplicateRows: 0,
                ImportedRows: 0,
                SkippedRows: 0,
                TimestampUtc: DateTime.UtcNow,
                Diagnostics: diagnostics,
                Previews: previews
            );
        }

        // 4. Retrieve existing records for duplicate detection
        var existingRecords = await _repository.GetAllAsync(cancellationToken: cancellationToken);
        var comparisonPool = new List<LandPriceRecord>(existingRecords);

        var validRecords = new List<LandPriceRecord>();
        var recordsToInsert = new List<LandPriceRecord>();

        int validRowCount = 0;
        int invalidRowCount = 0;
        int duplicateRowCount = 0;

        // 5. Validate row-by-row
        for (int i = 0; i < dataRows.Count; i++)
        {
            var row = dataRows[i];
            int rowNumber = i + 2; // Line 1 is header; data rows start at Line 2

            // Skip empty rows
            if (row.All(string.IsNullOrWhiteSpace))
            {
                continue;
            }

            var rowErrors = new List<string>();
            var rowWarnings = new List<string>();

            // Locality
            string locality = GetField(row, headerMap, "locality");
            if (string.IsNullOrWhiteSpace(locality))
            {
                rowErrors.Add("Locality is required.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, null, "Error", "Locality", "Locality is required."));
            }

            // Optional strings
            string? taluk = GetOptionalField(row, headerMap, "taluk");
            string? streetOrLandmark = GetOptionalField(row, headerMap, "streetorlandmark");
            string? surveyNumber = GetOptionalField(row, headerMap, "surveynumber");
            string? rawDistrict = GetOptionalField(row, headerMap, "district");
            string district = TamilNaduGeoBounds.NormalizeDistrict(rawDistrict, "Coimbatore");
            string state = GetOptionalField(row, headerMap, "state") ?? "Tamil Nadu";
            string country = GetOptionalField(row, headerMap, "country") ?? "India";
            string? notes = GetOptionalField(row, headerMap, "notes");
            string? sourceReference = GetOptionalField(row, headerMap, "sourcereference");

            // Coordinates
            double latitude = 0;
            double longitude = 0;
            bool coordsValid = true;

            string rawLat = GetField(row, headerMap, "latitude");
            if (!double.TryParse(rawLat, NumberStyles.Float, CultureInfo.InvariantCulture, out latitude))
            {
                coordsValid = false;
                rowErrors.Add($"Invalid Latitude '{rawLat}'. Must be a valid decimal number.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Latitude", $"Invalid Latitude '{rawLat}'."));
            }
            else if (latitude < -90.0 || latitude > 90.0)
            {
                coordsValid = false;
                rowErrors.Add($"Latitude {latitude} is outside valid geographic range [-90, 90].");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Latitude", $"Latitude {latitude} is outside [-90, 90]."));
            }

            string rawLon = GetField(row, headerMap, "longitude");
            if (!double.TryParse(rawLon, NumberStyles.Float, CultureInfo.InvariantCulture, out longitude))
            {
                coordsValid = false;
                rowErrors.Add($"Invalid Longitude '{rawLon}'. Must be a valid decimal number.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Longitude", $"Invalid Longitude '{rawLon}'."));
            }
            else if (longitude < -180.0 || longitude > 180.0)
            {
                coordsValid = false;
                rowErrors.Add($"Longitude {longitude} is outside valid geographic range [-180, 180].");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Longitude", $"Longitude {longitude} is outside [-180, 180]."));
            }

            // Geographical bounding validation
            if (coordsValid)
            {
                // Check if lat/long are inverted (Lat in India range [68, 98] and Lon in [6, 38])
                if (TamilNaduGeoBounds.AreCoordinatesTransposed(latitude, longitude))
                {
                    coordsValid = false;
                    rowErrors.Add($"Latitude ({latitude:F4}) and Longitude ({longitude:F4}) appear to be transposed.");
                    diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Coordinates", "Latitude and Longitude appear to be transposed."));
                }
                else if (!TamilNaduGeoBounds.IsWithinIndia(latitude, longitude))
                {
                    coordsValid = false;
                    rowErrors.Add($"Coordinates ({latitude:F4}, {longitude:F4}) fall outside Indian geographic boundaries [Lat 6.0-38.0, Lon 68.0-98.0].");
                    diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Coordinates", $"Coordinates ({latitude:F4}, {longitude:F4}) outside India bounds."));
                }
                else if (!TamilNaduGeoBounds.IsWithinTamilNadu(latitude, longitude))
                {
                    // Outside Tamil Nadu, but inside India: allow with warning
                    rowWarnings.Add($"Coordinates ({latitude:F4}, {longitude:F4}) are outside Tamil Nadu state boundaries [Lat 8.0-13.6, Lon 76.2-80.4].");
                    diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Warning", "Coordinates", "Coordinates are outside Tamil Nadu."));
                }
                else if (!TamilNaduGeoBounds.IsWithinPilot(latitude, longitude))
                {
                    // Inside Tamil Nadu, outside Coimbatore primary corridor: valid statewide record
                    rowWarnings.Add($"Statewide Tamil Nadu parcel outside Coimbatore pilot corridor ({district}).");
                }
            }

            // Land Usage
            string rawUsage = GetField(row, headerMap, "landusage");
            if (!TryParseLandUsage(rawUsage, out var landUsage))
            {
                rowErrors.Add($"Unsupported land usage '{rawUsage}'. Supported: Residential, Commercial, AgriculturalWet, AgriculturalDry, Industrial, MixedUse.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "LandUsage", $"Unsupported land usage '{rawUsage}'."));
            }

            // Area and Unit
            string rawArea = GetField(row, headerMap, "area");
            decimal areaValue = 0;
            if (!decimal.TryParse(rawArea, NumberStyles.Number, CultureInfo.InvariantCulture, out areaValue) || areaValue <= 0)
            {
                rowErrors.Add($"Area must be a strictly positive number (got '{rawArea}').");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Area", $"Area must be strictly positive (got '{rawArea}')."));
            }

            string rawUnit = GetField(row, headerMap, "unit");
            if (!TryParseAreaUnit(rawUnit, out var areaUnit))
            {
                rowErrors.Add($"Unsupported area unit '{rawUnit}'. Supported: Cent, SqFt, Acre, Ground, Kuzhi, SqMeter.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Unit", $"Unsupported area unit '{rawUnit}'."));
            }

            // Price
            string rawPrice = GetField(row, headerMap, "price");
            decimal price = 0;
            if (!decimal.TryParse(rawPrice, NumberStyles.Number, CultureInfo.InvariantCulture, out price) || price <= 0)
            {
                rowErrors.Add($"Price must be a strictly positive number (got '{rawPrice}').");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "Price", $"Price must be strictly positive (got '{rawPrice}')."));
            }

            // Source Category
            string rawSource = GetField(row, headerMap, "sourcecategory");
            if (!TryParseSourceCategory(rawSource, out var sourceCategory))
            {
                rowErrors.Add($"Unsupported source category '{rawSource}'. Supported: GovernmentGuideline, VerifiedTransaction, AdvertisedAskingPrice, ClientResearch.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "SourceCategory", $"Unsupported source category '{rawSource}'."));
            }

            // Observation Date
            string rawDate = GetField(row, headerMap, "observationdate");
            if (!TryParseObservationDate(rawDate, out var observationDate))
            {
                rowErrors.Add($"Invalid observation date '{rawDate}'. Expected ISO format YYYY-MM-DD or DD/MM/YYYY.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "ObservationDate", $"Invalid observation date '{rawDate}'."));
            }
            else if (observationDate > DateTime.UtcNow.AddDays(1))
            {
                rowErrors.Add("Observation date cannot be in the future.");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "ObservationDate", "Observation date cannot be in the future."));
            }
            else if (observationDate < new DateTime(1990, 1, 1))
            {
                rowErrors.Add("Observation date is prior to supported historical range (1990-present).");
                diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Error", "ObservationDate", "Observation date is prior to 1990."));
            }

            // Mandatory Default Status Rule:
            // "New imported records must default to Unverified unless an explicitly authorized and documented workflow permits another status.
            // Never automatically treat an imported transaction as verified merely because the CSV labels it that way."
            var verificationStatus = VerificationStatus.Unverified;
            if (sourceCategory == SourceCategory.VerifiedTransaction)
            {
                rowWarnings.Add("Imported record categorized as VerifiedTransaction defaulted to Unverified pending administrative audit.");
            }

            // Duplicate Detection
            bool isDuplicate = false;
            string? duplicateReason = null;

            if (rowErrors.Count == 0)
            {
                var candidateCoord = new GeoCoordinate(latitude, longitude);

                foreach (var existing in comparisonPool)
                {
                    // 1. Survey Number match in same locality
                    if (!string.IsNullOrWhiteSpace(surveyNumber) &&
                        !string.IsNullOrWhiteSpace(existing.SurveyNumber) &&
                        string.Equals(surveyNumber.Trim(), existing.SurveyNumber.Trim(), StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(locality.Trim(), existing.Locality.Trim(), StringComparison.OrdinalIgnoreCase) &&
                        existing.LandUsage == landUsage &&
                        Math.Abs((observationDate - existing.ObservationDate).TotalDays) <= 60)
                    {
                        isDuplicate = true;
                        duplicateReason = $"Duplicate of record '{existing.Id}' (Survey #{existing.SurveyNumber} in {existing.Locality}, observed {existing.ObservationDate:yyyy-MM-dd}).";
                        break;
                    }

                    // 2. Exact match on locality, source, price, and close date
                    if (string.Equals(locality.Trim(), existing.Locality.Trim(), StringComparison.OrdinalIgnoreCase) &&
                        existing.SourceCategory == sourceCategory &&
                        existing.OriginalPrice == price &&
                        Math.Abs((observationDate - existing.ObservationDate).TotalDays) <= 7)
                    {
                        isDuplicate = true;
                        duplicateReason = $"Duplicate of record '{existing.Id}' in {existing.Locality} with identical price ₹{price:N0} and source {sourceCategory}.";
                        break;
                    }

                    // 3. Spatial proximity check (within 15 meters, same land usage, price within 5%, date within 30 days)
                    double distance = candidateCoord.DistanceToMeters(existing.Coordinates);
                    if (distance <= 15.0 &&
                        existing.LandUsage == landUsage &&
                        Math.Abs((observationDate - existing.ObservationDate).TotalDays) <= 30 &&
                        existing.OriginalPrice > 0 &&
                        Math.Abs(price - existing.OriginalPrice) / existing.OriginalPrice <= 0.05m)
                    {
                        isDuplicate = true;
                        duplicateReason = $"Spatial proximity duplicate: within {distance:F1}m of record '{existing.Id}' (Survey #{existing.SurveyNumber ?? "N/A"}) with matching land usage and price within 5%.";
                        break;
                    }
                }

                if (isDuplicate)
                {
                    rowWarnings.Add(duplicateReason!);
                    diagnostics.Add(new CsvRowDiagnostic(rowNumber, locality, surveyNumber, "Warning", "Duplicate", duplicateReason!));
                    duplicateRowCount++;
                }
            }

            bool isValid = rowErrors.Count == 0;

            decimal ratePerCent = 0;
            decimal ratePerSqFt = 0;

            if (isValid)
            {
                validRowCount++;
                var landArea = new LandArea(areaValue, areaUnit);

                var record = new LandPriceRecord(
                    id: Guid.NewGuid(),
                    country: country,
                    state: state,
                    district: district,
                    taluk: taluk,
                    locality: locality,
                    streetOrLandmark: streetOrLandmark,
                    surveyNumber: surveyNumber,
                    coordinates: new GeoCoordinate(latitude, longitude),
                    landUsage: landUsage,
                    area: landArea,
                    originalPrice: price,
                    sourceCategory: sourceCategory,
                    sourceReference: sourceReference,
                    observationDate: observationDate,
                    verificationStatus: verificationStatus,
                    isSynthetic: false,
                    notes: notes
                );

                ratePerCent = record.NormalizedRatePerCent;
                ratePerSqFt = record.NormalizedRatePerSqFt;

                validRecords.Add(record);
                comparisonPool.Add(record); // Prevent intra-batch duplicates

                if (!isDuplicate || !skipDuplicates)
                {
                    recordsToInsert.Add(record);
                }
            }
            else
            {
                invalidRowCount++;
            }

            previews.Add(new ValidatedRecordPreview(
                RowNumber: rowNumber,
                Locality: locality,
                Taluk: taluk,
                StreetOrLandmark: streetOrLandmark,
                SurveyNumber: surveyNumber,
                Latitude: latitude,
                Longitude: longitude,
                LandUsage: rawUsage,
                Area: areaValue,
                Unit: rawUnit,
                Price: price,
                NormalizedRatePerCent: ratePerCent,
                NormalizedRatePerSqFt: ratePerSqFt,
                SourceCategory: rawSource,
                SourceReference: sourceReference,
                ObservationDate: observationDate,
                VerificationStatus: verificationStatus.ToString(),
                IsDuplicate: isDuplicate,
                DuplicateReason: duplicateReason,
                IsValid: isValid,
                Errors: rowErrors,
                Warnings: rowWarnings
            ));
        }

        // 6. Persistence execution
        int importedRows = 0;
        int skippedRows = 0;

        if (!dryRun)
        {
            skippedRows = validRowCount - recordsToInsert.Count;
            if (recordsToInsert.Count > 0)
            {
                try
                {
                    await _repository.AddRangeAsync(recordsToInsert, cancellationToken);
                    importedRows = recordsToInsert.Count;

                    _logger.LogInformation("Batch CSV import committed {Count} records to repository (Skipped {Skipped} duplicates)",
                        importedRows, skippedRows);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to persist imported batch records to database");
                    diagnostics.Add(new CsvRowDiagnostic(
                        RowNumber: 1,
                        Locality: null,
                        SurveyNumber: null,
                        Severity: "Error",
                        Field: "Database",
                        Message: $"Database persistence failure: {ex.Message}"
                    ));

                    return new BatchImportSummaryResponse(
                        DryRun: false,
                        TotalRows: totalRows,
                        ValidRows: validRowCount,
                        InvalidRows: invalidRowCount,
                        DuplicateRows: duplicateRowCount,
                        ImportedRows: 0,
                        SkippedRows: validRowCount,
                        TimestampUtc: DateTime.UtcNow,
                        Diagnostics: diagnostics,
                        Previews: previews
                    );
                }
            }
        }
        else
        {
            importedRows = 0;
            skippedRows = recordsToInsert.Count + (skipDuplicates ? duplicateRowCount : 0);
            _logger.LogInformation("Batch CSV import dry-run completed: {Valid} valid, {Invalid} invalid, {Duplicates} duplicates",
                validRowCount, invalidRowCount, duplicateRowCount);
        }

        // Record persistent batch audit trail in repository
        var batchAudit = new ImportBatch(
            id: Guid.NewGuid(),
            fileName: fileName,
            fileSizeBytes: fileSizeBytes,
            totalRows: totalRows,
            validRows: validRowCount,
            invalidRows: invalidRowCount,
            duplicateRows: duplicateRowCount,
            importedRows: importedRows,
            skippedRows: skippedRows,
            dryRun: dryRun,
            triggeredBy: triggeredBy,
            diagnosticSummary: diagnostics.Count > 0 ? $"{diagnostics.Count(d => d.Severity == "Error")} errors, {diagnostics.Count(d => d.Severity == "Warning")} warnings" : "Clean import"
        );

        try
        {
            await _repository.RecordImportBatchAsync(batchAudit, cancellationToken);
            if (!dryRun && importedRows > 0)
            {
                var auditEvent = new AuditEvent(
                    id: Guid.NewGuid(),
                    entityType: "ImportBatch",
                    entityId: batchAudit.Id,
                    action: "CsvBatchImported",
                    performedBy: triggeredBy,
                    details: $"Successfully persisted {importedRows} records from '{fileName}' (Skipped {skippedRows} duplicates)"
                );
                await _repository.RecordAuditEventAsync(auditEvent, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Notice: Unable to persist batch audit log for {FileName}: {Message}", fileName, ex.Message);
        }

        return new BatchImportSummaryResponse(
            DryRun: dryRun,
            TotalRows: totalRows,
            ValidRows: validRowCount,
            InvalidRows: invalidRowCount,
            DuplicateRows: duplicateRowCount,
            ImportedRows: importedRows,
            SkippedRows: skippedRows,
            TimestampUtc: DateTime.UtcNow,
            Diagnostics: diagnostics,
            Previews: previews
        );
    }

    /// <summary>
    /// RFC 4180 streaming CSV parser supporting multi-line quoted fields, escaped quotes, and CRLF/LF.
    /// </summary>
    private static List<List<string>> ParseCsvStream(Stream stream)
    {
        var rows = new List<List<string>>();
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);

        var currentRow = new List<string>();
        var currentField = new StringBuilder();
        bool inQuotes = false;

        int ch;
        while ((ch = reader.Read()) != -1)
        {
            char c = (char)ch;

            if (inQuotes)
            {
                if (c == '"')
                {
                    int next = reader.Peek();
                    if (next == '"')
                    {
                        // Escaped quote: ""
                        reader.Read();
                        currentField.Append('"');
                    }
                    else
                    {
                        // End of quote
                        inQuotes = false;
                    }
                }
                else
                {
                    currentField.Append(c);
                }
            }
            else
            {
                if (c == '"')
                {
                    inQuotes = true;
                }
                else if (c == ',')
                {
                    currentRow.Add(currentField.ToString().Trim());
                    currentField.Clear();
                }
                else if (c == '\r')
                {
                    if (reader.Peek() == '\n')
                    {
                        reader.Read();
                    }
                    currentRow.Add(currentField.ToString().Trim());
                    currentField.Clear();
                    if (currentRow.Any(f => !string.IsNullOrWhiteSpace(f)))
                    {
                        rows.Add(currentRow);
                    }
                    currentRow = new List<string>();
                }
                else if (c == '\n')
                {
                    currentRow.Add(currentField.ToString().Trim());
                    currentField.Clear();
                    if (currentRow.Any(f => !string.IsNullOrWhiteSpace(f)))
                    {
                        rows.Add(currentRow);
                    }
                    currentRow = new List<string>();
                }
                else
                {
                    currentField.Append(c);
                }
            }
        }

        // Add trailing field and row if any
        if (currentField.Length > 0 || currentRow.Count > 0)
        {
            currentRow.Add(currentField.ToString().Trim());
            if (currentRow.Any(f => !string.IsNullOrWhiteSpace(f)))
            {
                rows.Add(currentRow);
            }
        }

        return rows;
    }

    private static Dictionary<string, int> BuildHeaderIndexMap(List<string> headerRow)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < headerRow.Count; i++)
        {
            var raw = headerRow[i];
            if (string.IsNullOrWhiteSpace(raw)) continue;

            // Strip spaces, underscores, and dashes for resilient column matching
            var key = raw.Trim().ToLowerInvariant()
                .Replace(" ", "")
                .Replace("_", "")
                .Replace("-", "");

            // Canonical synonyms
            switch (key)
            {
                case "locality":
                case "place":
                case "location":
                    map.TryAdd("locality", i);
                    break;
                case "taluk":
                    map.TryAdd("taluk", i);
                    break;
                case "streetorlandmark":
                case "street":
                case "landmark":
                case "address":
                    map.TryAdd("streetorlandmark", i);
                    break;
                case "surveynumber":
                case "surveyno":
                case "survey":
                case "sfnumber":
                case "sfno":
                    map.TryAdd("surveynumber", i);
                    break;
                case "latitude":
                case "lat":
                    map.TryAdd("latitude", i);
                    break;
                case "longitude":
                case "lon":
                case "lng":
                    map.TryAdd("longitude", i);
                    break;
                case "landusage":
                case "usage":
                case "landtype":
                case "classification":
                    map.TryAdd("landusage", i);
                    break;
                case "area":
                case "landarea":
                case "size":
                    map.TryAdd("area", i);
                    break;
                case "unit":
                case "areaunit":
                    map.TryAdd("unit", i);
                    break;
                case "price":
                case "totalprice":
                case "originalprice":
                case "amount":
                case "cost":
                    map.TryAdd("price", i);
                    break;
                case "sourcecategory":
                case "source":
                case "datacategory":
                case "category":
                    map.TryAdd("sourcecategory", i);
                    break;
                case "sourcereference":
                case "reference":
                case "docnumber":
                case "citation":
                    map.TryAdd("sourcereference", i);
                    break;
                case "observationdate":
                case "date":
                case "transdate":
                case "observeddate":
                    map.TryAdd("observationdate", i);
                    break;
                case "district":
                    map.TryAdd("district", i);
                    break;
                case "state":
                    map.TryAdd("state", i);
                    break;
                case "country":
                    map.TryAdd("country", i);
                    break;
                case "notes":
                case "note":
                case "remarks":
                case "description":
                    map.TryAdd("notes", i);
                    break;
            }
        }

        return map;
    }

    private static string GetField(List<string> row, Dictionary<string, int> headerMap, string key)
    {
        if (headerMap.TryGetValue(key, out int index) && index < row.Count)
        {
            return row[index].Trim();
        }
        return string.Empty;
    }

    private static string? GetOptionalField(List<string> row, Dictionary<string, int> headerMap, string key)
    {
        var val = GetField(row, headerMap, key);
        return string.IsNullOrWhiteSpace(val) ? null : val;
    }

    private static bool TryParseLandUsage(string raw, out LandUsageType usage)
    {
        var clean = raw.Trim().ToLowerInvariant().Replace(" ", "").Replace("-", "").Replace("_", "");
        switch (clean)
        {
            case "residential":
                usage = LandUsageType.Residential;
                return true;
            case "commercial":
                usage = LandUsageType.Commercial;
                return true;
            case "agriculturalwet":
            case "wet":
            case "wetland":
                usage = LandUsageType.AgriculturalWet;
                return true;
            case "agriculturaldry":
            case "dry":
            case "dryland":
            case "punjai":
                usage = LandUsageType.AgriculturalDry;
                return true;
            case "industrial":
                usage = LandUsageType.Industrial;
                return true;
            case "mixeduse":
            case "mixed":
                usage = LandUsageType.MixedUse;
                return true;
            default:
                usage = default;
                return false;
        }
    }

    private static bool TryParseAreaUnit(string raw, out AreaUnit unit)
    {
        var clean = raw.Trim().ToLowerInvariant().Replace(" ", "").Replace(".", "").Replace("-", "");
        switch (clean)
        {
            case "cent":
            case "cents":
                unit = AreaUnit.Cent;
                return true;
            case "sqft":
            case "sqfeet":
            case "squarefeet":
            case "sqfoot":
                unit = AreaUnit.SqFt;
                return true;
            case "acre":
            case "acres":
                unit = AreaUnit.Acre;
                return true;
            case "ground":
            case "grounds":
                unit = AreaUnit.Ground;
                return true;
            case "kuzhi":
            case "kuzhis":
                unit = AreaUnit.Kuzhi;
                return true;
            case "sqmeter":
            case "sqmeters":
            case "sqm":
            case "squaremeters":
                unit = AreaUnit.SqMeter;
                return true;
            default:
                unit = default;
                return false;
        }
    }

    private static bool TryParseSourceCategory(string raw, out SourceCategory category)
    {
        var clean = raw.Trim().ToLowerInvariant().Replace(" ", "").Replace("-", "").Replace("_", "");
        switch (clean)
        {
            case "governmentguideline":
            case "guideline":
            case "government":
            case "guidelinevalue":
                category = SourceCategory.GovernmentGuideline;
                return true;
            case "verifiedtransaction":
            case "transaction":
            case "registereddeed":
            case "deed":
            case "sale":
                category = SourceCategory.VerifiedTransaction;
                return true;
            case "advertisedaskingprice":
            case "askingprice":
            case "advertisedprice":
            case "asking":
            case "listing":
            case "classified":
                category = SourceCategory.AdvertisedAskingPrice;
                return true;
            case "clientresearch":
            case "research":
            case "survey":
            case "surveyor":
            case "broker":
                category = SourceCategory.ClientResearch;
                return true;
            default:
                category = default;
                return false;
        }
    }

    private static bool TryParseObservationDate(string raw, out DateTime date)
    {
        var formats = new[]
        {
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "MM/dd/yyyy",
            "yyyy/MM/dd",
            "dd-MM-yyyy",
            "yyyy-MM-ddTHH:mm:ss",
            "yyyy-MM-ddTHH:mm:ssZ",
            "yyyy-MM-ddTHH:mm:ss.fffZ",
            "O", "s"
        };

        if (DateTime.TryParseExact(raw.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
        {
            date = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
            return true;
        }

        if (DateTime.TryParse(raw.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
        {
            date = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
            return true;
        }

        date = default;
        return false;
    }
}
