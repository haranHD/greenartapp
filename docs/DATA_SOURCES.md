# Data Sources & Provenance Policy — Greenart Properties

## 1. Core Principle of Evidence Integrity

Data integrity is the foundational differentiator of the Greenart Properties Land Market Rate Analyst platform. Under no circumstances may data types be commingled, misrepresented, or fabricated.

---

## 2. Distinct Data Categories

The system enforces strict categorization across the data pipeline:

| Category | Definition | Intended Use & Rules |
| :--- | :--- | :--- |
| **1. Official Government Guideline Value** | Statutory minimum valuation fixed by state revenue authorities (e.g., TNREGINET). | Used as a regulatory baseline for stamp duty. **Must NEVER be presented as an actual market sale price.** |
| **2. Verified Registered Transaction** | Legally registered conveyance deeds executed at the Sub-Registrar Office (SRO). | Highest-confidence evidence of completed sales. Requires independent document audit before verification. |
| **3. Advertised Asking Price** | Asking prices sourced from classified listings, broker advertisements, or portals. | Subject to speculative markup and negotiation margins. **Must NEVER be presented as a completed transaction.** |
| **4. Client- / Broker-Supplied Research Record** | Field research notes, layout breakup sheets, or local broker estimates (e.g., Manakadavu, Ponnivadi, Kannampalayam). | Labelled strictly as **Unverified Research Estimates**. May be used for baseline pilot calibration, but never as verified legal evidence. |
| **5. Model-Derived / Indicative Estimate** | Algorithmic output produced by the rule-based estimation engine. | Statistical estimate based on comparable records. **Must ALWAYS be accompanied by sample size, date range, and legal disclaimer.** |

---

## 3. Mandatory Provenance Attributes

Every persisted land record in the database must capture:
- **Administrative Location:** Country, State, District, Taluk / Sub-District, Village / Locality, Street / Landmark.
- **Geographic Point:** Latitude, Longitude, Spatial Accuracy (e.g., parcel-exact, street-level, village-centroid).
- **Land Parcel Identifiers:** Survey Number / Sub-division Number, Patta Number (where available).
- **Zoning & Classification:** Agricultural (Wet/Dry), Residential, Commercial, Industrial.
- **Original Measurement & Pricing:** Original Area, Original Unit (Sq.Ft, Cent, Acre, Ground, Kuzhi), Original Total Price, Original Unit Rate.
- **Normalized Values:** Normalized Area (Sq.Meters), Normalized Rate (₹ / Sq.Ft, ₹ / Cent).
- **Source Details:** Source Category, Source Document Reference / Registration Number, Source URL (if public).
- **Dates & Audit:** Record Observation/Transaction Date, Data Ingestion Date, Verification Status, Audit User ID.

---

## 4. Legal & Access Review (Pending Research)

> [!IMPORTANT]
> External data source access is currently **unvalidated**. Automated web scraping or bulk harvesting of government portals (such as TNREGINET) must not be undertaken without prior legal review of terms of service and access authorization.

1. **Government Guideline Portals:**
   - Guideline values in Tamil Nadu are publicly searchable by street and survey number.
   - Feasibility of programmatic access, permitted downloads, or official APIs must be formally documented.
2. **SRO Registration Data:**
   - Certified copies of registered deeds require statutory search fees and formal application.
   - Bulk digital access requires licensed data partnerships or administrative curation.
3. **Third-Party Listings:**
   - Commercial property portals strictly prohibit automated scraping under their terms of use.
   - Any external integration requires commercial API licensing.

---

## 5. Known Limitations & Data Gaps

- **Rural Density:** Rural agricultural parcels have lower transaction frequency compared to urban centers. A 1,000-meter radius may yield fewer than 3 records in remote areas, properly triggering the "Insufficient Data" rule.
- **Guideline Lag:** Statutory guideline values are updated periodically and often lag behind prevailing open-market economic valuations.
- **Unverified Development Fixtures:** All initial seed data used in local development must be explicitly flagged with `IsSynthetic = true` or `VerificationStatus = Unverified`.

