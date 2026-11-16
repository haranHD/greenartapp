# Security and data integrity: first implementation batch

Implemented on 16 November 2026. This records the current changes; it is not a claim that the entire application is production-ready.

## Behavior changes

- Registration codes are never returned in `DevOtpHint` or written by the authentication service to logs. Failed email delivery invalidates the pending code and reports a delivery error, including in development.
- Mobile OTP failures keep the registration flow on its current step. Password login and registration failures never manufacture users or session tokens. Restoring a session validates it with the server rather than trusting a saved profile.
- Browser access uses `ALLOWED_CORS_ORIGINS`, a comma-separated list of exact HTTP(S) origins, without trailing slashes, paths, or wildcards. For example: `https://admin.example.com,https://app.example.com`. These are examples, not configured client domains.
- Development without that setting allows localhost ports 5173, 8081, and 19006. Set the list explicitly for LAN devices, alternate ports, or hosted previews. Production without the setting grants no cross-origin browser access. Native HTTP clients are not governed by browser CORS.
- Login, OTP, registration, Google authentication, refresh, revocation, and password changes share a limit of 10 requests per minute per observed client IP. The limiter is per API process, not distributed. Trusted reverse-proxy configuration still needs deployment review.
- Unhandled API errors and CSV import failures do not send internal exception messages to clients. Server logs retain diagnostic exceptions.
- The EF repository propagates database failures. It no longer substitutes pilot records or reports successful writes to temporary memory. The standalone pilot repository remains available for explicit tests.
- Empty locality queries return an empty list instead of hardcoded benchmark prices.
- Automatic insertion of pilot land records is opt-in through `Database:SeedPilotData` (environment variable `Database__SeedPilotData=true`). The default is false. Existing database records are not changed or removed.
- `Database:InitializeOnStartup=false` disables startup database diagnostics, migrations, schema synchronization, and user seeding. Isolated HTTP tests set this flag and replace persistence to avoid live database access. Production currently retains the existing startup behavior unless this flag is explicitly disabled.

## Validation

- Backend unit suite: 176 passed, including new OTP delivery/logging and repository failure regressions.
- Five isolated HTTP tests cover allowed/denied CORS origins, missing production origin configuration, generic database-error responses, and shared authentication throttling.
- Mobile tests cover five authentication failure cases, a successful server login, and eight existing valuation/API cases. The test runner discovers all `.test.ts` files in `src/__tests__`.
- Mobile TypeScript check passed.
- The earlier full integration suite had seven failures. This batch does not claim to resolve or revalidate that entire suite; unrestricted startup in older tests can contact configured databases and external providers.

## Work still required

- Confirm deployment origins and trusted reverse proxies before rollout.
- Review existing stored pilot data provenance; no existing client data was modified in this batch.
- Complete native secure token storage. Registration challenge controls are implemented in the second batch below.
- Complete LandLens compatibility/access validation and isolate older integration tests from live services.
- Replace document/report simulations and remaining incorrect benchmark fallbacks. Automatic sample marketplace content was removed in the second batch below.
- Complete database migration/startup cleanup, persistent history, and end-to-end client acceptance testing.


## Second batch: registration and professional UI

Implemented on 16 November 2026.

### Registration

- OTPs expire after five minutes. Three incorrect attempts invalidate the code; the attempt history and 60-second resend cooldown are persisted through existing audit events.
- Email verification issues a cryptographically random setup token, stored only as a SHA-256 hash with a distinct challenge prefix. It expires after ten minutes and is consumed with password/session creation.
- Existing password accounts cannot be reset through registration. Expired, malformed, reused, or unverified setup challenges are rejected.
- EF marks the challenge hash as a concurrency token to reject stale simultaneous challenge updates. The EF model snapshot matches this metadata change; it requires no new database columns. No database migrations or external-data changes were executed.
- Existing in-progress setup tokens from the earlier implementation must be replaced by requesting and verifying a fresh code after rollout.

### UI

- Customer sign-in and registration now use the existing brand logo, restrained violet/neutral surfaces, clearer headings and steps, focus states, autofill labels, accessible feedback, and larger form controls. Demo credential autofill was removed. Connection configuration is available from development error feedback only.
- Registration offers a resend countdown and explains code expiry. The step indicator displays progress without allowing users to jump ahead of server verification.
- The customer home screen has a centered responsive layout, consistent line icons, clearer property-location actions, and a concise evidence explanation. It no longer labels every selected location as Coimbatore.
- The header distinguishes service connectivity from data freshness. Navigation actions expose labels and selected states to assistive technology.
- Admin navigation and typography align with the violet brand. Added a keyboard skip link, visible focus states, reduced-motion support, responsive navigation, and narrower-screen form layouts. Header search opens the records view when submitted with Enter.
- Removed automatic sample marketplace listings and admin document/listing examples. Listing moderation fetches the actual pending queue with loading, error and retry states, and uses server-returned moderation results.
- Dashboard district counts come from data. Empty reference-locality views explain how to populate them.

### Validation

- Backend unit tests: **185 passed**, including nine new registration challenge cases.
- Isolated HTTP security tests: **5 passed**; database startup disabled.
- Mobile tests: **14 passed**. Mobile TypeScript check passed.
- Admin production build and Expo web export passed.
- Local Chrome review used mocked API responses only. Checked sign-in, registration, customer home, and the admin dashboard at phone and desktop widths. The inspected pages had no uncaught runtime exceptions or horizontal page overflow.
- Native Android/iOS rendering and live email/LandLens integration were not exercised. Full integration-suite failures from the earlier audit remain outside this isolated validation.


## Third batch: LandLens reliability

Implemented on 16 November 2026. See [LandLens integration progress](LANDLENS_INTEGRATION_PROGRESS.md) for implementation details and official API references.

- Corrected parcel identity forwarding, classification selection, credit/account parsing, and guideline-history units.
- Removed the automatic village-wide median substitution for a missing parcel guideline benchmark.
- Provider failures remain distinguishable from missing data. Customer and admin valuation views can explain guideline unavailability without inventing a market price.
- Preserved caller cancellation and the no-retry rule for paid operations; a failed balance lookup does not start a paid report.
- With explicit user approval, made exactly two free live requests: account and tool catalog. Both succeeded; the wallet reported zero credits and the catalog contained 129 tools. No paid tools, purchases, parcel lookups, or data writes were performed.
- Current validation: **201 backend unit tests passed**, **11 isolated HTTP tests passed**, admin production build passed, and mobile TypeScript/web export passed. These checks do not replace full native-device testing or a live parcel/guideline execution check.


## Fourth batch: locality search

See [Locality search fix](LOCALITY_SEARCH_FIX.md) for the root cause, bounded live verification, and application instructions.

- Refreshed existing environment configuration providers after `.env` loading.
- Replaced hidden failures with explicit search/detail errors, cancellation and stale-response protection.
- Kept place identity and coordinates consistent on failed/successful selection and retained the selected district for valuation.
- Preserved the layout; adjusted only search focus and feedback.
- Current checks: **209 unit tests**, **22 isolated HTTP tests**, **21 mobile tests**, mobile TypeScript/web export, and browser flow assertions passed.
- With user approval, two Google Places calls succeeded for Bhavani. No cloud settings, database data or deployments were changed. The running backend/app must be restarted or reloaded to apply the local changes.
