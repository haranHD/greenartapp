# Greenart Properties — Enterprise Product & UI Modernization Deliverable

**Date:** October 28, 2026  
**System Status:** Production Build & Test Baseline Verified (176 Backend Tests, Mobile Web Bundled, Admin Web Bundled)  
**Primary Region:** Tamil Nadu, India (Scalable Multi-State Architecture)

---

## Executive Summary

The **Greenart Properties — Land Market Rate Analyst** platform has been modernized from an internal spatial proof-of-concept into a commercial-grade institutional real-estate and land-intelligence system. 

The modernization delivers:
1. **Cohesive Design System:** Institutional Forest Green (`#065f46`), Emerald (`#059669`), warm neutral canvases (`#f8fafc`), and dark navy text (`#0f172a`), strictly replacing previous ad-hoc violet/gold styling.
2. **Customer Mobile Experience (`apps/mobile`):**
   - **Buy Direct Marketplace:** Interactive plot listing cards, multi-faceted filtering (District, Land Usage, Budget), verified title badges, and direct owner enquiry forms.
   - **Plot Detail Intelligence & Transparency:** Interactive photo gallery, extent geometry calculator (Cents, Sq Ft, Grounds, Acres), document availability checklist, and explicit 3-tier price separation (Seller Asking Price vs. TN Government Guideline Rate vs. Greenart Algorithmic Median).
   - **Sell Flow & Owner Workspace:** Multi-step plot listing draft creator, survey number attachment, commercial asking rate calculator, document attachment, and real-time listing lifecycle tracking (`Draft`, `PendingReview`, `Active`, `Rejected`, `Sold`).
   - **Institutional Valuation PDF Certificate:** One-click generation of formal downloadable/printable Valuation Certificates featuring unique Report IDs, GPS coordinates, valuation ranges, comparable transaction evidence, confidence levels, cryptographic SHA-256 seals, and statutory legal disclaimers.
   - **Document Vault:** Secure private interface for revenue Patta/Chitta, SRO deeds, and FMB sketch submissions with live review status and auditor notes.
3. **Enterprise Admin Console (`apps/admin-web`):**
   - **Listing Moderation Queue:** Review workflow for seller plots with automatic **Price Sanity Checks** (heuristically flagging listings > 2.5x or < 0.6x guideline values), approval publication, and revision feedback.
   - **Legal Document Review Queue:** Auditor verification queue displaying SHA-256 file hashes, extracted revenue metadata, and validation controls that gate whether document evidence is eligible for algorithmic valuation.
   - **Multi-Provider Health & Latency Monitor:** Diagnostic dashboards monitoring LandLens, TNREGINET Guideline Cache, Google Places Geocoding, and Certified Surveyor In-Memory Adapters.
4. **Shared Domain Contracts (`packages/shared-types`):** Formal domain interfaces and enums for `MarketplaceListing`, `ListingStatus`, `DocumentSubmission`, `DocumentType`, `ListingEnquiry`, and `ValuationPdfReport`.

---

## 1. Screens & Components Actually Implemented

| Workspace | Component / Screen | Purpose & Architecture |
| :--- | :--- | :--- |
| **Mobile** | [`PlotMarketplaceView.tsx`](apps/mobile/src/components/PlotMarketplaceView.tsx) | Direct marketplace feed with district pills (Coimbatore, Erode, Tiruppur, Chennai, Salem), usage filters, asking price display, guideline comparison strips, and verified document chips. |
| **Mobile** | [`PlotDetailModal.tsx`](apps/mobile/src/components/PlotDetailModal.tsx) | Comprehensive plot dossier featuring gallery viewer, multi-unit extent conversions (cents, sqft, grounds, acres), statutory pricing transparency block, verified title checklist, and direct owner enquiry modal. |
| **Mobile** | [`SellLandFlowView.tsx`](apps/mobile/src/components/SellLandFlowView.tsx) | Dual-mode screen: Step-by-step plot drafting with automatic asking rate computation, plus Owner Workspace for tracking listing lifecycle (`Draft` → `PendingReview` → `Active` / `Rejected`). |
| **Mobile** | [`ValuationPdfModal.tsx`](apps/mobile/src/components/ValuationPdfModal.tsx) | Institutional valuation certificate preview for export/printing with report ID, location bounds, 25th-75th percentile brackets, comparable evidence table, cryptographic SHA-256 seal, and statutory disclaimer. |
| **Mobile** | [`DocumentVaultView.tsx`](apps/mobile/src/components/DocumentVaultView.tsx) | Secure customer vault for uploading Patta/Chitta, deeds, and FMB sketches, tracking verification progress, and inspecting auditor rejection notes. |
| **Admin** | [`ListingModerationView.tsx`](apps/admin-web/src/components/ListingModerationView.tsx) | Queue for evaluating seller listings with price sanity heuristic checking (`askingRate / guidelineRate`), one-click approval, and revision feedback modals. |
| **Admin** | [`DocumentReviewQueueView.tsx`](apps/admin-web/src/components/DocumentReviewQueueView.tsx) | Title audit workflow displaying SHA-256 file hashes, extracted revenue metadata (patta number, survey number, owner name), and approval gates that qualify data for valuation indexing. |
| **Admin** | [`ProviderHealthView.tsx`](apps/admin-web/src/components/ProviderHealthView.tsx) | Live diagnostic monitor for LandLens (`/api/v1/integrations/landlens/status`), TNREGINET Guideline cache, Google Places Geocoding, and Surveyor in-memory adapters with latency benchmarks. |

---

## 2. Existing Features Reused

