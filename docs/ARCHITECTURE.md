# System Architecture — Greenart Properties: Land Market Rate Analyst

## 1. Architectural Style & Monorepo Design

The platform uses a modular, decoupled monorepo structure. Each component has an explicit, bounded context:

```text
                                  +---------------------------------------+
                                  |         External Client Layer         |
                                  +---------------------------------------+
                                      |                               |
                 HTTPS / REST         |                               |  HTTPS / REST
                                      v                               v
                     +----------------------------------+   +----------------------------------+
                     |   Customer Mobile Application    |   |      Admin Web Application       |
                     |   (React Native / Expo / TS)     |   |     (React / Vite / TS)          |
                     |   Location: apps/mobile/         |   |     Location: apps/admin-web/    |
                     +----------------------------------+   +----------------------------------+
                                      \                               /
                                       \                             /
                                        \                           /
                                         v                         v
                                  +---------------------------------------+
                                  |           Backend API Gateway         |
                                  |    ASP.NET Core Web API (.NET 8)      |
                                  |    Location: backend/Greenart.Api     |
                                  +---------------------------------------+
                                                      |
                                                      | In-Process Clean Architecture
                                                      v
                                  +---------------------------------------+
                                  |       Greenart.Application Layer      |
                                  |    (Use Cases, Estimation Engine,     |
                                  |     Unit Normalization, DTOs, Valid)  |
                                  +---------------------------------------+
                                      |                               |
                                      v                               v
                     +----------------------------------+   +----------------------------------+
                     |       Greenart.Domain Layer      |   |   Greenart.Infrastructure Layer  |
                     |   (Entities, Value Objects,      |   |   (EF Core 8, PostGIS NTS Provider|
                     |    Enums, Core Business Rules)   |   |    Spatial Repositories, Migr.)  |
                     +----------------------------------+   +----------------------------------+
                                                                      |
                                                                      | Npgsql / PostGIS Driver
                                                                      v
                                                    +-----------------------------------+
                                                    |        Database Persistence       |
                                                    |    PostgreSQL 16+ with PostGIS    |
                                                    |    Spatial GIST Indexes           |
                                                    |    Location: database/            |
                                                    +-----------------------------------+
```

---

## 2. Component Boundaries & Responsibilities

### 2.1 Customer Mobile Application (`apps/mobile/`)
- **Technology:** React Native, Expo SDK, TypeScript.
- **Responsibilities:**
  - Map exploration and user-selected coordinate pinpointing (independent of current physical device GPS).
  - Calling public/customer-facing estimation endpoints (`/api/v1/estimates/calculate`).
  - Rendering clear, understandable valuation ranges with full provenance details.
  - Displaying educational warnings when data is sparse or low-confidence.
- **Strict Boundary:** Never connects directly to the database. Never stores admin credentials or API master secrets.

### 2.2 Admin Web Application (`apps/admin-web/`)
- **Technology:** React, Vite, TypeScript.
- **Responsibilities:**
  - Authenticated back-office administrative portal.
  - Managing land price records, source attributions, and verification statuses.
  - Executing batch CSV/Excel data imports and viewing row-level validation reports.
  - Reviewing audit logs and system data quality metrics.
- **Strict Boundary:** Built and deployed as a standalone Single Page Application (SPA). Communicates strictly via authenticated API calls (`/api/v1/admin/...`).

### 2.3 Shared Packages (`packages/`)
- **`packages/contracts/`**: Defines HTTP API contracts, Swagger/OpenAPI specifications, and JSON payload definitions.
- **`packages/shared-types/`**: Common TypeScript models, interfaces, and enums shared between `apps/mobile/` and `apps/admin-web/` to eliminate duplicate type declarations.

### 2.4 Backend API Solution (`backend/`)
Following Clean Architecture principles:
- **`Greenart.Domain`**: Pure C# domain model. Contains core domain entities (`LandPriceRecord`, `AuditLog`, `SpatialBoundary`), Enums (`SourceCategory`, `VerificationStatus`, `LandUsageType`), and domain exceptions. Zero dependencies on external frameworks or databases.
- **`Greenart.Application`**: Orchestrates application use cases. Houses the Rule-Based Estimation Engine, Spatial Query Interfaces, Unit Normalization Service, DTOs, and FluentValidation rules.
- **`Greenart.Infrastructure`**: Implements persistence and external services. Contains the EF Core `LandPriceDbContext`, PostGIS spatial mappings (`NetTopologySuite`), spatial GIST index configurations, and database migrations.
- **`Greenart.Api`**: The HTTP boundary. Exposes REST controllers, Swagger documentation, JWT/Session middleware, CORS policies, rate limiting, and global exception handling.

---

## 3. Database & Spatial Query Responsibilities

- **Engine:** PostgreSQL 16+ with the PostGIS 3.4+ spatial extension.
- **Spatial Geometry Storage:** Points are stored in PostGIS geometry/geography types using SRID 4326 (WGS 84).
- **Proximity Search:** Executed natively inside PostGIS using spatial index-accelerated queries (`ST_DWithin` or `ST_Distance`) with distances computed in meters.
- **Schema Management:** Controlled exclusively via Entity Framework Core Migrations in `Greenart.Infrastructure`.

---

## 4. Planned Deployment Boundaries

When the project transitions to production (Phase 7):
1. **Frontend Web & CDN:** Static build of `apps/admin-web/` served via a secure CDN / static host.
2. **Mobile App:** Packaged through Expo Application Services (EAS) for distribution.
3. **Backend API:** Containerized Linux Docker container hosted on a managed container service (e.g., Azure App Service, AWS ECS, or a hardened VPS).
4. **Database:** Managed PostgreSQL instance with native PostGIS support and automated daily backups.

