# AGENTS.md — Morrow Mercantile Co.

These instructions apply to the entire repository. Build Morrow as a polished product, not a generic template.

## Product in one sentence

Morrow lets someone show an object, verify the exact product, compare a trustworthy dispatch, and approve one bounded purchase through Prava.

The canonical product rhythm is:

> Show it. Verify it. Get it.

## Brand language

- Use **Morrow Mercantile Co.** for company-level naming and **Morrow** inside compact UI.
- Use **Open Morrow** for the primary entry action and **Get this** for a specific purchase action.
- Prefer plain, concise language. Most explanatory copy should be one sentence or less.
- Describe concrete actions: inspect, match, verify, compare, approve, dispatch.
- Do not use customer-facing phrases such as “powered by AI,” “AI magic,” “smart shopping,” or “revolutionary commerce.”
- Do not show Lovable, starter-template, ChatGPT, OpenAI, sparkle, or robot branding in the product.
- Never claim perfect recognition, guaranteed stock, guaranteed lowest price, guaranteed delivery, unrestricted purchasing, or independent product verification by Prava.

## Visual system

Morrow is retro-futurist mercantile: Edwardian catalogue, railway parcel office, brass instrument, and modern camera interface.

- Preserve the parchment, ivory, bottle-green, ink, brass, and restrained postal-red palette in `src/styles.css`.
- Use Fraunces for expressive display type, Instrument Sans for interface copy, and IBM Plex Mono for identifiers, archive labels, and status text.
- Reuse the Morrow inspection seal and existing editorial artwork. Do not introduce a competing logo.
- Use Lucide icons. Keep stroke weight, size, labels, and semantics consistent; do not mix unrelated icon libraries.
- Prefer rules, stamps, ledgers, catalogue plates, and engraved motifs over gradients, glassmorphism, neon, or generic SaaS cards.
- Historical cues should feel refined and functional—not distressed, sepia-heavy, steampunk, theatrical, or costume-like.
- Avoid model-authored SVG decoration when typography, CSS, an existing icon, or an existing asset can do the job.

## Motion language

Motion should explain a physical action and then get out of the way.

- Use paper-feed, receipt-draw, shutter, inspection-line, dial, and stamp-press metaphors.
- Keep most interactions between 180–700 ms with tactile easing and a clear resting state.
- Buttons may depress by 1 px; cards and artwork may lift or settle subtly.
- Do not add looping motion unless it communicates active inspection or progress.
- Avoid generic fade-only page transitions, large parallax, elastic overshoot, cursor-following effects, or decorative animation noise.
- Every new animation must remain usable under `prefers-reduced-motion: reduce`.

## Interaction and accessibility

- Design mobile-first and verify that the first viewport communicates the product without long reading.
- Keep touch targets at least 44 × 44 px and do not rely on hover for essential behavior.
- Use semantic headings, buttons, links, lists, labels, and status text.
- Give icon-only controls an accessible name. Decorative icons should be hidden from assistive technology.
- Preserve visible keyboard focus and sufficient contrast.
- Exact, similar, uncertain, authorised, and secured states must be distinguishable by words—not colour alone.
- Avoid unnecessary client state and speculative product features.

## Product integrity

- Exact matches need evidence such as identifiers, title, variant, size, packaging, or compatibility.
- Similar products must be labeled as alternatives, never silently promoted to exact matches.
- Uncertain or high-risk purchases require user confirmation or more evidence.
- Purchase authority must remain item-, amount-, merchant-, purpose-, and time-bounded.
- Demo merchant, price, order, and delivery data must read as illustrative unless connected to a real source.

## Repository map

- `src/routes/` — pages, route metadata, and route-level interaction.
- `src/components/morrow/` — Morrow-specific sections and visual primitives.
- `src/components/ui/` — reusable Radix/shadcn-style controls.
- `src/assets/` — brand and editorial artwork.
- `public/` — favicons, manifest icons, robots metadata, and social preview.
- `src/styles.css` — visual tokens, global styling, and named motion patterns.
- `.openai/hosting.json` — Sites project metadata; keep only supported bindings and the exact project ID.
- `scripts/` — deterministic build and Sites staging helpers.

Do not hand-edit `src/routeTree.gen.ts`; TanStack regenerates it.

## Engineering workflow

- Preserve Bun and `bun.lock`; do not introduce a second package manager or lockfile.
- Preserve the TanStack Start, Vite, Nitro, Tailwind, and Cloudflare-compatible architecture.
- Use existing components and tokens before creating new abstractions.
- Keep generated output (`.output/`, `dist/`, `.wrangler/`) out of Git.
- When changing customer-facing metadata, update the favicon/manifest/social-card references together when relevant.
- Treat unrelated working-tree changes as user-owned and do not discard them.

Before handing off a change, run:

```sh
bun run build
bun run lint
git diff --check
```

The current lint configuration may report existing Fast Refresh warnings in shared UI primitive files. Do not introduce new lint errors.

## Source-control safety

Use additive commits with focused messages. Never rewrite published history.

<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Do not force-push.
- Do not rebase, amend, or squash commits that may have been pushed.
- Do not run destructive reset or checkout commands to clean the tree.
- Push only a validated, buildable state to the connected branch.
