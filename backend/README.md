# Morrow backend

The backend is a modular monolith deployed as two Railway services from one package.

## Processes

- `src/apps/api/main.ts`: authenticated Fastify REST API, SSE progress, upload signing, purchase approval, and Prava session orchestration.
- `src/apps/worker/main.ts`: BullMQ scan, checkout, and retention workers. The checkout queue has concurrency one and no automatic retry.

Both share PostgreSQL, Redis, domain policies, integrations, and audit records. This keeps the hackathon deployment small without blending public HTTP and restricted checkout responsibilities.

## Recognition pipeline

```text
R2 image
  → orientation/resize/metadata removal
  → barcode + optional OCR (cached by image hash)
  → schema-bound multimodal observation
  → identifier/text/vector/history + live Shopify UCP retrieval
  → multimodal image-to-catalogue comparison
  → deterministic contradiction matrix
  → exact, similar, ambiguous, or more evidence
  → explicit user choice for likely/alternative matches
  → merchant source-variant verification + Cart MCP estimate
  → ranked offers
```

The first observation uses the lower-latency vision model. A narrow deterministic policy escalates genuinely borderline evidence to the stronger model. Neither model receives tools or purchase authority. Prompt-injection text found by OCR remains inside explicitly untrusted data delimiters.

## Live offer discovery

Morrow searches Shopify Global Catalog and a bounded set of brand/category storefront catalogues in parallel. The India registry contains every supplied physical-goods UCP endpoint; `bun run ucp:probe --all` checks the complete registry without placing an order. A scan queries only the relevant subset to control latency and upstream load, then retries an evidence-preserving relaxed query only when a source returns no products.

Live search responses are not cached. Each result is normalized into an auditable canonical product and merchant listing, then deterministic policy rechecks identifiers, brand, size, currency, inventory, budget, and official-store provenance. Travel MCPs and platform-specific connectors are intentionally outside this physical-product pipeline. A source failure is isolated, and the UI can refresh live catalogues without repeating recognition.

## Prava lifecycle

1. The user selects a non-illustrative, exact-variant offer.
2. The API freezes the product, offer, amount, currency, merchant, quantity, and expiry in a purchase intent.
3. The user explicitly approves that intent.
4. The API creates one embedded Prava session and returns only its SDK material.
5. Prava collects the card/passkey on its iframe surface.
6. The API polls Prava server-to-server. One-time checkout credentials remain inside the worker.
7. The restricted executor completes the merchant checkout and returns a definitive result or `unknown`.
8. A definitive result is reported to Prava. An approved order is recorded only after Prava reaches `completed` and a merchant order ID exists.

`SESSION_TOKEN_ENCRYPTION_KEY` encrypts the short-lived SDK session token for idempotent recovery and it is removed on completion, failure, or expiry. Network token, CVV, and expiry are never persisted.

`ACCOUNT_DATA_ENCRYPTION_KEY` encrypts delivery-address payloads with AES-256-GCM and an address/user-bound authenticated context. The restricted checkout worker decrypts an approved address only when preparing the merchant checkout. Generate this as a separate 32-byte key and set the same value on the API and worker.

The authenticated account API also proxies Prava's safe card-metadata endpoints. It can list enrolled cards and retire a customer-confirmed card/network token; it never receives or returns a PAN. Cards are enrolled and passkeys are created or verified only inside Prava's embedded surface during an approval.

## Database

Run migrations from the repository root:

```sh
bun run db:migrate
```

The migrations create the evidence ledger, canonical catalogue, product images, merchant listings, candidates, offers, purchase intents, payment sessions, orders, idempotency records, compatibility graph, encrypted delivery records, Cabinet records, and audit events.

## Adding catalogue data

Only source-backed catalogue records should be imported. A merchant listing needs a current `last_seen_at`, real URL and price, and exact identifier or model/size attributes before it can become purchasable. Curated records are acceptable for the demo, but the UI and submission must disclose them.

## Local commands

```sh
bun run --cwd backend dev:api
bun run --cwd backend dev:worker
bun run --cwd backend typecheck
bun run --cwd backend test
```

See `.env.example` for all variables. Never place publishable or secret values directly in source files.
