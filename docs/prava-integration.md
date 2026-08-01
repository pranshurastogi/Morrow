# Prava SDK/API integration

Morrow uses Prava's application integration: server-side REST API plus the embedded `@prava-sdk/core` iframe. It intentionally does not use Prava MCP or CLI.

## Implemented API calls

- `POST /v1/sessions` with `integration_type: "embedding"`, exactly one destination merchant, a frozen product line, external order reference, and a short-lived amount cap.
- `GET /v1/sessions/{sessionId}/payment-result` from the backend only.
- `POST /v1/sessions/{sessionId}/report-status` after a definitive merchant attempt.
- `GET /v1/listCards` for safe enrolled-card metadata on the authenticated account page.
- `POST /v1/deleteCard` after an explicit customer confirmation to retire the card's network token.

The browser receives `session_token` and `iframe_url` only for mounting Prava's iframe. It never receives the network token, dynamic CVV, or expiry returned in the `awaiting_result` state.

## Sandbox approval exercise

When the Browser Harness executor is unavailable, Morrow exposes a clearly labelled sandbox-only approval check. It creates an embedded session with the verified offer's real product, merchant, currency, and estimated total. After the card/passkey step, the backend confirms that Prava issued the scoped credential, keeps that credential in memory only, and reports `DECLINED` because no merchant checkout was attempted. The UI records the Prava reference and says **no merchant order was placed**. This prevents a pending session or successful card enrollment from being presented as a purchase.

Prava sandbox still performs a real browser WebAuthn/passkey ceremony. Morrow checks for HTTPS and WebAuthn support before the ceremony, but these capability checks cannot guarantee that a user will finish the operating-system prompt. A cancelled, timed-out, or failed ceremony keeps the verified product and offer on screen and requires a newly created 15-minute Prava session; Morrow never tries to resume or repurpose the failed session.

The recovery view records only a bounded error code and message, timestamp, timezone, frontend origin, browser capability booleans, Morrow sandbox-check ID, and provider order reference. SDK error details are not persisted. Keys, JWTs, and card-like numbers are redacted in both browser and server code. If Prava includes an `X-Response-ID` in the SDK error payload, Morrow includes it in the copyable support bundle. The host page cannot read a response header that remains inside Prava's cross-origin iframe, so it directs the tester to the failed Prava request in browser developer tools when that ID is not propagated.

Delivery addresses are not part of Prava's public application card APIs. Morrow stores them as encrypted, owner-scoped records and releases one only to the restricted checkout worker after purchase approval. Passkeys remain entirely on Prava's secure WebAuthn surface; Morrow does not provide a fake passkey-management API.

## Wallet authorization

SDK/API mode does not grant this coding agent standing access to a wallet. A Morrow user authorizes each frozen purchase through Prava's card/passkey surface. This is the correct boundary for the product's item-, merchant-, amount-, purpose-, and time-bounded authority.

If Morrow later needs recurring authority, implement Prava mandates as a separate reviewed feature. Do not silently convert one-time checkout approval into a standing mandate.

## Browser Harness

Public Prava documentation describes Browser Harness behavior but does not publish a callable API contract. Morrow therefore exposes a private `MERCHANT_CHECKOUT_EXECUTOR_URL` adapter with strict request/response validation. Connect this only to a Prava-approved Browser Harness wrapper or a reviewed merchant adapter. Until it is configured, Morrow can demonstrate real sandbox card approval but must not claim that a merchant order was placed.

The executor receives the frozen UCP cart ID and continue URL inside the offer snapshot. It is the only process that receives Prava's one-time network credential. It must return a definitive merchant order ID and final total before Morrow reports `APPROVED` to Prava.

## UCP is not wallet access

Morrow calls Shopify UCP catalogue and cart tools directly over their documented JSON-RPC transport. This does not use Prava Pay MCP, does not link this coding agent to a wallet, and does not bypass the embedded Prava approval surface.

## Secret rotation

The sandbox secret shared in conversation should be considered disclosed. Rotate it before deployment, store the replacement only in Railway, and store the publishable replacement only in Vercel. Never commit either value.
