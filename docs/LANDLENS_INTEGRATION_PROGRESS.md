# LandLens integration: reliability update

Updated 16 November 2026. These changes improve the existing integration; they do not claim complete live parcel coverage or a finished paid-report workflow.

## Implemented

- Forward parcel revenue district, taluk and village codes, subdivision, rural/urban identity, and urban ward/block fields into guideline requests.
- Preserve parcel identity warnings. Ambiguous identities and village-level boundaries are not used as parcel-specific valuation evidence.
- Select a guideline classification matching the requested land use when unambiguous. Never assume an acre-denominated `val_original` or an unspecified `value_2024` is a square-foot rate.
- Removed the automatic village-median fallback from property valuation: a broad village benchmark must not substitute for a missing property/classification match.
- Parse account and catalog envelopes, current `credits`/`credits_max` fields, snake-case billing metadata, and the current credential-specific daily-spend field. Unknown pricing is not labelled free.
- Account diagnostics expose the credential's named tool scope and daily cap when returned, without returning the key or its prefix.
- Historical `series` entries preserve their original register values and units. Unknown units yield null normalized rates rather than invented INR/sq.ft figures.
- A documented `not_found` remains absence of data. Authentication/permission failures, throttling, invalid responses, outages and timeouts produce distinct sanitized provider failures. Retry-After is preserved for throttling. A provider credential failure does not become a customer-login failure.
- Customer/admin valuation results can explain a guideline-service outage while retaining the independent verified-sale estimate. Caller cancellation is propagated.
- Paid requests are never automatically retried. A failed balance lookup prevents a paid request, and a failed paid request can indicate that the charge outcome is unknown.

## Approved live checks

The user approved free checks only. Exactly two account-backed requests were made: `GET /me` and `GET /tools`.

- Both returned HTTP 200.
- Wallet balance: **0 credits** at the time of the check.
- Catalog: **129 tools**. The catalog listed `resolve_parcel`, `guideline_value`, `guideline_history`, and `pricemap_transactions` at zero credits; `pricemap` at four credits.
- These results verify account/catalog access, not successful execution or coverage of every individual tool.
- No paid request, parcel lookup, transaction retrieval, top-up, or account-setting change was performed. No credentials were included in the report.

## Validation and remaining work

Mock transport covers real documented shapes, unit safety, identity forwarding, provider failures, cancellation, and paid-request retry protection. Isolated HTTP tests disable database startup and use mocked LandLens transport. The current validation results are recorded in SECURITY_HARDENING_PROGRESS.md.

Next work includes approved free parcel/guideline execution checks, checking account-specific tool restrictions, completed job polling and reconciliation for PriceMap, and documented licensing/caching decisions before storing external transaction data. Paid tools and purchases require separate approval. The existing full integration suite still needs service isolation before a safe comprehensive rerun.

## References

- [Official API guide](https://verified.realestate/landlens/docs)
- [Parcel identity fields](https://verified.realestate/landlens/docs/survey-number-from-location-api)
- [Guideline classifications, normalized rates and revenue codes](https://verified.realestate/landlens/docs/guideline-value-api)
- [Historical register values and units](https://verified.realestate/landlens/docs/guideline-value-history-api)
