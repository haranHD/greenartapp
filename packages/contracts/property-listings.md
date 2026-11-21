# Marketplace property API

The routes below are under `/api/v1`. Legacy `/marketplace` routes retain their response shapes and share the corresponding authorisation, submission, moderation and enquiry logic.

## Seller workflow

1. Use `POST /properties` to save a draft. An empty body object is permitted. A client-generated UUID in `requestId` makes retries return the original listing.
2. Read the current version and editable fields from `GET /sellers/me/properties/{id}`. Send the complete editable snapshot and its `version` to `PATCH /properties/{id}`. Omitted editable values are cleared or reset to their defaults.
3. Send `{ "version": ... }` to `POST /properties/{id}/submit`. A listing needs a title, state, district, locality, real coordinates, category, positive area and positive asking price. Area is sent as `area` and `areaUnit`. Seller approval is checked live, and the owner ID always comes from the session.
4. Use `PATCH /sellers/me/properties/{id}/sale-status` with `version` and `saleStatus`. A published listing can move between `Available` and `UnderNegotiation`. `Sold` and `Withdrawn` are terminal through the seller API and hide the listing. An unpublished listing can be withdrawn.
5. A change to listing content or media on a published listing returns it to `Draft` and removes it from discovery until it is resubmitted and approved. A stale version returns HTTP 409. Legacy intake can queue a submission with the old mobile regional anchor, but an actual parcel location is required before approval.

## Media

- Upload raw file bytes to `POST /properties/{id}/media?version=...&kind=Photo` or `kind=VerificationDocument`. The content type must be `image/jpeg` or `image/png`, with `application/pdf` also accepted for a private document.
- The limit is 5 MiB per upload, with up to 10 photos and 5 documents per listing. Photos are decoded with dimension and pixel limits, rotated to their display orientation and re-encoded without source metadata. PDFs are validated for format markers, stored as opaque attachments, and served as authenticated downloads.
- Order photos with `PATCH /properties/{id}/media` using `version`, `coverId` and the complete ordered `photoIds` array. Delete with `DELETE /properties/{id}/media/{mediaId}?version=...`.
- Files are served through the returned URL. Owner and active administrator sessions can read private files. Only photos belonging to a currently public listing are available anonymously.

## Discovery and enquiries

- `GET /properties` accepts `search`, `district`, `locality`, `landUsage`, `minPrice`, `maxPrice`, `minAreaCent`, `maxAreaCent`, `sort`, `page` and `pageSize`. Sort values are `Newest`, `PriceAscending`, `PriceDescending`, `AreaAscending` and `AreaDescending`. Pages default to 25 and cap at 100.
- `GET /properties/map` applies the same filters and requires `latitude`, `longitude` and `radiusMeters`. It queries the indexed public point, rounded to two decimal places in PostgreSQL. Exact coordinates, address and survey number remain in the owner and admin projections.
- `GET /properties/{id}` returns public detail and its photo gallery. List and map results include the cover photo. Seller approval refers to the reviewed account. Property title, ownership and asking price require independent verification.
- `POST` and `DELETE /properties/{id}/favourite` save and remove a listing. `GET /users/me/favourites` returns the user's favourites that remain publicly visible.
- `POST /properties/{id}/enquiries` accepts `message`, optional `offeredPriceTotal`, and optional `shareContact`. Contact sharing defaults to false. A buyer can send five enquiries per hour, with a five-minute cooldown per listing and a 24-hour duplicate-message check. Sellers can list and update their own enquiries under `/sellers/me/enquiries`.
- `POST /properties/{id}/reports` accepts `reason`. A buyer can report a property once, up to five reports per hour.

## Moderation and valuation boundary

- Administrators use `GET /admin/properties`, `GET /admin/properties/pending` and `GET /admin/properties/{id}`. Detail includes access-controlled media, price and moderation history, and possible parcel duplicates. Reports and enquiries have queues under `/admin/properties`.
- Send `version`, `action`, optional `notes`, and a `reason` for actions other than approval to `PATCH /admin/properties/{id}/moderation`. Supported actions are `Approve`, `Reject`, `RequestChanges`, `Suspend` and `Archive`. Admin changes and the actor's ID are audited. The legacy review endpoint accepts a missing version only for early, unrevised listings.
- Marketplace asking prices and price history use the marketplace tables. The original asking price is retained. No marketplace status change inserts verified valuation evidence. Duplicate parcel detection blocks repeated submissions by the same seller and flags cross-seller matches for review.
