# Broker-reviewed pricing

Implemented workflow: create a locality research exercise → optionally request OpenAI, Claude and Gemini proposals → record a broker cross-check → admin approval. Mobile can show a saved AI suggestion before approval, explicitly labelled unverified; a matching approved broker range takes priority. Broker review can proceed without configured AI keys. No synthetic pricing records are seeded.

## Admin and mobile

Open **Price Research** in the admin console using its existing Administrator session or X-Admin-Key access. Create an exercise with coordinates, locality, district, land type, road access and an explicit 50–1,000 metre coverage area. The latest 200 exercises are listed.

**Run configured AI providers** is an explicit potentially billable action. There are no automatic calls, retries, cross-provider fallbacks, or paid calls on customer searches. Customers can explicitly press **Generate AI suggestion** as described below. Each configured provider is called once in parallel with its own 35-second budget. Missing providers and failures remain visible. Successful proposals and failed outcomes are saved together as one exercise. Saved proposals cannot be overwritten; create a new exercise to run research again. The admin sees each proposal and the combined lowest-to-highest proposal spread, without arbitrary padding.

Model proposals are unvalidated hypotheses. The initial adapters use text generation, not live web search. Model-supplied URLs are labelled unverified. No estimate is accepted when units, currency, range or response shape are invalid. A model may return no estimate. A provider status of Configured means configuration exists, not that a live request has been validated.

The broker cross-check requires a broker name, supporting evidence, independent observation count, an observation date within 90 days, and a positive ordered range. AI answers do not count as broker observations. Admin forms accept **lakh rupees per cent**; API/database rates are **INR per cent**. 1 cent = 435.6 sq ft. The broker's original range is retained even if the admin adjusts the published range.

Only a BrokerReviewed record can be approved. Admin approval requires final rates, notes and an expiry no later than 90 days after the broker observation. Drafts can be rejected. Approved ranges can be withdrawn; published records cannot be silently edited. Create a fresh exercise to revise a range. Optimistic concurrency requires the current version for every transition. Interrupted research can be recovered explicitly after two minutes; provider usage may have occurred, and recovery does not call providers again.

Mobile uses `GET /api/v1/pricing/market-range` to show a separate price card. A current matching broker-approved range takes priority. Otherwise the nearest location’s newest exercise can expose its saved successful AI proposals as an **AI suggested range · Not yet verified**. The spread is the minimum low to maximum high from valid proposals, with no arbitrary padding. AI suggestions are valid for 14 days from their oldest included generation date. Rejected, withdrawn, researching, malformed, failed, future-dated and stale suggestions are excluded. A newer rejected/withdrawn exercise at the same location supersedes older suggestions.

Matching requires the same land type and road access and a point within the exercise’s coverage radius. AI responses include only the range, provider names, locality, generation/expiry dates and coverage. They report zero independent observations and are never labelled broker reviewed. Broker identity, evidence notes, approval notes, raw model proposals/reasoning and API credentials remain internal. The existing `/api/v1/pricing/broker-range` endpoint retains its approval-only contract. Both endpoints only read saved data and never start a model request. The card’s **Refresh price** action rechecks saved data without provider charges.

The registered-sale estimate and its minimum-three-sale rule remain independent. No research exercise is added to LandPriceRecords or relabelled a registered sale. A lack of saved matching pricing has an explicit empty state; lookup failures have a retry state. Road access values match the mobile selection options.

Broker cross-checks are currently entered by an administrator after speaking to the broker. This is not a broker self-service account or independent identity verification.

## Server-side configuration

In the ignored root .env or the deployment secret store:

```
PRICE_RESEARCH_ENABLED=false
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
PRICE_RESEARCH_OPENAI_MODEL=
PRICE_RESEARCH_CLAUDE_MODEL=
PRICE_RESEARCH_GEMINI_MODEL=
```

Choose model IDs supported by the corresponding accounts. Alternatively use PriceResearch:{OpenAI|Claude|Gemini}:{ApiKey|Model} configuration. Set PRICE_RESEARCH_ENABLED=true only when ready to allow admin-triggered usage. Restart the backend after configuration changes. Keys belong on the server, never EXPO_PUBLIC_ or VITE_ variables. Adding keys does not itself generate or publish a range. No live AI provider calls were made during implementation.