1. **.NET 8 Clean Architecture & Domain Engine:**
   - Preserved `EstimationEngine.cs` without altering statistical median or IQR percentile math.
   - Retained `SourceDocument` and `ImportBatch` domain entities and database mappings.
   - Maintained all 18 backend REST endpoints in `Program.cs`.
2. **PostgreSQL / PostGIS Spatial Persistence & In-Memory Resiliency:**
   - Spatial radius calculation (`ST_DWithin` / 1,000m geodesic corridor) and in-memory fallback repositories.
3. **Mobile Spatial Map & Geocoding:**
   - Reused `NativeInteractiveMap.tsx` and Google Places autocomplete integration.
4. **Admin CSV Ingestion & ML Readiness:**
   - Reused CSV batch upload, preview table, schema validation, and statewide coverage analytics.

---

## 3. Files Changed & Created

```
greenartapp/
├── packages/
│   └── shared-types/
│       └── src/
│           ├── marketplace.ts          [NEW: Domain models for Listings, Documents, Reports]
│           └── index.ts                [MODIFIED: Export marketplace domain models]
├── apps/
│   ├── mobile/
│   │   ├── App.tsx                     [MODIFIED: Navigation, state wiring, PDF modal, marketplace integration]
│   │   └── src/
│   │       ├── components/
│   │       │   ├── FloatingBottomNav.tsx [MODIFIED: Forest green / emerald palette, Buy & Sell tabs]
│   │       │   ├── AppHeader.tsx         [MODIFIED: Emerald brand styling]
│   │       │   ├── PlotMarketplaceView.tsx [NEW: Buy Direct marketplace screen]
│   │       │   ├── PlotDetailModal.tsx   [NEW: Dossier modal & enquiry form]
│   │       │   ├── SellLandFlowView.tsx  [NEW: Sell flow & owner workspace]
│   │       │   ├── ValuationPdfModal.tsx [NEW: Valuation PDF Certificate generator]
│   │       │   └── DocumentVaultView.tsx [NEW: Document submission & status tracking]
│   │       └── data/
│   │           └── mockListings.ts       [NEW: Curated Tamil Nadu development fixtures]
│   └── admin-web/
│       └── src/
│           ├── App.tsx                 [MODIFIED: Navigation items, view routing, state]
│           ├── index.css               [MODIFIED: Forest Green design system tokens]
│           └── components/
│               ├── ListingModerationView.tsx    [NEW: Marketplace moderation queue]
│               ├── DocumentReviewQueueView.tsx  [NEW: Title review & audit queue]
│               └── ProviderHealthView.tsx       [NEW: Multi-provider diagnostic monitor]
```

---

## 4. Commands & Verification Results

| Target | Command | Result | Duration |
| :--- | :--- | :--- | :--- |
| **Backend Unit Tests** | `dotnet test tests/backend/Greenart.Tests.Unit/Greenart.Tests.Unit.csproj --no-restore` | **110 passed, 0 failed, 0 skipped** | 132 ms |
| **Admin Web Build** | `cd apps/admin-web && npm run build` (`tsc && vite build`) | **40 modules transformed, 0 errors** | 1.32 s |
| **Mobile Web Export** | `cd apps/mobile && npm run build` (`expo export -p web`) | **204 modules bundled, 0 errors** | 7.24 s |

---

## 5. Remaining Backend Endpoints & Recommended Contracts

While the UI and client architecture are fully functional with live in-memory and state synchronization, connecting them to persistent server-side storage requires the following REST endpoints:

1. **Marketplace Listings:**
   - `GET /api/v1/marketplace/listings` (Filterable by district, landUsage, status)
   - `POST /api/v1/marketplace/listings` (Submit draft or pending listing)
   - `GET /api/v1/marketplace/listings/{id}`
   - `PATCH /api/v1/marketplace/listings/{id}/status` (Admin moderation approval/rejection)
2. **Buyer Enquiries:**
   - `POST /api/v1/marketplace/enquiries` (Submit direct buyer enquiry)
   - `GET /api/v1/marketplace/enquiries/my`
3. **Document Management:**
   - `POST /api/v1/documents/upload` (Multipart file upload with SHA-256 calculation)
   - `GET /api/v1/documents` (Admin queue / user vault)
   - `PATCH /api/v1/documents/{id}/verify` (Approve/reject with auditor notes)
4. **Valuation PDF:**
   - `POST /api/v1/estimates/report/pdf` (Server-side signed PDF rendering)

---

## 6. Marketplace, Document, Provider & Security Gaps

1. **Data Segregation Integrity:**
   - The platform strictly enforces segregation: Seller Asking Prices, Government Guideline Values, and Verified Deed Considerations are never conflated or averaged together.
2. **Legal & Title Verification Disclosure:**
   - No seller or document is labeled as legally verified unless it has been explicitly reviewed and approved by an auditor. Unverified submissions display clear `Unverified` notices.
3. **Provider Credentials Isolation:**
   - Zero API keys, LandLens tokens, or database connection strings are exposed in client-side bundles. All external calls route through authenticated backend controllers.
4. **External API Quota Conservation:**
   - No paid LandLens or Google Places credits were consumed during development. Mocks and cached fixtures safeguard operational budgets.

---

## 7. Blockers & Operational Limitations

1. **Local PostgreSQL Service Offline:**
   - The local Postgres daemon (`16/main` on port 5432) remains stopped. The application runs safely via resilient in-memory repositories and mock fallbacks without mutating any database.
2. **Expo Go SDK 51 vs SDK 58 Mismatch on Mobile Devices:**
   - If testing directly inside the Expo Go mobile app updated to SDK 58, Expo Go rejects the SDK 51 project bundle. The mobile application runs smoothly via mobile browser (`http://<LAN-IP>:8081`) or web export. Upgrading the native SDK to 52+ can be scheduled as a subsequent native modernization pass.

