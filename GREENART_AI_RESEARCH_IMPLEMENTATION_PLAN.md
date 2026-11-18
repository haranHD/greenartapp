# AI research implementation plan — 17 November 2026

## Phase 1: audited existing implementation

- `backend/Greenart.Application/Estimation/EstimationEngine.cs`: selects eligible independently verified completed transactions, requires three, computes its existing transaction estimate. Advertised asking prices and LandLens/TNREGINET statutory guideline benchmarks remain separate. No change to these calculations is planned.
- `backend/Greenart.Infrastructure/Services/PriceResearchModels.cs`: current OpenAI/Claude/Gemini adapters issue ungrounded text requests. Saved suggestions alone do not establish source evidence.
- `backend/Greenart.Infrastructure/Services/GeminiLandIntelligenceService.cs`: existing separate narrative Gemini integration; it is not an evidence-retrieval engine and defaults to an older model. Preserve its unrelated consumers.
- `backend/Greenart.Api/Pricing/{PriceResearchEndpoints,MobilePriceResearchEndpoints}.cs`: authenticated explicit mobile generation, durable request IDs, per-user/global daily caps, PostgreSQL advisory start lock, result caching, admin broker review/approval and immutable audit events. Reuse these routes and protections.
- `PriceResearch` / `PriceResearchConfiguration` / `LandPriceDbContext`: request, legacy proposals, broker ranges, approval and provenance already exist. `AuditEvent` stores administrator identity and transition history.
- `LandPriceRecord`, `SourceCategory`, existing Greenot evidence/property tables: transaction data must remain untouched; AI evidence and opinions will not be inserted into verified transaction records or ML labels.
- `apps/mobile/src/{screens/ValuationScreen,components/BrokerPriceRangeCard,services/api}.tsx/ts`: explicit research button and provisional range card; add area, evidence and research-review labels without redesigning other screens.
- `apps/admin-web/src/components/PriceResearchView.tsx` and typed API: reuse queue, broker and decision workflows; add filterable research/evidence/review details.
- `tests/backend/.../{PriceResearchTests,PriceResearchHttpTests}.cs`: reuse fake-provider and isolated in-memory HTTP test setup; no live provider requests in tests.

## Data design

Extend the existing `price_research` aggregate with request metadata (user, taluk, area/unit), immutable structured Gemini result/review JSON and spatial point. Add a child evidence table with FK, original amounts/areas, decimal normalized rates, source/retrieval dates and geography. Add a broker-observation child table for independently entered opinion metadata, typical rate, comparison metric and decision provenance. Continue using AuditEvent for previous/new state, administrator and reason. Keep legacy proposals/broker fields and endpoints compatible; do not silently convert legacy ungrounded proposals into eligible grounded research.

Generate a scoped additive EF migration and inspect its SQL. Do not apply migrations to production, deploy, seed prices, overwrite existing results, rotate credentials or restart the user's backend automatically. Record migration/application requirements in the handover.

## Services / source rules

Introduce application interfaces/DTOs and an infrastructure Gemini grounding/review service. Grounded research must include actual Google Search grounding references. First response evidence is checked against those references and independently fetched with SSRF-safe public-HTTPS retrieval, bounded bodies/timeouts and no automatic unsafe redirects. Reject invalid amounts, unit conversions, dates, duplicates, wrong category/locality and unsupported source types deterministically. Missing grounding/retrieval/evidence yields a nonnumeric status. Require at least three eligible distinct observations before review. Compute rates/ranges/median in backend decimal arithmetic; no model calculations, arbitrary buffers or AI-as-transaction labels.

Second Gemini task reviews source excerpts and deterministic checks. It is an AI evidence/consistency review, not independent real-world verification. Persist accepted/rejected IDs, contradictions, model/prompt versions, timestamps and token usage. Backend validation overrides unsupported PassedEvidenceReview claims. Skip this call when the first stage has insufficient evidence.

Sources are untrusted data, never instructions. Source excerpts are not rendered as HTML. Google grounding attribution/search-entry metadata must be retained and displayed safely. Reference APIs: https://ai.google.dev/gemini-api/docs/generate-content/google-search and https://ai.google.dev/gemini-api/docs/structured-output . Actual grounding/model account access is not verified by documentation or configuration alone.

## API / integration approach

Reuse `/pricing/research`, `/pricing/market-range`, `/admin/price-research` and existing broker/decision routes. Extend request DTOs compatibly with optional taluk/area/unit; grounded analysis requires valid area. Add public evidence lookup with filtered safe evidence fields, administrator detail/statistics/history and explicit refresh/correction/insufficient decisions. Existing authorization, anti-duplicate starts, timeouts, quotas and audit remain. New requests use Gemini only; preserve historical OpenAI/Claude results as legacy data.

