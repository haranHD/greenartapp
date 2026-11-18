# AI-assisted land price research — implementation report

Date: 18 November 2026

## Delivered behavior

Implemented the user-approved authorized-evidence architecture. Administrators register 3–8 authorized public HTTPS source references and document permission to retrieve, retain and display their evidence. Gemini extracts observations from supplied excerpts, then a separate Gemini task reviews the evidence and backend calculations. No Google Search tool is invoked. Private contract references and broker contacts are not included in model prompts or public responses.

The backend validates source quotations, INR asking amounts, original area units, listing dates, quoted coordinates, category, radius and duplicates. It computes rates and minimum/median/maximum deterministically. Fewer than three eligible observations, changed sources or inconsistent review produces no published AI range. Source retrieval is bounded and protects private network destinations and credential-bearing URLs.

Existing registered-sale valuation remains first and unchanged. Research does not create transaction records. AI results are labelled AI-Assisted Asking-Price Research; approved human opinions are Broker-Reviewed Market Opinion. Government guideline values remain separate.

Admin has filtered research requests, source registration, evidence and consistency review, private broker observation history, discrepancy comparison, audit decisions and immutable linked revisions. Mobile has area input, explicit generation with credit notice, saved-range matching and a supporting-sources modal. No search-triggered model calls, automatic provider retries or fabricated demonstration prices were introduced. Fonts, branding, APIs unrelated to pricing, and navigation behavior were preserved.

## Database and activation

The additive migration extends price_research and creates market_research_evidence and broker_market_observations. It includes foreign keys, geography indexes, numeric constraints and unique revision-parent protection. Defaults preserve existing records as Legacy. Unrelated Greenot model drift was excluded. Generated SQL touches only these research tables, their indexes/constraints and normal EF migration history; it does not delete existing data.

**Migration not applied. No backend restart, deployment, real research inserts or live provider calls were performed.** Review docs/sql/grounded-market-research.sql before applying through the normal deployment process. Existing development startup can apply pending migrations, so review before restarting.

The ignored server .env keeps the owner's credentials. Source mode is AuthorizedEvidence; Google collection flags remain false. .env.example includes the new non-secret options. Model IDs remain configurable. A previous credential check returned 401; provider access has not been revalidated here.

## Verification

- Backend unit suite: 265 passed, covering source extraction/review, quote validation, currency/area normalization, missing authorized evidence with zero model calls, source changes, duplicate evidence, permissions, prompt privacy and broker comparison.
- Isolated integration group: 50 passed across pricing, locality reliability, LandLens failures, security boundaries, email delivery and EF model tests. These use controlled test dependencies; database-startup migration is disabled.
- Final pricing HTTP rerun: 26 passed, including both expired research and expired source-evidence cases. Combined with the other 26 isolated integration tests, 52 isolated cases passed across the final checkpoints.
- Mobile tests: 34 passed across five suites; mobile TypeScript check passed.
- Admin TypeScript and Vite production build passed.
- Mobile Expo web production export passed, including bundled font assets. Android production bundle export also passed (`npx expo export --platform android --output-dir /tmp/authorized-research-android` from apps/mobile). This is a bundle export, not a signed APK.
- Migration SQL generation passed; inspected AuthorizedSourcesJson, all three geography columns and the limited table scope. No database was contacted to apply it. EF emitted its existing tool/runtime minor-version warning.
- git diff --check passed.

Commands used from the repository root:

```sh
dotnet test tests/backend/Greenart.Tests.Unit/Greenart.Tests.Unit.csproj --no-restore -p:UseSharedCompilation=false
dotnet test tests/backend/Greenart.Tests.Integration/Greenart.Tests.Integration.csproj --no-restore --filter FullyQualifiedName~PriceResearchHttpTests -p:UseSharedCompilation=false
npm test --workspace @greenart/mobile
npx tsc --noEmit -p apps/mobile/tsconfig.json
npm run build --workspace @greenart/admin-web
npm run build --workspace @greenart/mobile
dotnet ef migrations script 20261116163122_AddBrokerReviewedPriceResearch 20261117180301_AddGroundedMarketResearch --idempotent --project backend/Greenart.Infrastructure --startup-project backend/Greenart.Api --output docs/sql/grounded-market-research.sql
```

