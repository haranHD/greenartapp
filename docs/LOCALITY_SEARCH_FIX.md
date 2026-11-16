# Locality search fix

Implemented 16 November 2026. Scope: location search and selection; the existing visual layout is preserved.

## Root cause and failure handling

The backend loaded `.env` values into the process after ASP.NET built its environment configuration providers. Google Places read the earlier configuration snapshot. Existing environment providers are now refreshed after loading `.env`, without adding a new provider or changing configuration precedence.

The root `.env` frontend API URLs used port 5000 while both app-level environment files and the backend default used 5039. The two root URL settings are now aligned to 5039; credentials were not changed.

Both the backend and mobile client previously converted provider/network failures into empty results. Missing credentials, denied access, quota restrictions, timeouts and malformed responses now remain explicit errors. Successful empty searches still show a no-match state. Neither errors nor empty matches manufacture property coordinates.

## Selection correctness

- Autocomplete uses a shared debounced controller for home and map search. Previous requests are aborted, and stale responses cannot replace newer results even when the transport ignores cancellation.
- Errors offer a search retry. Entering fewer than two characters shows a minimum-length hint instead of a misleading no-match message.
- Locality requests stay on the configured backend rather than silently switching to a hosted environment.
- A place's name, district and coordinates are updated only when details resolve successfully. A failed details request preserves the old selected name and point, with an error shown beside the results.
- Selecting a new point clears the previous valuation and invalidates an outstanding calculation. Valuation requests and session history use the selected district instead of hardcoded Coimbatore metadata.
- Typed-address lookup now uses the same backend provider path. It no longer silently falls through to another network provider or hardcoded locality coordinates.
- Missing administrative fields remain unknown; they are not filled with Coimbatore/Tamil Nadu/India assumptions.
- The home search input has a consistent violet focus border instead of an extra browser outline. No broad redesign was made.

## Live Google verification

The user approved one autocomplete call for Bhavani and, if successful, one details request. Exactly those two requests were performed using the configured server key:

- Autocomplete: HTTP 200, five predictions.
- Details: HTTP 200, Bhavani, Tamil Nadu, India; latitude 11.4470564, longitude 77.6839768.

This verifies the key and provider access for those calls. No billing, key restrictions or cloud settings were changed. Requests may be billed under the existing Google plan; no purchase or plan change was made. The local Google key and the official Places v1 endpoint were confirmed present without printing the key.

## Validation

- Backend unit suite: 209 passed.
- Isolated HTTP tests: 22 passed, including configuration refresh/precedence, search errors, details, selected coordinates, and existing API security boundaries. Database startup was disabled, and Google/LandLens transport was mocked.
- Mobile tests: 21 passed, including stale responses, clear/retry behavior, visible API failures and valid selected coordinates. TypeScript and the Expo web export passed.
- Local browser assertions verified visible provider errors, distinct genuine no-match state, preservation of the old point on details failure, successful Bhavani selection, and a valuation request containing Bhavani/Erode and the selected coordinates. No uncaught runtime exceptions or horizontal page overflow were observed. Browser API traffic was mocked; this was separate from the two live Google checks.

## Applying the update

Restart the running backend and reload/rebuild the customer app to use the changed configuration and search flow. No deployment or database migration was performed. Native Android/iOS device testing and live end-to-end testing through the restarted backend remain separate release checks.

## References

- [Google Places Autocomplete](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/autocomplete)
- [Google Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details)
