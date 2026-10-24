# Greenart Properties — Geocoding & Locality Search API Integration Report

**Date:** October 23, 2026  
**Status:** Complete & Verified (133/133 backend tests passing, TypeScript 0 errors, clean mobile & web exports)

---

## 1. Why "bhavani" Showed "No matching localities found in pilot"

In the previous mobile prototype, the search text input was purely filtering an in-memory array of **7 local Coimbatore pilot database localities** (`Kannampalayam`, `Sulur`, `Ondipudur`, `Ramanathapuram`, `Singanallur`, `Irugur`, `Pollachi`).

Because **Bhavani** is in Erode District (outside the initial Coimbatore pilot database table), the local array filter returned zero matches and showed:
```
No matching localities found in pilot.
```

The Google Places Geocoding API integration was not yet connected to the search input. It has now been connected through a secure ASP.NET Core backend proxy.

---

## 2. Where the Configuration & API Key Are Located

To prevent security risks and Google API billing abuse, **the API key is NEVER exposed in the client-side JavaScript bundle or mobile app**. It is securely stored in backend configuration and proxy-called through ASP.NET Core.

### File Locations:

1. **Root Environment Files:**
   - [`.env`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/.env)
   - [`.env.example`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/.env.example)
   ```env
   # Geocoding & Locality Search Proxy (Google Maps Places API New)
   # Kept server-side only in ASP.NET Core backend to prevent frontend leakage
   GEOCODING_API_BASE_URL=https://places.googleapis.com/v1
   GEOCODING_API_KEY=AIzaSyDKrt9ASjIhRsooi4DpFmGCP6qJoKWoFT0
   GEOCODING_DEFAULT_REGION=in
   ```

2. **Backend AppSettings:**
   - [`backend/Greenart.Api/appsettings.json`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Api/appsettings.json#L9-L14)
   - [`backend/Greenart.Api/appsettings.Development.json`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Api/appsettings.Development.json#L9-L14)
   ```json
   "GeocodingSettings": {
     "BaseUrl": "https://places.googleapis.com/v1",
     "ApiKey": "AIzaSyDKrt9ASjIhRsooi4DpFmGCP6qJoKWoFT0",
     "DefaultRegion": "in",
     "TimeoutSeconds": 5
   }
   ```

---

## 3. Where the Implementation Exists

### Architecture Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Customer as User (Mobile App)
    participant Mobile as React Native / Expo
    participant Backend as ASP.NET Core Proxy
    participant Cache as MemoryCache
    participant Google as Google Places API (New)

    Customer->>Mobile: Types "bhavani" (300ms debounce)
    Mobile->>Backend: GET /api/v1/localities/search?q=bhavani
    Backend->>Cache: Check "locality_search_bhavani_in"
    alt Cache Miss
        Backend->>Google: POST https://places.googleapis.com/v1/places:autocomplete<br/>(Header: X-Goog-Api-Key)
        Google-->>Backend: 200 OK (Place Predictions)
        Backend->>Cache: Store for 30 minutes
    end
    Backend-->>Mobile: 200 OK [ { placeId: "ChIJ...", mainText: "Bhavani", secondaryText: "Tamil Nadu, India" } ]
    Mobile-->>Customer: Renders live suggestions dropdown with "Place" badge

    Customer->>Mobile: Taps "Bhavani"
    Mobile->>Backend: GET /api/v1/localities/details?placeId=ChIJ...
    Backend->>Cache: Check "locality_details_ChIJ..."
    alt Cache Miss
        Backend->>Google: GET https://places.googleapis.com/v1/places/ChIJ...<br/>(Header: X-Goog-FieldMask: id,displayName,formattedAddress,location,addressComponents)
        Google-->>Backend: 200 OK (Coordinates: 11.4471, 77.6840)
        Backend->>Cache: Store for 24 hours
    end
    Backend-->>Mobile: 200 OK { lat: 11.4471, lng: 77.6840, locality: "Bhavani", district: "Erode" }
    Mobile->>Mobile: Centers map on Bhavani, updates pin & 1,000m buffer
```

### Source Code Files:

1. **DTOs:** [`backend/Greenart.Application/DTOs/GeocodingDtos.cs`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Application/DTOs/GeocodingDtos.cs)
   - `LocalitySuggestionDto` (PlaceId, MainText, SecondaryText, FullText, Types)
   - `LocalityDetailsDto` (PlaceId, Name, FormattedAddress, Latitude, Longitude, Locality, District, State, Country)

2. **Service Interface:** [`backend/Greenart.Application/Common/Interfaces/IGeocodingService.cs`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Application/Common/Interfaces/IGeocodingService.cs)

3. **Service Implementation:** [`backend/Greenart.Infrastructure/Services/GooglePlacesGeocodingService.cs`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Infrastructure/Services/GooglePlacesGeocodingService.cs)
   - Injects `HttpClient`, `IMemoryCache`, `IConfiguration`, and `ILogger`.
   - Calls Google Places API (New) endpoints.
   - Enforces 30-min cache on autocomplete and 24-hr cache on place coordinates.
   - Masks all HTTP errors so Google API keys are never leaked in logs or error bodies.

4. **API Endpoints:** [`backend/Greenart.Api/Program.cs`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Api/Program.cs#L644-L690)
   - `GET /api/v1/localities/search?q={query}`
   - `GET /api/v1/localities/details?placeId={placeId}`

5. **Mobile API Client:** [`apps/mobile/src/services/api.ts`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/apps/mobile/src/services/api.ts#L254-L285)
   - `mobileApi.searchLocalities(query)`
   - `mobileApi.getLocalityDetails(placeId)`

6. **Mobile UI Integration:** [`apps/mobile/App.tsx`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/apps/mobile/App.tsx#L270-L330)
   - Connected on both **Home Screen** and **Location Explorer Tab**.
   - 300ms debouncing, live loading spinners, and clear `✕` button.
   - Resolves exact coordinates and updates the interactive map.

---

## 4. Verification & Test Execution Results

| Test Category | Suite | Passed | Failed |
|---|---|---|---|
| Backend Unit Tests | `Greenart.Tests.Unit` (including 6 new geocoding tests) | **84** | 0 |
| Backend Integration Tests | `Greenart.Tests.Integration` (including 5 new endpoint tests) | **49** | 0 |
| **Total Backend Tests** | **`dotnet test Greenart.sln`** | **133** | **0** |
| Mobile TypeScript | `npx tsc --noEmit` in `apps/mobile` | **0 errors** | 0 |
| Mobile Web Bundle | `npx expo export --platform web` | **Clean build** | 0 |
| Admin Web Build | `npm run build` in `apps/admin-web` | **Clean build** | 0 |

