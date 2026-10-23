# Greenart Properties — Land Market Rate Analyst

A secure, data-backed institutional land market valuation and analytics platform built for **Greenart Properties** (`greenart.group`).

---

## 1. Executive Summary & Brand Identity

The **Greenart Properties Land Market Rate Analyst** platform empowers property buyers, investors, financial institutions, and internal property analysts with evidence-based land price estimates. Operating across Tamil Nadu—anchored by active pilot corridors in Kannampalayam, Sulur, and Saravanampatti, Coimbatore—the platform aggregates registered sale deeds, statutory guideline values, and verified market listings within a strict **1,000-metre geodesic radius**.

### Official Brand Design System
The user interfaces across the Admin Web Portal and Customer Mobile App follow the client's official brand guidelines:
- **Royal Violet (`#240046`)**: Primary brand anchor, header bars, and dominant primary actions.
- **Deep Imperial (`#1A0033`)**: Workspace surfaces, dark navigation backgrounds, and structural framing.
- **Electric Violet (`#581C87`)**: Interactive focus states, link accents, and subtle status tags.
- **Bullion Gold (`#D4AF37`)**: Used sparingly for key valuation highlights, primary CTAs, and statutory accents.
- **Neutral Light Grays (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#E2E8F0`)**: Clean, high-density card surfaces and subtle 1px dividers.
- **Typography & Iconography**: Strict enterprise standard using system font stacks, accessible touch targets ($\ge 44\text{–}48\text{px}$), and stroke-based SVG icons with **zero emojis**.

---

## 2. Monorepo Architecture

The platform is structured as a modular, type-safe monorepo:

```text
greenartapp/
├── apps/
│   ├── admin-web/              # Back-office admin dashboard (React 18, Vite 5, TypeScript 5, Leaflet)
│   └── mobile/                 # Customer mobile application (React Native, Expo 51, React Native Web)
├── backend/                    # Clean Architecture ASP.NET Core (.NET 8) Web API
│   ├── Greenart.sln
│   ├── Greenart.Api/           # Minimal API endpoints, Swagger/OpenAPI, middleware, health
│   ├── Greenart.Application/   # Use cases, EstimationEngine, CsvImporter, ML readiness, DTOs
│   ├── Greenart.Domain/        # Domain entities, Value Objects, Enums
│   └── Greenart.Infrastructure/# EF Core 8, PostgreSQL 16 + PostGIS 3.4 persistence, repositories
├── packages/
│   ├── contracts/              # Shared API contract specifications & schemas
│   └── shared-types/           # Common TypeScript types shared across apps
├── database/                   # Migrations, seed data fixtures, PostGIS spatial initialization
├── tests/
│   └── backend/
│       ├── Greenart.Tests.Unit/        # 78 unit tests (EstimationEngine, CsvImporter, Bounds, ML)
│       └── Greenart.Tests.Integration/ # 37 integration tests (API endpoints, CSV HTTP, PostGIS queries)
├── docs/                       # Architectural, ML readiness, and API documentation
└── infra/                      # Docker Compose configurations for local PostgreSQL/PostGIS
```

---

## 3. Backend Implementations (`backend/`)

### Domain Layer (`Greenart.Domain`)
- **`LandPriceRecord`**: Core property entity storing geographical coordinates (`latitude`, `longitude`, PostGIS `Point`), original price, original unit (`Cent`, `SqFt`, `Acre`, `Ground`), normalized rates (`normalizedRatePerCent`, `normalizedRatePerSqFt`), observation date, survey number, and provenance.
- **`TamilNaduGeoBounds`**: Value object validating coordinates against Tamil Nadu's geographical boundary ($\text{Latitude } 8.0^{\circ}\text{N} \le \text{lat} \le 14.0^{\circ}\text{N}$, $\text{Longitude } 76.0^{\circ}\text{E} \le \text{lng} \le 81.0^{\circ}\text{E}$) across all 38 districts.
- **`ImportBatch` & `AuditEvent`**: Entities maintaining audit trails of batch CSV ingestions, user moderation actions, status changes, and duplicate detections.
- **Domain Enums**:
  - `LandUsageType`: `Residential` (1), `Commercial` (2), `AgriculturalWet` (3), `AgriculturalDry` (4), `Industrial` (5), `MixedUse` (6).
  - `SourceCategory`: `GovernmentGuideline` (1), `VerifiedTransaction` (2), `AdvertisedAskingPrice` (3), `ClientResearch` (4), `SyntheticFixture` (5).
  - `VerificationStatus`: `Unverified` (1), `Verified` (2), `Rejected` (3), `Archived` (4).

### Application Layer (`Greenart.Application`)
- **`EstimationEngine`**: Rule-based statistical property valuation:
  - Queries comparable records strictly within a 1,000-metre geodesic buffer.
  - Requires a minimum of **3 eligible comparable records**; otherwise yields `InsufficientData` with clear recommendations.
  - Computes statistical **Median**, **25th Percentile**, **75th Percentile** (Interquartile Range - IQR), and **Min/Max** range.
  - Applies $1.5 \times \text{IQR}$ outlier rejection to eliminate speculative asking spikes.
  - Computes 80% confidence intervals and confidence rating (`High`, `Moderate`, `Low`).
  - Converts rates bidirectionally between `₹ / Cent` and `₹ / Sq.Ft` ($1\text{ Cent} = 435.6\text{ Sq.Ft}$).
- **`CsvLandPriceImporter` (`ICsvLandPriceImporter`)**:
  - Ingests standard RFC 4180 CSV files up to 5 MB and 5,000 rows.
  - Two-phase execution: Dry-run preview (`dryRun: true`) and permanent commit (`dryRun: false`).
  - Row-level diagnostics reporting missing columns, invalid coordinates, unsupported units, and invalid dates.
  - Built-in duplicate detection checking `(surveyNumber, locality, observationDate, normalizedRatePerCent)`.
- **`MlReadinessService` (`IMlReadinessService`)**:
  - Feature matrix generator preparing datasets for machine learning models.
  - Evaluates spatial coverage density, temporal leakage, and minimum record thresholds across Tamil Nadu districts.
- **Provider Adapter Architecture (`ILandPriceDataProvider`)**:
  - Extensible provider registry for statutory Tamil Nadu guideline values and external real estate registries.

### Infrastructure Layer (`Greenart.Infrastructure`)
- **`LandPriceDbContext`**: EF Core 8 with Npgsql PostGIS spatial mapping (`Point` geometry in SRID 4326).
- **Spatial Repository (`EfLandPriceRepository`)**:
  - PostGIS spatial indexing (`GIST` index on geometry column).
  - Geodesic spherical queries using `ST_DWithin(location, targetPoint, 1000, use_spheroid: true)`.
  - Auditing and batch tracking persistence.

### API Endpoints (`Greenart.Api`)
- `GET /api/v1/health`: PostGIS database and service health status.
- `POST /api/v1/estimates/calculate`: 1,000m geodesic property valuation calculation.
- `GET /api/v1/land-records`: Filtered registry listing (by locality, zoning, source, district).
- `POST /api/v1/land-records`: Single record creation.
- `PATCH /api/v1/land-records/{id}/verification`: Record moderation (Verify, Reject, Archive).
- `GET /api/v1/reference/localities`: Reference hubs with record counts and guideline rates.
- `POST /api/v1/land-records/import/csv`: Bulk CSV ingestion with dry-run support.
- `GET /api/v1/land-records/import/csv-template`: Downloadable CSV template.
- `GET /api/v1/land-records/import/history`: Audit log of batch imports.
- `GET /api/v1/coverage/summary`: Statewide 38-district coverage density analysis.
- `GET /api/v1/providers`: External data source provider registry status.
- `GET /api/v1/ml/readiness`: ML training data readiness audit report.

---

## 4. Admin Web Portal Implementations (`apps/admin-web/`)

### Layout & Navigation
- **Restrained Sidebar (210px width)**: Slimmed visual footprint, preserving client logo proportions, subtle 1px dividers, and an unobtrusive `System Online` status indicator.
- **Simplified Top Header**: Removed redundant coordinate, radius, and PostGIS version pills. Retained global search and user administrator profile badge.
- **Design Tokens**: Standardized corner radii (`4px`–`8px`), subtle borders (`#E2E8F0`), high-contrast dark typography (`#0F172A`), and zero emojis.

### Integrated Views
1. **Executive Dashboard (`activeTab === 'dashboard'`):**
   - KPI metrics: Total Land Records, Verified Records %, Pending Audit, Active Districts.
   - Source category & zoning distribution progress bars.
   - Quick-jump pilot corridor cards (Kannampalayam, Sulur, Saravanampatti).
   - Recent activity data table.
   - Dedicated **System & GIS Diagnostics** panel hosting PostGIS version, EPSG:4326 spatial reference, and 1,000m buffer configuration.
2. **Land Price Explorer (`activeTab === 'explorer'`):**
   - **Unified Control Strip**: Real-time searchable location input with autocomplete across Tamil Nadu, compact locality selector dropdown, zoning classification dropdown, and subtle quick-select chips.
   - **Expanded GIS Map (600px height)**: Leaflet map with 1,000m gold buffer circle, custom violet PIN with gold border, click-to-pin coordinate repositioning, and color-coded record pins with legend.
   - **Restructured Valuation Side Panel**:
     - Estimated Market Value hero rate in Lakhs/Cent (`₹10.75 Lakhs / Cent`).
     - Converted secondary rate (`₹2,468 / Sq.Ft`).
     - Confidence rating badge (`Moderate Confidence`) and evidence parcel count.
     - Typical Range (`25th–75th Percentile`) and Observed Range (`Min–Max`).
     - Concise legal disclaimer: *"Indicative statistical estimate derived from recent 1,000m comparables; not an official legal appraisal or guaranteed sale price."*
   - **Separate Statutory Benchmark Panel**: Isolated government guideline rate (`₹6.50 Lakhs / Cent`) and official TNREGINET notice.
   - **Transparent Insufficient Data State**: Explains $< 3$ record threshold without guessing or fabricating numbers.
3. **Land Records Registry (`activeTab === 'records'`):**
   - Search by locality, survey number, or landmark.
   - Multi-criteria filtering by source, verification status, and zoning.
   - Full enterprise data table with sticky headers, monospaced survey numbers, and inline audit actions (Verify, Reject, Archive).
   - "Add Record" modal dialog with strict validation.
4. **Batch CSV Import (`activeTab === 'import'`):**
   - Drag-and-drop file upload zone (5 MB / 5,000 rows limit).
   - Schema specification table outlining required and optional fields.
   - Real-time dry-run preview before committing to database.
   - Row-level diagnostic table highlighting errors and warnings.
   - Duplicate skip toggle and import history table.
5. **Statewide Coverage & ML Readiness (`activeTab === 'statewide'`):**
   - 38-district coverage density table with status badges (`PilotHub`, `Moderate`, `Sparse`, `NoData`).
   - Feature completeness metrics and ML model training readiness scores.
6. **Valuation Methodology (`activeTab === 'methodology'`):**
   - Comprehensive technical documentation explaining the median/IQR aggregation, geodesic buffer mathematics, and ethical data separation rules.

---

## 5. Mobile Application Implementations (`apps/mobile/`)

### Customer-Centric Workflow & Design
- **Branding & Header**: Official Greenart logo in a clean white pill with a live backend connectivity indicator.
- **Safe Area & Ergonomics**: Built with React Native and Safe Area Context, maintaining minimum $\ge 48\text{px}$ touch targets.
- **4-Destination Bottom Navigation Bar**: `Home`, `Estimate`, `Nearby`, `Guideline`.

### Mobile Screens
1. **Screen A: Home (`activeTab === 'home'`):**
   - Hero card: "Institutional Property Valuation" with direct "Start Property Valuation" CTA button.
   - Real-time search bar querying backend reference hubs and database records with instant autocomplete.
   - "How the Valuation Engine Works": 3 clear consumer trust cards detailing the 1,000m buffer, outlier-filtered median, and statutory separation.
   - "Active Pilot Corridors": Real reference hubs from the backend (Kannampalayam, Sulur, Saravanampatti) displaying live record counts and guideline benchmark rates.
2. **Screen B: Location Selection (`activeTab === 'estimate'`, `step === 'selection'`):**
   - Searchable location input with autocomplete dropdown.
   - Quick-select locality chips.
   - Interactive Map (Leaflet on Web with OpenStreetMap tiles; interactive touch canvas fallback on native) with pan/zoom controls and 1,000m gold buffer circle.
   - Land classification selector: Residential, Commercial, Agricultural, Industrial, Mixed-Use ($\ge 44\text{px}$ touch targets).
   - Collapsible advanced coordinates drawer (hidden by default).
   - Primary CTA: "Calculate Market Estimate".
3. **Screen C: Valuation Results (`activeTab === 'estimate'`, `step === 'result'`):**
   - Smooth "← Change Location" back button.
   - Estimated Market Value card with Lakhs/Cent display and instant toggle to `₹/Sq.Ft`.
   - Typical Range (25th–75th) and Observed Range (Min–Max).
   - Confidence level badge (`High`, `Moderate`, `Low`) and eligible comparable count.
   - Concise legal disclaimer.
   - Separate Statutory Guideline Benchmark card.
   - Insufficient Data state when $< 3$ records, with guideline fallback and recommendations.
   - "View Nearby Records" and "Adjust Location" action buttons.
4. **Screen D: Nearby Comparable Records (`activeTab === 'records'`):**
   - Real-time client-side geodesic/Haversine distance calculation in metres from selected target coordinates.
   - Radius scope toggle (`Within 1 km` vs `All Corridors`).
   - Source category filter chips (`All`, `Verified Deeds`, `Asking Prices`, `Guideline`, `Field Research`).
   - Comparable cards displaying distance badge (`120m away` in green), normalized rates, total price, original area, source category, and verification status.
5. **Screen E: Guideline & Methodology (`activeTab === 'guideline'`):**
   - Official TNREGINET statutory guideline benchmarks for all registered pilot hubs.
   - 5 consumer-friendly valuation methodology principles written in accessible language with zero technical jargon.

### Resilient Networking (`src/services/api.ts`)
- Centralized `MobileApiClient` with 8-second `AbortController` timeouts.
- Automatic runtime networking detection:
  - Web browser: `http://${window.location.hostname}:5039/api/v1`
  - Android emulator: `http://10.0.2.2:5039/api/v1`
  - iOS simulator / Localhost: `http://localhost:5039/api/v1`
  - Production configurable via `EXPO_PUBLIC_API_URL`.
- Health check polling for live connection status.

---

## 6. Automated Testing & Verification Results

### Test Suite Execution
- **Backend Tests (`Greenart.sln`)**: **115 / 115 tests passed** (0 failures, 0 skipped):
  - 78 Unit tests (`EstimationEngineTests`, `CsvLandPriceImporterTests`, `TamilNaduGeoBoundsTests`, `MlReadinessServiceTests`, `DataProviderRegistryTests`).
  - 37 Integration tests (`CsvBulkIngestionIntegrationTests`, `CsvImportEndpointHttpTests`, `StatewideCoverageEndpointTests`).
- **Admin Web Build (`apps/admin-web`)**:
  - `npm run build` executed in **1.22s** with **0 TypeScript and Vite errors**.
- **Mobile TypeScript & Export (`apps/mobile`)**:
  - `npx tsc --noEmit` passed with **0 errors**.
  - `npx expo export --platform web` bundled 177 modules in **2.9s** with **0 errors**.
- **AST Scan**: Verified **0 emojis** and **0 promotional marketing slogans** remaining in source code.

---

## 7. Quick Start & Local Development

### 1. Start Database
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### 2. Run Backend API
```bash
cd backend
dotnet restore
dotnet test Greenart.sln
cd Greenart.Api
dotnet run
```
Swagger UI will be accessible at: `http://localhost:5039/swagger`

### 3. Run Admin Web Dashboard
```bash
cd apps/admin-web
npm install
npm run dev
```
Accessible at: `http://localhost:5173`

### 4. Run Customer Mobile App
```bash
cd apps/mobile
npm install
npm run web
# For native emulators: npm run android / npm run ios
```
Accessible at: `http://localhost:8081` (or specified Expo port)

---

## 8. Data Consistency & Business Integrity Rules

1. **Strict Data Separation**: Statutory Government Guideline Values and open-market sale deed transactions are never blended into a single average.
2. **Evidence Thresholds**: A minimum of 3 comparable records within 1,000 metres is strictly enforced before calculating an estimate.
3. **Target Location Independence**: The user's device GPS is never assumed to be the property location; all valuations center on user-specified coordinates.
4. **Unified PostgreSQL/PostGIS Database**: Admin-imported records and mobile consumer valuations operate against the exact same data source and business logic.