Transaction-based results take precedence; research is an explicit fallback. Only adequate, source-supported, reviewed asking-price research may show a provisional numeric range. Approved broker opinions retain a distinct classification. All other cases show Insufficient Evidence with actionable status. Broker contact and internal notes are admin-only. Comparison uses abs(AI typical - broker typical) / broker typical * 100, a discrepancy metric rather than an accuracy score.

## Implementation sequence / validation

1. This audit/plan before feature edits.
2. Domain/DTO/schema + grounded research retrieval/normalization and focused tests.
3. Separate evidence review + persistence and focused tests.
4. Admin evidence queue, filters, broker observation and auditable decisions.
5. Mobile area/evidence/provisional statuses, existing design retained.
6. Backend build/unit/isolated integration, mobile TypeScript/tests/export, admin production build; record exact commands/results and limitations.

## Known risks / external requirements

- Last read-only Gemini credential check returned invalid key (401). No code can repair an invalid provider key; live access requires the owner to configure a valid credential. No paid API calls are authorized for tests.
- Grounding search may be billed separately. Two tasks are bounded; source availability and adequate observations are never guaranteed.
- Listing sites can block retrieval, omit dates/coordinates or duplicate listings. Fail closed or request manual review; do not invent missing metadata or a price.
- Generated migrations must exclude unrelated pre-existing Greenot snapshot drift. Keep changes additive and inspect the generated SQL.
- Broker input is administrator-entered opinion, not independent broker identity proof. Supporting-document references reuse existing storage conventions; do not pretend metadata is a real uploaded file.
- No ML model or automatic production deployment is in scope.

## Phase checkpoint

- Backend grounding/normalisation/review unit tests: 29 passed using fake model/source responses.
- Existing pricing HTTP regression checkpoint: 19 passed after routing new requests through the Gemini-only service.
- Additive migration generated; 16 unrelated Greenot drift operations excluded. New schema includes spatial indexes, FKs, numeric/area constraints and a unique refresh-parent link. No database migration applied.
- Admin build checkpoint passed after adding queue filters, evidence/review details and internal broker metadata.
- Mobile now collects area, keeps the transaction estimate first, and has a public supporting-evidence view. Final regression and browser checks remain below in the final validation report.

## Source-rights decision required before activation

During final provider-documentation verification, the current Google Grounding terms (https://ai.google.dev/gemini-api/terms#grounding-with-google-search) explicitly restrict collecting grounded results into a database and using returned links to identify pages for automated crawling/scraping. The requested historical research warehouse and independent URL fetching cannot be treated as licensed under those standard terms. Source selection therefore requires the brief's architectural confirmation.

The Google-grounded prototype is gated by `MARKET_RESEARCH_GOOGLE_STORAGE_AUTHORIZED=false`. This flag must not be enabled merely to bypass the restriction; written permission covering this precise storage/retrieval use is required. Automated tests set a test-only authorization flag and use wholly fabricated fixtures in memory, never provider results. No database migrations, deployments, provider calls or data collection have been performed.

Pending decision: use an authorized listing feed/client-supplied evidence for Gemini extraction/review and historical storage, or supply appropriate written permission for this Google-grounded use. The normalized evidence, broker-opinion, audit, queue and mobile presentation work is reusable with an authorized evidence provider. Do not report the production pipeline as ready until this decision and real provider access are resolved.

## Source decision accepted — 18 November 2026

The user selected an authorized listing feed or client-supplied evidence. The implementation now uses administrator-registered client-authorized public source references, with explicit retrieval/storage/display permission and an internal rights/contract reference. Gemini receives only retrieved source excerpts and public property facts, never the private rights reference. Google Search tools are not invoked. Missing authorized evidence returns Insufficient Evidence with zero model calls. Previously researched inputs remain immutable; new references create a linked follow-up exercise.

A provider-specific licensed-feed connector still requires the client's actual feed specification and access agreement; it is not simulated. The working manual source-reference path does not need a paid search integration. Both Google collection settings remain false and `MARKET_RESEARCH_SOURCE_MODE=AuthorizedEvidence` selects the accepted architecture.

## Final offline validation — 18 November 2026

AuthorizedEvidence implementation completed. 265 backend unit tests, 26 final pricing HTTP cases plus 26 other isolated integration cases, and 34 mobile tests passed. Admin production build, mobile TypeScript, Expo web and Android bundle exports passed. SQL regenerated with authorized-source metadata and geography indexes; migration remains unapplied. No live provider calls or backend restarts. See GREENART_AI_RESEARCH_IMPLEMENTATION_REPORT.md for file inventory, source setup, excluded tests and remaining device/live-data validation. Earlier Google-grounded checkpoint notes above are historical and superseded by the accepted source decision.
