# Dynamic QR Code Generator — Frontend Brief

## Purpose

Build a small web interface that lets a user create a dynamic QR code for a URL, view and copy its short link, update the destination, optionally set or change an expiry time, review scan analytics, and soft-delete the link.

A generated QR code must encode the short redirect URL (for example, `http://localhost:8000/r/abc123`), never the original destination URL. That lets the backend change the destination while the printed QR image stays the same.

## Suggested implementation

- React + Vite (or another frontend framework you already use).
- Read the backend origin from `VITE_API_BASE_URL`, defaulting to `http://localhost:8000` for local development.
- Keep API calls in one small client/helper module so the base URL and error handling are centralized.
- The backend is the source of truth for URL validation, expiry, deleted state, redirects, and analytics. Frontend validation improves usability but does not replace backend checks.

Example `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Main screen and user flow

### 1. Create a QR code

Show a form with:

- **Destination URL** — required; accept only `http://` or `https://` URLs.
- **Expiration (optional)** — date/time input, with a clear “Never expires” default. Send an ISO 8601 timestamp with timezone when a value is selected.
- **Create QR code** button with loading/disabled state while the request is in progress.

On success, show a details view containing:

- QR image, loaded from the returned `qr_code_url` (or the image endpoint below).
- Short URL, with **Copy link** action.
- Current destination URL.
- Expiration date/time or “Never expires”.
- **Download QR code** action. The image should be downloadable as PNG.
- **Edit destination**, **Analytics**, and **Delete QR code** actions.

The UI should retain the returned token so the user can manage this QR code during the session. The current API list does not include a “list all QR codes” endpoint, so do not promise a saved-links dashboard unless the backend adds one. A page opened with a token in its route can load that token with `GET /api/qr/{token}`.

### 2. Edit a QR code

Let the user edit the destination URL and optionally set, change, or clear its expiry. Clearly state that editing the destination does not change the QR image or short URL.

Use `PATCH /api/qr/{token}`. Send only the fields being changed. Confirm success, then refresh the displayed metadata and QR image URL if needed. If the backend does not yet support clearing an existing expiry, hide or disable the clear action until its API behavior is defined.

### 3. View analytics

Provide a simple analytics panel or section with:

- Total scans.
- Scans by day, using the data returned by the API.
- A useful empty state when there are no scans yet.

Do not invent analytics fields not returned by the backend. If `scans_by_day` has not been finalized, coordinate its exact shape with the backend before building a chart.

### 4. Delete a QR code

Before deletion, show a confirmation dialog that says the QR code will be deactivated and future scans will show an unavailable-link response. On success, show a deleted state and disable edit/analytics actions as appropriate. The backend soft-deletes the record; the frontend should not treat it as permanently erased.

## API integration

All API paths below are relative to `VITE_API_BASE_URL`. Send JSON with `Content-Type: application/json` when a request has a body.

| User action | Request | Expected result |
|---|---|---|
| Create | `POST /api/qr/create` with `{ "url": "https://example.com", "expires_at": "2026-12-31T23:59:00Z" }` (`expires_at` optional) | `200` per the supplied verification example; response includes `token`, `short_url`, `qr_code_url`, and `original_url` |
| Load details | `GET /api/qr/{token}` | `200` with token metadata, including expiry and deletion state if exposed by the backend |
| Update | `PATCH /api/qr/{token}` with changed fields, e.g. `{ "url": "https://new-url.com" }` | `200` with updated metadata |
| Delete | `DELETE /api/qr/{token}` | `200`; record is soft-deleted |
| Get QR image | `GET /api/qr/{token}/image` | `200 image/png` |
| Get analytics | `GET /api/qr/{token}/analytics` | `200`, including `token`, `total_scans`, and `scans_by_day` |
| Scan short URL | Browser navigates to `GET /r/{token}` | `302` to the current destination; this is a navigation, not an API call the UI needs to fetch manually |

**Contract alignment:** the provided verification examples define create/update with `url`, while the written requirements mention optional expiry without specifying the JSON property. This brief uses `expires_at` as a proposed field name; confirm it with the backend and use its exact request/response field names. Likewise, use `qr_code_url` returned by create if it is a complete URL; otherwise construct the image path from the token.

Example create request:

```json
{
  "url": "https://example.com",
  "expires_at": "2026-12-31T23:59:00Z"
}
```

Example successful create response (based on the supplied contract):

```json
{
  "token": "abc123",
  "short_url": "http://localhost:8000/r/abc123",
  "qr_code_url": "http://localhost:8000/api/qr/abc123/image",
  "original_url": "https://example.com"
}
```

## Loading and error states

- **Loading:** disable duplicate submits and show progress for create, update, delete, and analytics requests.
- **Invalid URL:** show a field-level message; explain that only HTTP and HTTPS links are accepted. The backend may reject unsafe or malformed URLs even if the browser accepts them.
- **Expired link:** show that the link has expired; do not present it as active.
- **Soft-deleted link:** a scan should receive `410 Gone`; explain that this QR link has been deactivated.
- **Unknown token:** a scan should receive `404 Not Found`; explain that the link does not exist.
- **Other API failure:** show a short actionable message and allow retry where appropriate. Avoid displaying raw stack traces or server internals.
- **Clipboard failure:** keep the short URL visible and selectable so the user can copy it manually.
- **QR image failure:** show a retry or refresh option while preserving the short URL.

The `404` and `410` scan responses are served by the redirect endpoint. For frontend API screens, display errors based on the status and response body actually returned by the corresponding API endpoint; do not assume every endpoint returns the same error format.

## URL behavior

- Trim whitespace before submission.
- Do not lowercase the full URL. The hostname is case-insensitive, but paths and query values can be case-sensitive.
- Let the backend perform authoritative normalization, remove default ports, and block unsafe URLs.
- Display the normalized `original_url` returned by the backend when available.

## Accessibility and usability

- Give every input a visible label and associate validation text with its field.
- Support keyboard navigation and visible focus states.
- Use buttons with clear names; do not make the QR image the only way to access the short URL.
- Show confirmation and success/error messages in a screen-reader-friendly status region.
- Format expiry in the user's local timezone while preserving the backend timestamp.
- Make the QR image large enough to scan and include a quiet margin around it.

## Out of scope for this prototype

- User accounts, authentication, and cross-device saved-link history (no auth or list endpoint is specified).
- Manual redirect handling in JavaScript; the browser follows the backend's `302` response.
- Frontend-side token generation. Tokens are generated and uniqueness is enforced by the backend.
