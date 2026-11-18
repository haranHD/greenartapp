# Evidence-assisted price research and broker review

## Price sources

The existing registered-sale estimator remains unchanged: at least three eligible completed sales are required. LandLens statutory guideline values and advertised asking-price benchmarks stay separate. AI research and broker opinions never create registered-sale records.

The new research path uses **client-authorized public source references**, not Google Search Grounding. An administrator registers 3–8 HTTPS references, a private rights/contract reference, and explicit authorization for retrieval, storage and public evidence display. These declarations must reflect actual permission; public availability alone is insufficient. A particular listing-feed integration requires the client's feed specification and agreement.

This follows the selected architecture after reviewing [Google's Grounding terms](https://ai.google.dev/gemini-api/terms#grounding-with-google-search). The historical database is not populated using Google Search results. Legacy Google settings remain false; the new service accepts AuthorizedEvidence mode only.

## Workflow

1. Admin creates a research exercise with coordinates, locality/district, land category, road access, radius and land area/unit. Register authorized source references in Market Price Verification.
2. Explicitly run Gemini analysis, or let an authenticated verified customer press Generate AI suggestion. Mobile reuses registered references; it cannot supply arbitrary source URLs. Search, refresh and saved-price lookup do not call models.
3. The server retrieves the authorized pages. Gemini extracts asking observations only from those excerpts. Private rights references, broker contacts and credentials are not supplied to the model.
4. Backend validation checks original price/area quotes, INR currency, asking context, category, observation date, quoted coordinates, radius, duplicates and unit conversions. Missing facts are not guessed. At least three usable distinct observations are required.
5. Sources are retrieved again. A separate Gemini task reviews the accepted facts and server-computed arithmetic. Changed sources, contradictions and unsupported facts cause manual review or insufficient evidence. Two calls to Gemini are not independent market verification.
6. A passing result can appear before broker approval as **AI-Assisted Asking-Price Research**. Its range uses the minimum and maximum accepted asking rates; the typical rate is the median. No arbitrary padding is added. The supporting-sources view exposes only publishable source facts.
7. Admin records an independent **Broker Market Opinion**, then approves, rejects, requests correction or marks insufficient evidence. Approved matching broker opinion takes priority and is labelled **Broker-Reviewed Market Opinion**. Private contact details and internal evidence notes remain in admin.

Original research/review results are immutable. Registering replacement evidence after analysis creates a linked revision. Refresh creates a linked exercise, with duplicate-start protection. Broker observations preserve their original range; approval does not rewrite AI history. Relative difference is ABS(AI typical − broker typical) / broker typical × 100, not an accuracy score. Document fields are existing document references, not a newly implemented upload service.

## Matching, expiry and limits

Location coverage, land category and road access must match. AI research additionally matches the selected normalized land area. Three current completed transactions take precedence over mobile AI generation. Legacy unvalidated model-only suggestions are excluded from the new publication path.

Defaults: 14-day research cache, source observations at most 90 days old, 3 mobile starts per verified account and 30 globally per UTC day. Expiry uses the earlier of cache expiry and evidence expiry. Public source details are also hidden after expiry; admin history remains. A failed exercise has a one-hour cooldown. Registering new evidence permits a new exercise. Zero configured quota disables new mobile starts.

Each research run makes at most two Gemini calls, with 35-second individual and 100-second overall budgets, no automatic retries or provider fallbacks. Insufficient authorized/retrievable sources make zero model calls. Mobile timeout is 130 seconds; a started operation attempts to save its outcome after client disconnection. Admin actions have their existing access controls and concurrency version checks. Administrator runs are explicit and separate from mobile daily quotas.

## Configuration

Use the ignored server .env or deployment secret store, never EXPO_PUBLIC_ or VITE_ credentials:

```dotenv
PRICE_RESEARCH_ENABLED=false
GEMINI_API_KEY=
PRICE_RESEARCH_GEMINI_MODEL=
PRICE_RESEARCH_GEMINI_REVIEW_MODEL=
MARKET_RESEARCH_SOURCE_MODE=AuthorizedEvidence
MARKET_RESEARCH_MIN_SOURCES=3
MARKET_RESEARCH_SOURCE_MAX_AGE_DAYS=90
MARKET_RESEARCH_CACHE_DAYS=14
PRICE_RESEARCH_DAILY_USER_LIMIT=3
PRICE_RESEARCH_DAILY_GLOBAL_LIMIT=30
GEMINI_GROUNDING_ENABLED=false
MARKET_RESEARCH_GOOGLE_STORAGE_AUTHORIZED=false
```

Use model IDs available to the configured Google account. Configured status checks settings only; it does not verify credential validity or billing. Existing other-provider keys can remain, but this research path does not use OpenAI or Claude. No live provider calls were made during this implementation.

Source retrieval uses bounded HTTPS requests, validates public DNS/IP targets before connecting and on redirects, rejects credential-bearing URLs and private network destinations, and limits body size/content types. Source text is treated as untrusted evidence. Unsupported or inaccessible pages can legitimately produce no price.

## Additive database update

Migration `20261117180301_AddGroundedMarketResearch` extends price_research and adds market_research_evidence and broker_market_observations with spatial indexes, foreign keys and numeric constraints. Existing rows default to Legacy. Unrelated Greenot migration drift is excluded.

**Not applied during this implementation.** Review [generated SQL](sql/grounded-market-research.sql), select the intended database securely, and apply this migration through the normal deployment process. No data cleanup or backfill was run. Development startup may apply pending migrations under existing startup rules; review before restarting. No backend process was started or replaced.

## Validation and remaining external setup

265 unit tests and 50 isolated integration tests passed using fake providers and in-memory data. Mobile tests, mobile TypeScript and admin production build passed. See the implementation report for final export checks and limitations. No live prices, paid provider calls, real broker observations or production changes were created for testing.

The owner still needs valid Gemini access and real authorized evidence. The previous credential check returned 401; credentials were not rechecked in this change. Native device visual review, end-to-end live provider validation, deployment and any feed-specific connector remain separate from these offline checks.
