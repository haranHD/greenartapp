# Broker-reviewed pricing

Implemented workflow: create a locality research exercise → optionally request OpenAI, Claude and Gemini proposals → record a broker cross-check → admin approval → show the approved range on mobile. Broker review can proceed without configured AI keys. No synthetic pricing records are seeded.

## Admin and mobile

Open **Price Research** in the admin console using its existing Administrator session or X-Admin-Key access. Create an exercise with coordinates, locality, district, land type, road access and an explicit 50–1,000 metre coverage area. The latest 200 exercises are listed.

**Run configured AI providers** is an explicit potentially billable action. There are no automatic calls, retries, cross-provider fallbacks, or paid calls on customer searches. Each configured provider is called once in parallel with its own 35-second budget. Missing providers and failures remain visible. Successful proposals and failed outcomes are saved together as one exercise. Saved proposals cannot be overwritten; create a new exercise to run research again. The admin sees each proposal and the combined lowest-to-highest proposal spread, without arbitrary padding.

Model proposals are unvalidated hypotheses. The initial adapters use text generation, not live web search. Model-supplied URLs are labelled unverified. No estimate is accepted when units, currency, range or response shape are invalid. A model may return no estimate. A provider status of Configured means configuration exists, not that a live request has been validated.

The broker cross-check requires a broker name, supporting evidence, independent observation count, an observation date within 90 days, and a positive ordered range. AI answers do not count as broker observations. Admin forms accept **lakh rupees per cent**; API/database rates are **INR per cent**. 1 cent = 435.6 sq ft. The broker's original range is retained even if the admin adjusts the published range.

Only a BrokerReviewed record can be approved. Admin approval requires final rates, notes and an expiry no later than 90 days after the broker observation. Drafts can be rejected. Approved ranges can be withdrawn; published records cannot be silently edited. Create a fresh exercise to revise a range. Optimistic concurrency requires the current version for every transition. Interrupted research can be recovered explicitly after two minutes; provider usage may have occurred, and recovery does not call providers again.

Mobile results show a separate **Broker-reviewed market estimate** card. Matching requires the same land type and road access, and a point within the approved coverage radius. The nearest eligible record wins; newest approval breaks ties. Expired, rejected, withdrawn, draft and out-of-area records are excluded. Public responses contain the range, locality, observation count, dates and coverage; broker identity, evidence notes, approval notes, AI proposals and API credentials remain internal. There is no public cache to delay withdrawal.

The registered-sale estimate and its minimum-three-sale rule remain independent. No research exercise is added to LandPriceRecords or relabelled a registered sale. A lack of broker pricing has an explicit empty state; lookup failures have a retry state. Road access values match the mobile selection options.

Broker cross-checks are currently entered by an administrator after speaking to the broker. This is not a broker self-service account or independent identity verification.

## Server-side configuration (keys to be added later)

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
