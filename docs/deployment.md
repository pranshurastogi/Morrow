# Vercel and Railway deployment

## Frontend on Vercel

1. Import the repository and keep the repository root as the project root.
2. Vercel reads `vercel.json`, installs with Bun, and runs `bun run build:vercel`.
3. Set `VITE_API_BASE_URL` to the Railway API HTTPS origin.
4. Set the rotated `VITE_PRAVA_PUBLISHABLE_KEY`.
5. Set `VITE_CLERK_PUBLISHABLE_KEY` and the server-only `CLERK_SECRET_KEY`.
6. Add the Vercel production and preview origins to `FRONTEND_ORIGINS` on Railway.

In Clerk, open **Sessions → Customize session token** and add the user's
primary email for the Prava purchase-session boundary:

```json
{
  "email": "{{user.primary_email_address}}"
}
```

On Railway, set Clerk's Frontend API origin as `AUTH_ISSUER` and its
`/.well-known/jwks.json` URL as `AUTH_JWKS_URL`. Leave `AUTH_AUDIENCE` unset
unless a custom Clerk token template intentionally adds an audience claim.

## Backend on Railway

Create PostgreSQL and Redis services, then create two services from this repository:

- API config path: `backend/railway/api.toml`
- Worker config path: `backend/railway/worker.toml`

The API service runs migrations before deployment. Both services build from the root Bun lockfile. Give the worker OpenAI, R2, database, Redis, Prava, and account-data-encryption variables. Give the API R2, database, Redis, Prava, auth, session-encryption, and account-data-encryption variables. `ACCOUNT_DATA_ENCRYPTION_KEY` must be the same base64-encoded 32-byte value on both services and must differ from `SESSION_TOKEN_ENCRYPTION_KEY`. Only the worker should receive the restricted merchant checkout executor secret.

Set these on the worker for live catalogue discovery:

```text
UCP_ENABLED=true
UCP_GLOBAL_CATALOG_URL=https://catalog.shopify.com/api/ucp/mcp
UCP_AGENT_PROFILE_URL=https://<api-domain>/.well-known/ucp
UCP_REQUEST_TIMEOUT_MS=12000
UCP_MAX_PRODUCTS=8
UCP_MAX_MERCHANTS_PER_SCAN=6
```

The API profile URL must be publicly reachable over HTTPS before replacing Shopify's development fixture. No Shopify secret is required for public catalogue search or anonymous Cart MCP estimates. Authenticated checkout completion is a separate credentialed integration.

The worker publishes a short-lived checkout-capability heartbeat in Redis. Until
both `MERCHANT_CHECKOUT_EXECUTOR_URL` and `MERCHANT_CHECKOUT_EXECUTOR_SECRET`
are configured on the worker, the frontend keeps **Get this** disabled and the
API refuses Prava approval. This prevents issuing a payment credential when no
restricted process can turn it into a verified merchant order.

The repository-root `railway.toml` is the API default for an existing Railway
service connected at the repository root. A separately created worker must use
`backend/railway/worker.toml` as its Railway config path.

Use a private R2 bucket. Configure lifecycle rules as defense in depth in addition to Morrow's cleanup worker.
Allow `PUT` from the exact Vercel production and preview origins in the bucket CORS policy, with the supported image content types. Do not make the bucket public.

### R2 browser-upload CORS

The API issues a presigned object URL, then the browser uploads directly to R2.
That second request needs a bucket CORS policy in addition to API CORS.

1. Open Cloudflare → **R2 object storage** → the Morrow bucket.
2. Open **Settings** → **CORS Policy** → **Add CORS policy**.
3. Paste the contents of `scripts/cloudflare/r2-cors.production.json`.
4. Save, then retry from `https://morrow-red.vercel.app`.

For an authenticated Wrangler session, the equivalent checked-in command is:

```sh
bun run r2:cors:apply
bun run r2:cors:check
```

Origins must match exactly and must not end in `/`. Add preview origins only
when they are intentionally allowed; do not use `*` for authenticated uploads.
The R2 access key used by the API needs object read/write access, but it does
not need bucket-administration access.

## Release order

1. Rotate the disclosed Prava sandbox keys.
2. Provision data services and R2.
3. Deploy API and run migrations.
4. Deploy worker.
5. Deploy frontend with the API URL and publishable key.
6. Test exact, ambiguous, declined, expired, total-changed, and unknown-outcome paths.
7. Complete the embedded sandbox approval exercise and retain its Prava reference. Then test a full sandbox checkout after the restricted merchant executor is connected; only that path may produce an order record.

Production access requires Prava approval and should remain separate from sandbox configuration.
