# Prava SDK/API integration

Morrow uses Prava's application integration: server-side REST API plus the embedded `@prava-sdk/core` iframe. It intentionally does not use Prava MCP or CLI.

## Implemented API calls

- `POST /v1/sessions` with `integration_type: "embedding"`, exactly one destination merchant, a frozen product line, external order reference, and a short-lived amount cap.
- `GET /v1/sessions/{sessionId}/payment-result` from the backend only.
- `POST /v1/sessions/{sessionId}/report-status` after a definitive merchant attempt.

The browser receives `session_token` and `iframe_url` only for mounting Prava's iframe. It never receives the network token, dynamic CVV, or expiry returned in the `awaiting_result` state.

## Wallet authorization

SDK/API mode does not grant this coding agent standing access to a wallet. A Morrow user authorizes each frozen purchase through Prava's card/passkey surface. This is the correct boundary for the product's item-, merchant-, amount-, purpose-, and time-bounded authority.

If Morrow later needs recurring authority, implement Prava mandates as a separate reviewed feature. Do not silently convert one-time checkout approval into a standing mandate.

## Browser Harness

Public Prava documentation describes Browser Harness behavior but does not publish a callable API contract. Morrow therefore exposes a private `MERCHANT_CHECKOUT_EXECUTOR_URL` adapter with strict request/response validation. Connect this only to a Prava-approved Browser Harness wrapper or a reviewed merchant adapter. Until it is configured, Morrow can demonstrate real sandbox card approval but must not claim that a merchant order was placed.

## Secret rotation

The sandbox secret shared in conversation should be considered disclosed. Rotate it before deployment, store the replacement only in Railway, and store the publishable replacement only in Vercel. Never commit either value.
