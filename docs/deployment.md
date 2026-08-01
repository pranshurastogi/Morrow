# Vercel and Railway deployment

## Frontend on Vercel

1. Import the repository and keep the repository root as the project root.
2. Vercel reads `vercel.json`, installs with Bun, and runs `bun run build:vercel`.
3. Set `VITE_API_BASE_URL` to the Railway API HTTPS origin.
4. Set the rotated `VITE_PRAVA_PUBLISHABLE_KEY`.
5. Add the Vercel production and preview origins to `FRONTEND_ORIGINS` on Railway.

## Backend on Railway

Create PostgreSQL and Redis services, then create two services from this repository:

- API config path: `backend/railway/api.toml`
- Worker config path: `backend/railway/worker.toml`

The API service runs migrations before deployment. Both services build from the root Bun lockfile. Give the worker OpenAI, R2, database, and Redis variables. Give the API R2, database, Redis, Prava, auth, and session-encryption variables. Only the worker should receive the restricted merchant checkout executor secret.

Use a private R2 bucket. Configure lifecycle rules as defense in depth in addition to Morrow's cleanup worker.
Allow `PUT` from the exact Vercel production and preview origins in the bucket CORS policy, with the supported image content types. Do not make the bucket public.

## Release order

1. Rotate the disclosed Prava sandbox keys.
2. Provision data services and R2.
3. Deploy API and run migrations.
4. Deploy worker.
5. Deploy frontend with the API URL and publishable key.
6. Test exact, ambiguous, declined, expired, total-changed, and unknown-outcome paths.
7. Complete a real sandbox checkout and retain its audit/order evidence for the hackathon demo.

Production access requires Prava approval and should remain separate from sandbox configuration.
