# Morrow Mercantile Co.

> Show it. Verify it. Get it.

Morrow turns a photo of an object into an evidence-backed product match, a verified merchant offer, and one bounded purchase approved through Prava.

This repository is a Bun workspace with two deployment boundaries:

```text
Vercel                                 Railway
┌──────────────────────────┐           ┌──────────────────────────────────┐
│ TanStack Start web app   │ REST/SSE  │ Fastify API                      │
│ Camera-first PWA surface ├──────────►│ BullMQ recognition worker        │
│ Embedded Prava SDK       │           │ PostgreSQL + pgvector + Redis    │
└──────────────────────────┘           │ R2 + OpenAI + Prava server API   │
                                       └──────────────────────────────────┘
```

## Safety model

Morrow does not let a model buy things. The model observes visible evidence and returns schema-validated claims. Deterministic code then verifies identifiers, contradictions, compatibility, merchant variants, budget, and the final total.

- Exact matches require an exact identifier and no fatal contradiction.
- Similar and ambiguous results cannot silently become exact.
- Merchant listings are checked against the canonical product before purchase.
- Purchase intents freeze product and offer snapshots before approval.
- Prava credentials never reach the normal frontend or logs.
- Unknown checkout outcomes are not retried automatically.
- An order is complete only after merchant confirmation and Prava's final state agree.

## Repository map

```text
backend/
  database/migrations/       PostgreSQL and pgvector schema
  railway/                   API and worker service configurations
  src/apps/                  Fastify API and BullMQ worker entrypoints
  src/integrations/          Prava and external-provider boundaries
  src/modules/               Recognition, matching, offers, checkout, orders
  tests/                     Deterministic policy tests
docs/                        Architecture, deployment, and integration decisions
scripts/
  database/                  Migration runner
  frontend/                  Deterministic Vercel/Nitro build
  quality/                   Repository-wide verification
src/
  features/scan/             Scan domain UI, API client, and state model
  components/morrow/         Morrow-specific reusable presentation
  components/ui/             Shared interface primitives
  theme/                     Tokens, foundation, motion, and brand patterns
  routes/                    Thin TanStack route composition
```

## Local development

Requirements: Bun, PostgreSQL with `pgvector`, Redis, and an R2-compatible bucket.

```sh
bun install
cp .env.example .env
cp backend/.env.example backend/.env
bun run db:migrate
```

Run the three processes in separate terminals:

```sh
bun run dev:web
bun run dev:api
bun run dev:worker
```

The frontend URL is printed by Vite. The API listens on `http://localhost:3001`; its local OpenAPI explorer is at `/docs`.

Only placeholders belong in environment files committed to Git. A Prava secret posted in chat or logs must be rotated in the Prava dashboard before use.

## Configuration

The web app needs:

- `VITE_API_BASE_URL`: Railway API URL (or `http://localhost:3001`).
- `VITE_PRAVA_PUBLISHABLE_KEY`: Prava publishable key; safe for the browser.
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key; safe for the browser.
- `CLERK_SECRET_KEY`: Clerk server secret used by TanStack Start; never expose it
  through a `VITE_` variable.

The API and worker variables are documented in [backend/README.md](backend/README.md). The Prava secret key is server-only. OpenAI, R2, Redis, database, authentication, and checkout-executor credentials are also server-only.

## Verification

```sh
bun run check
```

That command builds the frontend, type-checks the backend, lints the workspace, runs policy tests, and checks patch whitespace.

## Deployment

- Import the repository into Vercel for the frontend; `vercel.json` uses the Nitro Vercel preset.
- Create API and worker services from the same repository in Railway and point each service at its matching config under `backend/railway/`.
- Attach Railway PostgreSQL and Redis, set the service variables, and run the migration pre-deploy step on the API service.

See [docs/deployment.md](docs/deployment.md) for the exact sequence and [docs/prava-integration.md](docs/prava-integration.md) for the payment lifecycle.

## Current integration scope

The Prava SDK/API path is implemented. MCP and CLI are intentionally not used. Prava UCP and Browser Harness are represented behind internal provider boundaries; current public Prava documentation does not publish a callable Browser Harness API, so production checkout requires the restricted executor adapter supplied or approved by Prava. Morrow does not invent that contract or present a mock charge as real.

For project rules and product language, read [AGENTS.md](AGENTS.md).