The broader integration command selected PriceResearchHttpTests, LocalityReliabilityHttpTests, LandLensFailureHttpTests, SecurityBoundaryHttpTests, EmailDeliveryHttpTests and DbContextModelTests only. Unisolated integration classes that may touch configured databases were not run.

## External setup and limits

- Supply valid Gemini account access and authorized evidence before expecting real prices. No price is returned solely because API keys are present.
- A feed-specific connector needs the actual provider specification and access agreement. The implemented entry path is manually registered authorized public source URLs; it does not pretend to integrate an unspecified feed or privately authenticated API.
- Source pages must supply usable current date, price, area, category and coordinate facts. Blocked pages or missing metadata can legitimately return Insufficient Evidence. Permission declarations are administrator assertions, not independent license verification.
- Two Gemini calls are evidence/consistency review, not independent confirmation of market value. Broker opinion and asking-price evidence are not completed sale values.
- Document reference fields reuse existing conventions; this change does not implement a real document upload service, broker identity verification, broker self-service or an ML model.
- Fresh browser visual checks, Android device/Expo Go review and real-provider end-to-end tests have not been completed. Production builds and transport tests do not establish native pixel fit. No APK signing, store submission or production deployment was performed.

## Files changed

- `GREENART_AI_RESEARCH_IMPLEMENTATION_REPORT.md`
- `.env.example`
- `apps/admin-web/src/components/PriceResearchView.tsx`
- `apps/admin-web/src/components/priceResearch.css`
- `apps/admin-web/src/services/api.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/env.d.ts`
- `apps/mobile/src/__tests__/marketPriceRange.test.ts`
- `apps/mobile/src/components/BrokerPriceRangeCard.tsx`
- `apps/mobile/src/screens/ValuationScreen.tsx`
- `apps/mobile/src/services/api.ts`
- `backend/Greenart.Api/Pricing/MobilePriceResearchEndpoints.cs`
- `backend/Greenart.Api/Pricing/PriceResearchEndpoints.cs`
- `backend/Greenart.Api/Program.cs`
- `backend/Greenart.Application/DTOs/PriceResearchDtos.cs`
- `backend/Greenart.Domain/Entities/PriceResearch.cs`
- `backend/Greenart.Infrastructure/Migrations/LandPriceDbContextModelSnapshot.cs`
- `backend/Greenart.Infrastructure/Persistence/Configurations/PriceResearchConfiguration.cs`
- `backend/Greenart.Infrastructure/Persistence/LandPriceDbContext.cs`
- `docs/BROKER_REVIEWED_PRICING.md`
- `tests/backend/Greenart.Tests.Integration/PriceResearchHttpTests.cs`
- `GREENART_AI_RESEARCH_IMPLEMENTATION_PLAN.md`
- `apps/admin-web/src/components/MarketResearchEvidenceView.tsx`
- `apps/mobile/src/components/ResearchAreaFields.tsx`
- `apps/mobile/src/components/ResearchEvidenceModal.tsx`
- `backend/Greenart.Api/Pricing/GroundedResearchEndpoints.cs`
- `backend/Greenart.Application/Common/Interfaces/ILandMarketResearchService.cs`
- `backend/Greenart.Application/DTOs/GroundedMarketResearchDtos.cs`
- `backend/Greenart.Application/MarketResearch/MarketEvidenceValidator.cs`
- `backend/Greenart.Domain/Entities/BrokerMarketObservation.cs`
- `backend/Greenart.Domain/Entities/MarketResearchEvidence.cs`
- `backend/Greenart.Infrastructure/Migrations/20261117180301_AddGroundedMarketResearch.Designer.cs`
- `backend/Greenart.Infrastructure/Migrations/20261117180301_AddGroundedMarketResearch.cs`
- `backend/Greenart.Infrastructure/Persistence/Configurations/GroundedResearchConfiguration.cs`
- `backend/Greenart.Infrastructure/Services/LandMarketResearchService.cs`
- `backend/Greenart.Infrastructure/Services/SafeMarketEvidenceRetriever.cs`
- `docs/sql/grounded-market-research.sql`
- `tests/backend/Greenart.Tests.Unit/GroundedMarketResearchTests.cs`

See GREENART_AI_RESEARCH_IMPLEMENTATION_PLAN.md and docs/BROKER_REVIEWED_PRICING.md for the plan and operating workflow.
