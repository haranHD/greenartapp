# API Conventions & Design Guidelines — Greenart Properties

## 1. Versioning & URL Structure

- **Base URL Format:** `/api/v{major}/{resource}` (e.g., `/api/v1/estimates/calculate`, `/api/v1/admin/land-records`).
- **Path Casing:** Lowercase kebab-case for resource paths.
- **Query Parameters:** camelCase (e.g., `?radiusMeters=1000&landType=residential`).
- **HTTP Methods:**
  - `GET`: Safe, idempotent retrieval.
  - `POST`: Create resource or execute calculation command.
  - `PUT`: Complete idempotent replacement of an existing resource.
  - `PATCH`: Partial update of an existing resource.
  - `DELETE`: Soft deletion or deactivation of an existing resource.

---

## 2. Standard Endpoints (Preliminary Spec)

### 2.1 Public / Customer Endpoints
- `POST /api/v1/estimates/calculate`: Submit target coordinates and parameters to calculate indicative land market rate.
- `GET /api/v1/estimates/{id}/report`: Retrieve printable or viewable valuation report.
- `GET /api/v1/reference/land-types`: List supported land classifications and zoning types.

### 2.2 Administrative Endpoints (`/api/v1/admin/...`)
- `GET /api/v1/admin/land-records`: Filterable, paginated list of land price records.
- `POST /api/v1/admin/land-records`: Create a single land price record.
- `GET /api/v1/admin/land-records/{id}`: Detailed view of a record, including full provenance and audit log.
- `PUT /api/v1/admin/land-records/{id}`: Update a land record.
- `DELETE /api/v1/admin/land-records/{id}`: Soft-delete/deactivate a land record.
- `POST /api/v1/admin/imports/csv`: Upload CSV file for batch validation and staged ingestion.
- `GET /api/v1/admin/imports/{importJobId}/errors`: Download row-level validation errors.

---

## 3. Request & Response DTO Conventions

- **Request DTOs:** Named with the action and `Request` suffix (e.g., `CalculateEstimateRequest`, `CreateLandRecordRequest`).
- **Response DTOs:** Named with the entity or action and `Response` suffix (e.g., `EstimateResultResponse`, `LandRecordDetailsResponse`).
- **JSON Property Casing:** Standard `camelCase` for all JSON payloads.

---

## 4. Error Response Format (RFC 7807 Problem Details)

All error responses return standard `application/problem+json` envelopes:

```json
{
  "type": "https://greenart.group/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more validation errors occurred.",
  "instance": "/api/v1/estimates/calculate",
  "errors": {
    "latitude": ["Latitude must be between -90.0 and 90.0."],
    "radiusMeters": ["Search radius must not exceed 5000 meters."]
  }
}
```

---

## 5. Insufficient Data Response (Business Outcome)

When a location query has fewer comparable records than the minimum confidence threshold, the API returns `200 OK` with a structured `InsufficientData` status payload (avoiding 404 or 500 exceptions for valid user queries with sparse data):

```json
{
  "status": "InsufficientData",
  "targetCoordinates": {
    "latitude": 10.9856,
    "longitude": 77.0123
  },
  "searchRadiusMeters": 1000,
  "comparableRecordsFound": 1,
  "minimumRequiredRecords": 3,
  "message": "Only 1 comparable record found within 1,000 meters. A minimum of 3 comparable records is required to generate a reliable indicative market estimate.",
  "recommendations": [
    "Expand search radius to 2,000 meters (if permitted)",
    "Consult manual surveyor review"
  ]
}
```

