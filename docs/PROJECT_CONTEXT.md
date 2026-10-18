# Project Context — Greenart Properties: Land Market Rate Analyst

## 1. Executive Summary
- **Client Organization:** Greenart Properties
- **Product Title:** Greenart Properties — Land Market Rate Analyst
- **Branded Domain Choice:** `greenart.group` (Domain registration and commercial deployment are on hold pending client-owned business email setup and milestone payment release).
- **Core Mission:** Provide a high-integrity, data-driven mobile and web platform that enables property seekers, investors, and administrators to evaluate realistic market rates for land parcels in India, initiating with a strictly controlled pilot in Coimbatore, Tamil Nadu.

---

## 2. Target Users & Personas

### 2.1 Customer / Property Seeker (Mobile App: React Native / Expo)
- **Profile:** Individuals, landowners, or real estate investors looking to estimate land prices in target regions regardless of their current physical location (e.g., a buyer residing in Chennai or Bengaluru evaluating land plots in Coimbatore or Pollachi).
- **Primary Needs:**
  - Fast, intuitive map-based location selection (explicit target coordinate selection, independent of device GPS).
  - Clear indicative price range (e.g., in ₹/Cent and ₹/Sq.Ft) backed by verified or documented comparable evidence within a 1,000-meter radius.
  - Transparent disclosure of sample size, date ranges, and source categories.
  - Immediate, honest feedback ("Insufficient Data") when local data is sparse or unverified.
  - Access to downloadable or viewable valuation summary reports.

### 2.2 System Administrator / Data Reviewer (Admin Web App: React + Vite)
- **Profile:** Greenart Properties market analysts and administrators managing geographic datasets and valuation integrity.
- **Primary Needs:**
  - Structured management of land price records across all classifications (residential, agricultural, commercial, industrial).
  - Strict classification and verification workflow (marking records as unverified, verified, or archived).
  - Batch data ingestion (CSV / Excel imports) with row-level validation and error reporting.
  - Data freshness monitoring and audit trail inspection.

---

## 3. Technology Stack Summary

| Layer | Technology | Rationale & Boundaries |
| :--- | :--- | :--- |
| **Mobile App** | React Native, Expo, TypeScript | Native iOS & Android capabilities; standalone mobile client communicating solely via REST API. |
| **Admin Web App** | React, Vite, TypeScript | Fast back-office dashboard; decoupled from mobile codebase and isolated from direct DB access. |
| **Backend API** | ASP.NET Core Web API (.NET 8), C# | Enterprise Clean Architecture; robust spatial support via NetTopologySuite; high performance. |
| **Database** | PostgreSQL 16+ with PostGIS 3.4+ | Industry standard for meter-accurate spatial queries, geographic indexing (`GIST`), and spatial geometry. |
| **Shared Packages** | TypeScript (`shared-types`, `contracts`) | Monorepo package sharing DTO shapes and enums between mobile and admin-web. |

---

## 4. Fundamental Business Principles & Constraints

1. **Strict Category Separation:**
   - Official Government Guideline Value
   - Verified Registered Transaction Price
   - Advertised Asking Price
   - Client- / Broker-Supplied Research Record
   - System-Calculated Indicative Estimate
   *No category may ever be substituted or misrepresented as another.*
2. **Transparent Estimation:**
   - Rule-based statistical calculation (Median + Interquartile Range) rather than opaque black-box machine learning models.
   - Refusal to estimate when comparable evidence is inadequate.
3. **No Financial or Commercial Premature Action:**
   - Zero spend incurred before commercial agreements, email setup, and payment completion.
   - Domain `greenart.group` to be acquired under client ownership only after client business email is provided.

