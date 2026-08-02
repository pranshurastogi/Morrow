# Architecture and trust boundaries

## Durable scan state

Each scan is a versioned database state machine. HTTP only creates work and reads state; AI, OCR, retrieval, and merchant discovery run in BullMQ. The frontend consumes state changes over an authenticated fetch-based SSE stream, which allows bearer headers unlike the browser's native `EventSource` API.

The workflow stops at four deliberate trust gates:

1. **Retrieval gate:** Shopify UCP proposes live catalogue records; it never establishes identity by itself.
2. **Identity gate:** an exact identifier may auto-advance; a visual/label match remains likely or alternative until the user chooses it.
3. **Offer gate:** the sellable merchant source variant independently matches the canonical product.
4. **Authority gate:** the frozen purchase intent is owned, current, explicitly approved, and within the amount cap.

## Data model

Canonical products represent real-world identity. Merchant listings represent offers. Scan evidence stores claim, provenance, confidence, image source, model version, and prompt version. This separation prevents a merchant title or a vision-model guess from becoming product truth.

## Retrieval and verification

Identifier, strict and broad PostgreSQL full-text, pgvector, prior confirmations, and live Shopify Global Catalog retrieval merge into a bounded candidate set. Relevant supplied Indian storefronts are queried as targeted fallbacks. Results are normalized into canonical variants and merchant listings with source provenance.

Image preparation creates bounded full, object-focused, label-focused, OCR, and preview views. The vision observer uses explicit detail by role. At most nine catalogue finalists are compared in parallel batches of three so evidence cannot leak across a crowded candidate set. The comparator returns categorical match, mismatch, or unknown states; deterministic code computes the visual score and applies identifier, size, variant, brand, model, and part-number contradictions. Close plausible finalists receive one bounded escalation-model pass. A visual comparison can support a likely match but can never create exact status by itself.

Model confidence is never used as final confidence. The score is computed by policy code and exact status still requires the categorical identifier rule.

After identity approval, Cart MCP refreshes each eligible source variant and stores its anonymous cart ID, current totals, expiry, and continue URL in the offer snapshot. Shipping and tax remain estimates until a destination-aware checkout or Browser Harness reconciliation.

## Security boundary

The API can create Prava sessions but cannot perform merchant checkout. The checkout worker has no public HTTP listener and calls a private, authenticated executor adapter. Payment material is recursively redacted from logs. An uncertain network or merchant outcome becomes `CHECKOUT_RESULT_UNKNOWN`; the job is retained for reconciliation and is not retried.

## Retention

- Original uploads: 24 hours.
- Processed images and thumbnails: 7 days.
- Confirmed reference images: only after a future explicit-consent flow.
- SDK session token: encrypted temporarily, then removed on terminal state.
- One-time payment credentials: memory only, never cached or stored.
