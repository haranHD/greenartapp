# Deployment Topology & Strategy — Greenart Properties

> [!CAUTION]
> **No Cloud Resources or Accounts Have Been Purchased.**
> All provider recommendations, account names, and cost projections below represent future architectural options. No production resources may be provisioned or billed without explicit client authorization and payment.

---

## 1. Planned Deployment Architecture

```text
                               +------------------------------------+
                               |     DNS: greenart.group            |
                               |     (Registration Pending Email)   |
                               +------------------------------------+
                                                  |
                        +-------------------------+-------------------------+
                        |                                                   |
                        v                                                   v
         +-----------------------------+                     +-----------------------------+
         |     Admin Web Frontend      |                     |      Backend API Service    |
         |     (Static SPA on CDN)     |                     |     (.NET 8 Docker Container)|
         |     e.g., admin.greenart.   |                     |     e.g., api.greenart.group|
         |     group                   |                     |                             |
         +-----------------------------+                     +-----------------------------+
                                                                            |
                                                                            | Internal VPC / SSL
                                                                            v
                                                             +-----------------------------+
                                                             |   Managed PostgreSQL DB     |
                                                             |   PostGIS 3.4 Enabled       |
                                                             |   Daily Automated Backups   |
                                                             +-----------------------------+

         +-----------------------------+
         |     Customer Mobile App     |
         |    (React Native / Expo)    |
         |    Android APK / App Store  |
         +-----------------------------+
```

---

## 2. Environment Matrix

| Environment | Purpose | Database | API URL | Frontend URL |
| :--- | :--- | :--- | :--- | :--- |
| **Local Development** | Engineering & feature validation | Local Docker PostGIS (`localhost:5432`) | `http://localhost:5000` | `http://localhost:5173` |
| **Staging / UAT** | Pre-release validation & pilot testing | Isolated managed PostgreSQL | `https://api-staging.greenart.group` | `https://admin-staging.greenart.group` |
| **Production** | Live end-user service | High-availability PostGIS instance | `https://api.greenart.group` | `https://admin.greenart.group` |

---

## 3. Potential Hosting Providers & Evaluation

| Component | Architecture Option A (Fully Managed Cloud) | Architecture Option B (Self-Hosted VPS) | Status |
| :--- | :--- | :--- | :--- |
| **Backend API** | Azure App Service / AWS App Runner | Docker container on Hetzner / DigitalOcean | Undecided |
| **Database** | Azure Database for PostgreSQL / Neon PostGIS | Dedicated PostgreSQL + PostGIS container | Undecided |
| **Admin Web** | Cloudflare Pages / AWS S3 + CloudFront | Nginx static container on VPS | Undecided |
| **Domain & DNS** | Cloudflare DNS / Namecheap | Cloudflare DNS | Pending Email & Payment |

---

## 4. Release & CI/CD Checklist (Future)

1. Run automated unit and integration tests (`tests/backend/`).
2. Verify EF Core database migration compatibility before applying.
3. Validate spatial GIST indexes are active on `LandPriceRecords`.
4. Run security dependency audit (`dotnet list package --vulnerable`, `npm audit`).
5. Ensure environment variables and secrets are populated in target host.

---

## 5. Required Environment Variable Specifications (Names Only — No Secrets)

### 5.1 Render Cloud Service (Backend .NET 8 Web API)
Configure these in the Render Dashboard under **Environment**:

| Variable Name | Required | Purpose |
| :--- | :--- | :--- |
| `ASPNETCORE_ENVIRONMENT` | Yes | Set to `Production`. Prevents demo seeding and swagger leaks. |
| `PORT` | Auto | Render sets this automatically (e.g. `10000`); ASP.NET Core binds to `0.0.0.0:${PORT}`. |
| `DATABASE_URL` | Yes | Managed PostGIS PostgreSQL connection URI (`postgresql://...`). |
| `ADMIN_API_KEY` | Yes | Shared secret for administrative operations via `X-Admin-Key`. Required in Production. |
| `JWT_SECRET_KEY` | Yes | Cryptographic key (>= 32 characters) for signing authentication tokens. |
| `JWT_ISSUER` | Yes | JWT issuer domain (e.g. `greenart.group`). |
| `JWT_AUDIENCE` | Yes | JWT audience identifier (e.g. `greenart-clients`). |
| `GEOCODING_API_KEY` | Yes | Google Places API (New) key for reverse geocoding and locality autocomplete. |
| `LANDLENS_API_KEY` | Optional | LandLens platform key for statutory TNREGINET guideline benchmarks. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for qualitative summaries. Encapsulated server-side only. |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-1.5-flash`. |
| `SMTP_HOST` | Optional | SMTP mail host (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | Optional | SMTP mail port (e.g. `587`). |
| `SMTP_ENABLE_SSL` | Optional | `true` or `false`. |
| `SMTP_USERNAME` | Optional | Workspace / Gmail user for sending transactional OTPs. |
| `SMTP_PASSWORD` | Optional | 16-character Google App Password. |
| `SMTP_FROM_EMAIL` | Optional | Sender email address. |
| `SMTP_FROM_NAME` | Optional | Sender display name (e.g. `"Greenart Properties"`). |
| `ALLOWED_CORS_ORIGINS` | Yes | Comma-separated allowed origins (e.g. `https://admin.greenart.group`). |

### 5.2 Expo Application Services (EAS Build — Mobile Application)
Configure these via `eas secret:create` or in Expo Dashboard under **Project Secrets**:

| Variable Name | Required | Purpose |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Yes | HTTPS endpoint of the deployed backend (e.g. `https://greenartapp-1.onrender.com/api/v1`). |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Google Maps Android SDK / Maps JavaScript API key for client-side rendering. |
| `EXPO_PUBLIC_MAP_PROVIDER` | No | Default `google` or `osm`. |

> [!CAUTION]
> **No AI or Administrative Keys in Mobile App:**
> `GEMINI_API_KEY`, `ADMIN_API_KEY`, and `LANDLENS_API_KEY` must **never** be injected into EAS or mobile bundles. All LLM and statutory queries are routed strictly through the backend.

### 5.3 Admin Web (Vercel / Cloudflare Pages)
Configure these under **Environment Variables**:

| Variable Name | Required | Purpose |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | HTTPS endpoint of the deployed backend API (`https://greenartapp-1.onrender.com/api/v1`). |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JavaScript API key for admin parcel boundaries. |

