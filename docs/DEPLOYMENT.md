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

