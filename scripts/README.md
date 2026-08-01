# Repository scripts

Scripts are grouped by the system they operate on:

- `frontend/` contains deterministic web build helpers.
- `database/` contains schema migration helpers.
- `commerce/` contains read-only Shopify UCP catalogue probes.
- `quality/` contains repository-wide verification.

Run scripts through the root `package.json` whenever a matching command exists.

`bun run ucp:probe -- "Minimalist niacinamide serum"` verifies protocol
negotiation and prints a small live result set. It does not create a cart or
start checkout.