Adapter references: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat), [Claude Messages](https://platform.claude.com/docs/en/api/messages), [Gemini GenerateContent](https://ai.google.dev/api/generate-content).

## Database

Migration: `20261116163122_AddBrokerReviewedPriceResearch`. Applied to the configured local development database using the backend’s user-secrets connection; no research or test pricing records were inserted. It creates only `price_research` and its publication lookup index. The EF migration-history entry is added normally. No existing property or user records are updated. Generated SQL was inspected separately. Existing unrelated Greenot model/migration drift is outside this change and deliberately excluded from this migration and its snapshot additions.

From the repository root, apply to the intended development database:

```
dotnet ef database update --project backend/Greenart.Infrastructure --startup-project backend/Greenart.Api
```

Restart the currently running backend to load the new endpoints, then reload the admin/mobile apps. The existing backend process was not stopped or replaced.

The design-time context uses DB_CONNECTION_STRING or ConnectionStrings__DefaultConnection, plus DB_PASSWORD if necessary; it does not load root .env or appsettings.Development.json itself. Supply the intended connection securely. Do not paste a connection string into a shell command or version control. Development startup can also apply pending migrations under the existing startup rules; production automatic migrations remain disabled by default.

## Verification

- 232 backend unit tests passed, including range validation, broker-before-approval gating, original broker range retention, stale observations, provider response validation, disabled providers making zero calls and independent provider failure handling.
- 4 isolated HTTP tests passed against an in-memory database: admin access, persisted research/review/approval/withdrawal and audit, no contamination of registered-sale evidence, private-data filtering, road/type/radius matching, expired records, stale versions and duplicate research rejection.
- Admin production build and mobile web export passed; mobile TypeScript passed.
- Mocked Chrome workflow exercised draft creation, disabled AI without keys, broker entry (₹4–5 lakh → INR 400000–500000), approval and mobile publication. Desktop and mobile layouts had no horizontal overflow or runtime exceptions.
- Live provider responses, billing and model availability still need validation after keys/models are configured. No broker prices were inserted into the real database for testing.

## Pre-approval display validation (17 November 2026)

- 11 isolated pricing HTTP tests pass with an in-memory database and fake providers, including pre-approval display, approved priority, location/land/road matching, rejection, invalid/stale proposals, privacy, unit conversion and no lookup-triggered provider calls.
- 29 mobile tests pass, including saved-range transport and validation; mobile TypeScript, mobile export and admin production build pass.
- Mocked browser checks cover unverified/approved labels, refresh after approval, per-square-foot display, empty/error/retry states and 320–768px widths with no runtime exceptions.
- No real AI requests or pricing data inserts were made for these checks. Restart the backend and reload the app to use the new endpoint. Locations still need successful saved research or an approved range; absent data is never replaced by demonstration prices.

## Mobile generation button

When no matching saved range exists, the app offers **Generate AI suggestion**, with an API-credit notice. It sends one authenticated `POST /api/v1/pricing/research` with the selected coordinates, locality, district, land type, road access and a request ID. Provider keys never enter the mobile bundle. An active verified email or Google identity is required.

The backend checks saved ranges first, then duplicate request IDs and nearby in-progress/recent failed research. It saves a new 500m-coverage research exercise and `MobileResearchStarted` audit event before requesting the configured models. PostgreSQL uses a short transaction/advisory lock around cache/quota/start checks; provider calls run after releasing the lock. An in-process gate also supports isolated tests. Retrying the same request ID cannot start another run. Concurrent requests for the same covered property return the existing status. Saved results remain readable even when generation limits are reached.

Default mobile allowances are **3 research runs per account** and **30 total runs per UTC day**, configured by `PRICE_RESEARCH_DAILY_USER_LIMIT` and `PRICE_RESEARCH_DAILY_GLOBAL_LIMIT`. A run may contact up to three providers, so these are run limits rather than monetary spending caps. Zero disables new mobile starts. Existing administrator-triggered research retains its separate workflow.

All outcomes, including failures/no estimate, are saved in the existing admin Price Research list. Provider calls retain their 35-second budgets and no automatic retries; a started run finishes saving even if the phone disconnects. A failed/no-estimate exercise has a one-hour duplicate cooldown. Interrupted in-progress exercises require the existing admin recovery action. No fallback or demonstration prices are supplied.

Validated with 19 isolated pricing HTTP tests (fake providers/in-memory database), 31 mobile tests, TypeScript, mobile export and mocked browser tests for button press, rapid double tap, saved display, refresh, no-estimate and quota errors. Real provider account access/quotas have not been tested and no live research was generated during implementation. Restart the backend and reload Expo Go before using the new route.
