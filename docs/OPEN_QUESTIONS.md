# Open Questions & Decision Log — Greenart Properties

This document registers critical business, technical, legal, and operational decisions awaiting stakeholder confirmation before production commitment or commercial expenditure.

---

## 1. Commercial Terms, R&D Scope & Payment Status
- **Issue:** Development is in local foundation stage. The client has chosen the domain `greenart.group`, but registration requires a company-owned corporate email address and payment release.
- **Action Required:**
  - Client to supply official company email address for domain registrar account.
  - Finalize scope of work, milestone deliverables, and payment schedule.
  - Ensure no recurring subscriptions, cloud services, or domain purchases occur prior to written authorization.
- **Status:** Pending Client Confirmation.

---

## 2. Target Mobile Deliverable & Device Support
- **Issue:** Clarify the exact packaging and distribution target for the React Native / Expo application (`apps/mobile/`).
- **Options:**
  - Internal testing APK / iOS TestFlight distribution.
  - Google Play Store & Apple App Store public release.
- **Questions:**
  - What are the minimum supported OS versions (e.g., Android 10+, iOS 15+)?
  - Will client provide Google Play Console and Apple Developer Program accounts?
- **Status:** Pending Client Confirmation.

---

## 3. Authentication & OTP Provider Requirements
- **Issue:** Customer authentication requires mobile number verification via SMS OTP.
- **Questions:**
  - Which SMS provider will be contracted for India production OTP (e.g., MSG91, Fast2SMS, Twilio)?
  - For local development and staging, is a secure development mock mode (fixed test OTP or console logging) approved?
  - What rate limits (e.g., max 3 OTP requests per 10 minutes per IP/number) and cooldown periods apply?
- **Status:** Pending Client Confirmation.

---

## 4. Initial Coimbatore Pilot Locations
- **Issue:** To prevent claiming unverified coverage, the initial pilot must focus on a defined set of localities in and around Coimbatore.
- **Proposed Candidates:**
  - Kannampalayam
  - Sulur / Neelambur corridor
  - Saravanampatti
  - Pollachi / Kinathukadavu agricultural/residential belt
- **Question:** What are the exact pilot localities Greenart Properties wants prioritized for initial data collection and calibration?
- **Status:** Pending Client Confirmation.

---

## 5. Legally Accessible Data Sources & Usage Permissions
- **Issue:** Web scraping or automated extraction of government registration portals (e.g., TNREGINET) may violate terms of service, carry legal risks, or face technical IP blocking.
- **Action Required:**
  - Confirm permissible mechanisms for obtaining guideline values (official open datasets or manual verified entry).
  - Confirm legal status and handling of SRO registered transaction records.
  - Establish data vetting workflow for client-provided research documents (e.g., layout area breakup sheets, broker records) to ensure they are strictly tagged as unverified research data.
- **Status:** Pending Legal / Stakeholder Review.

---

## 6. Approved Estimation Methodology & Confidence Rules
- **Issue:** Setting statistical thresholds for price calculation.
- **Proposed Baseline:**
  - `< 3 records:` Insufficient data (no estimate rendered; user notified).
  - `3 - 4 records:` Low confidence estimate with prominent disclaimer.
  - `5 - 9 records:` Moderate confidence estimate.
  - `≥ 10 records:` High confidence estimate.
  - Central tendency: **Median** rate.
  - Spread: **Interquartile Range (25th to 75th percentile)**.
  - Max record age: **24 months** (older records excluded from current market rates).
- **Question:** Does Greenart Properties approve these exact baseline thresholds?
- **Status:** Pending Approval.

---

## 7. Map & Geocoding Provider & Operating Costs
- **Issue:** Interactive map rendering and location search (geocoding) incur costs at scale.
- **Options:**
  - **Development:** OpenStreetMap tiles + Leaflet + Nominatim geocoding (zero cost, subject to fair-use rate limits).
  - **Production:** Mapbox, Google Maps Platform, or Ola Maps.
- **Question:** Does the client prefer an open-source zero-cost map stack for the pilot, or will an API budget be allocated for commercial geocoding?
- **Status:** Pending Approval.

---

## 8. Hosting & Operating Budget
- **Issue:** Selecting hosting providers and sizing infrastructure.
- **Options:**
  - Fully managed cloud (e.g., Azure App Service / AWS ECS + Managed PostgreSQL with PostGIS on Neon/Supabase/Azure).
  - Dedicated VPS (e.g., DigitalOcean / Hetzner) running Docker containers.
- **Question:** What is the monthly operating budget ceiling for hosting and database infrastructure?
- **Status:** Pending Approval.

---

## 9. Report Template & Acceptance Criteria
- **Issue:** The mobile app will offer a valuation summary report.
- **Questions:**
  - What visual format is required (in-app interactive screen vs. downloadable PDF)?
  - What statutory disclaimer text must be displayed to protect Greenart Properties from financial/legal liability?
- **Status:** Pending Stakeholder Review.

