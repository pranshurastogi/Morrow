# Architecture and trust boundaries

## Durable scan state

Each scan is a versioned database state machine. HTTP only creates work and reads state; AI, OCR, retrieval, and merchant discovery run in BullMQ. The frontend consumes state changes over an authenticated fetch-based SSE stream, which allows bearer headers unlike the browser's native `EventSource` API.

The workflow stops at three deliberate trust gates:

1. **Identity gate:** exact identifier plus zero fatal contradictions.
2. **Offer gate:** the sellable merchant variant independently matches the canonical product.
3. **Authority gate:** the frozen purchase intent is owned, current, explicitly approved, and within the amount cap.

## Data model

Canonical products represent real-world identity. Merchant listings represent offers. Scan evidence stores claim, provenance, confidence, image source, model version, and prompt version. This separation prevents a merchant title or a vision-model guess from becoming product truth.

## Retrieval and verification

Identifier, PostgreSQL full-text, pgvector, and user-confirmation retrieval run independently and merge into a bounded candidate set. Retrieval only proposes candidates. Verification applies normalized field comparisons and fatal contradiction rules for barcode, model, part number, size, brand, voltage, region, connector, and compatibility where available.

Model confidence is never used as final confidence. The score is computed by policy code and exact status still requires the categorical identifier rule.

## Security boundary

The API can create Prava sessions but cannot perform merchant checkout. The checkout worker has no public HTTP listener and calls a private, authenticated executor adapter. Payment material is recursively redacted from logs. An uncertain network or merchant outcome becomes `CHECKOUT_RESULT_UNKNOWN`; the job is retained for reconciliation and is not retried.

## Retention

- Original uploads: 24 hours.
- Processed images and thumbnails: 7 days.
- Confirmed reference images: only after a future explicit-consent flow.
- SDK session token: encrypted temporarily, then removed on terminal state.
- One-time payment credentials: memory only, never cached or stored.
