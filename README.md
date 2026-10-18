# Greenart Properties — Land Market Rate Analyst

A secure, data-backed land market price estimation platform built for **Greenart Properties** (`greenart.group`).

---

## 1. Architecture Overview

The repository is organized as a modular monorepo:

```text
greenartapp/
├── apps/
│   ├── mobile/            # Customer mobile app (React Native, Expo, TypeScript)
│   └── admin-web/         # Back-office admin portal (React, Vite, TypeScript)
├── backend/               # ASP.NET Core (.NET 8) Web API
│   ├── Greenart.sln
│   ├── Greenart.Api/            # HTTP endpoints, Swagger, Auth, Middleware
│   ├── Greenart.Application/    # Use cases, DTOs, Estimation Engine, Interfaces
│   ├── Greenart.Domain/         # Core entities, Enums, Value Objects
│   └── Greenart.Infrastructure/ # EF Core, PostgreSQL/PostGIS, Persistence
├── packages/
│   ├── contracts/         # API contracts & schema specifications
│   └── shared-types/      # Common TypeScript types shared across apps
├── database/              # DB documentation, seed data scripts, PostGIS setup
├── tests/                 # Unit & integration test suites
│   ├── backend/           # .NET unit tests
│   ├── integration/       # API & spatial query integration tests
│   ├── mobile/            # Mobile component & logic tests
│   └── admin-web/         # Admin UI component tests
├── docs/                  # Architectural, security, and project documentation
└── infra/                 # Docker Compose & local environment configurations
```

---

## 2. Core Principles & Business Rules

1. **Strict Data Category Separation:**
   - Official Government Guideline Values
   - Verified Registered Transactions (SRO deeds)
   - Advertised Asking Prices
   - Client- or Broker-Supplied Records (e.g., historical research)
   - Model-Derived / Indicative Estimates
   *These categories are never conflated or presented as each other.*
2. **Transparent Estimation:** Rule-based statistical calculation (Median + Interquartile Range) with full disclosure of sample size, date ranges, and source categories.
3. **Graceful Insufficient Data Handling:** The platform refuses to display a speculative estimate when eligible comparable records are inadequate.
4. **Target Location Independence:** The user's device GPS is never assumed to be the property location. All searches center on explicit user-selected coordinates.

---

## 3. Getting Started (Local Development)

### Prerequisites
- **.NET SDK 8.0+**
- **Node.js v20+** & **npm 10+**
- **PostgreSQL 16+** with **PostGIS 3.4+** extension (or Docker)

### Step 1: Database
Start the local PostGIS container:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
*Alternatively, use an existing local PostgreSQL instance with `CREATE EXTENSION postgis;`.*

### Step 2: Backend API
```bash
cd backend
dotnet restore
dotnet build
dotnet run --project Greenart.Api
```
The API Swagger documentation will be accessible at: `https://localhost:5001/swagger` (or `http://localhost:5000/swagger`).

### Step 3: Admin Web App
```bash
cd apps/admin-web
npm install   # Run when ready
npm run dev
```

### Step 4: Customer Mobile App
```bash
cd apps/mobile
npm install   # Run when ready
npx expo start
```

---

## 4. Documentation Index

Detailed architectural and business specifications are in the [`docs/`](docs/) directory:

- [Project Context](docs/PROJECT_CONTEXT.md)
- [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)
- [Open Questions & Decisions](docs/OPEN_QUESTIONS.md)
- [Architecture & Boundaries](docs/ARCHITECTURE.md)
- [Data Sources & Provenance](docs/DATA_SOURCES.md)
- [API Conventions](docs/API_CONVENTIONS.md)
- [Security Baseline](docs/SECURITY.md)
- [Deployment Strategy](docs/DEPLOYMENT.md)
- [Handover Checklist](docs/HANDOVER.md)

