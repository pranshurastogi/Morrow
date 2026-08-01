import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Fingerprint,
  Lock,
  ReceiptText,
  ShieldCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plate, SectionKicker, StatusStamp, VintageLabel } from "./bits";
import seal from "@/assets/morrow-seal.png";

/* ===================== LOOKING SIMILAR IS NOT ENOUGH ===================== */

const candidates = [
  {
    name: "Foaming Facial Cleanser",
    detail: "236 ml · Normal to Oily",
    verdict: "Visually similar, wrong size",
    tone: "unverified" as const,
    stamp: "Rejected",
  },
  {
    name: "Hydrating Facial Cleanser",
    detail: "473 ml · Normal to Dry",
    verdict: "Correct brand, wrong variant",
    tone: "similar" as const,
    stamp: "Set aside",
  },
  {
    name: "Foaming Facial Cleanser",
    detail: "473 ml · Normal to Oily",
    verdict: "Barcode, title, size and packaging matched",
    tone: "verified" as const,
    stamp: "Exact",
  },
];

export function SimilarNotEnough() {
  return (
    <section id="proof" className="border-y border-border bg-card surface-grain">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="03">Verification</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          Looking similar is not enough.
        </h2>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Near matches are refused. Identifiers, variants and packaging must agree.
        </p>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {candidates.map((c, i) => (
            <Plate as="li" key={c.name + c.detail} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[11px] text-brass">
                  Candidate {String(i + 1).padStart(2, "0")}
                </span>
                <StatusStamp tone={c.tone}>{c.stamp}</StatusStamp>
              </div>
              <h3 className="mt-3 text-lg leading-tight">{c.name}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{c.detail}</p>
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {c.verdict}
              </p>
            </Plate>
          ))}
        </ol>

        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <StatusStamp tone="verified" animate className="text-sm">
            Exact match verified
          </StatusStamp>
          <Button className="min-h-11" asChild>
            <Link to="/scan">Get this</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ======================== PURCHASE AUTHORITY (₹2,000) ==================== */

export function PurchaseAuthority() {
  const [approved, setApproved] = useState(false);

  return (
    <section id="authority" className="mx-auto max-w-6xl px-4 py-14">
      <SectionKicker index="04">Bounded authority</SectionKicker>
      <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
        Tell Morrow what it may do — not your card number.
      </h2>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        One item. One limit. One short-lived permission.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Plate className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-4 py-2">
            <span className="label-caps">Purchase authority</span>
            <Lock className="h-3.5 w-3.5 text-brass" aria-hidden />
          </div>
          <dl className="divide-y divide-border px-4">
            {[
              ["Maximum", "₹2,000"],
              ["Purpose", "One compatible water-purifier filter"],
              ["Merchant", "Selected verified seller"],
              ["Duration", "10 minutes"],
              ["Additional charges", "Not allowed"],
              ["Reusable", "No"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2.5"
              >
                <dt className="min-w-0 text-sm text-muted-foreground">{k}</dt>
                <dd className="text-right font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="p-4">
            {approved ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <StatusStamp tone="verified" animate className="text-base">
                  Secured
                </StatusStamp>
                <p className="font-display text-lg">It is on its way.</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  ORDER MOR-1907-1842 · ₹1,860 PAID · ARRIVING TOMORROW
                </p>
              </div>
            ) : (
              <>
                <Button className="min-h-12 w-full text-base" onClick={() => setApproved(true)}>
                  <Fingerprint className="mr-2 h-5 w-5" aria-hidden />
                  Approve with passkey
                </Button>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  Permission expires in 10 minutes
                </p>
              </>
            )}
          </div>
        </Plate>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: ShieldCheck,
              title: "Restricted authority",
              body: "The agent may spend only within the amount and conditions you approved.",
            },
            {
              icon: ReceiptText,
              title: "Verifiable completion",
              body: "Morrow confirms whether checkout actually succeeded and shows the resulting order.",
            },
          ].map((c) => (
            <Plate key={c.title} className="p-4">
              <c.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg leading-tight">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </Plate>
          ))}
          <p className="sm:col-span-2 border-t border-border pt-4 text-sm italic text-muted-foreground">
            Permission for this purchase — never the whole wallet.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================ AUDIENCE CAROUSEL ========================== */

const people = [
  {
    who: "Grandfather",
    holding: "An empty tea tin",
    said: "“The same one. Not the fancy new flavour.”",
    morrow: "Original blend verified. Reordering two tins.",
  },
  {
    who: "Parent",
    holding: "A printer cartridge",
    said: "“This printer has started complaining again.”",
    morrow: "Compatible cartridge verified for HP DeskJet 2755e.",
  },
  {
    who: "Tourist",
    holding: "A hotel pillow",
    said: "“I have no idea what this is called, but I need it.”",
    morrow: "Hotel supplier identified. Two available for home delivery.",
  },
  {
    who: "Mechanic",
    holding: "A machine component",
    said: "“Need this before tomorrow’s repair.”",
    morrow: "Part number verified. Regional compatibility confirmed.",
  },
  {
    who: "Fashion user",
    holding: "A screenshot of loafers",
    said: "“These, but in my size.”",
    morrow: "Likely exact model found. Size 9 available.",
  },
];

export function AudienceCarousel() {
  const [i, setI] = useState(0);
  const person = people[i]!;

  return (
    <section id="examples" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="05">Everyone, including them</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          No product vocabulary required.
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Morrow works from what you can show — not what you know how to search. Built for people
          born in 2000, and for people who still call every website “Google.”
        </p>

        <Plate className="mt-8 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <VintageLabel>{person.who}</VintageLabel>
            <span className="font-mono text-[11px] text-muted-foreground">
              {String(i + 1).padStart(2, "0")} / {String(people.length).padStart(2, "0")}
            </span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
            <div>
              <p className="label-caps text-muted-foreground">Holding</p>
              <p className="mt-1 font-display text-xl">{person.holding}</p>
              <blockquote className="mt-4 border-l-2 border-brass pl-3 font-display text-[17px] leading-snug">
                {person.said}
              </blockquote>
            </div>
            <div className="border border-dashed border-primary/50 bg-primary/5 p-3">
              <p className="label-caps text-primary">Morrow</p>
              <p className="mt-2 text-sm leading-relaxed">{person.morrow}</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border p-3">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Previous example"
              onClick={() => setI((v) => (v - 1 + people.length) % people.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-1.5" aria-hidden>
              {people.map((p, idx) => (
                <span
                  key={p.who}
                  className={`h-1.5 w-6 ${idx === i ? "bg-primary" : "bg-border"}`}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Next example"
              onClick={() => setI((v) => (v + 1) % people.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Plate>
      </div>
    </section>
  );
}

/* =========================== TIME TRAVEL SLIDER ========================== */

const years = [
  {
    year: "1900",
    how: "Find it in a catalogue",
    effort: ["One catalogue", "One handwritten order", "One postal payment", "Several weeks"],
  },
  {
    year: "1950",
    how: "Telephone the department store",
    effort: ["Find the telephone number", "Describe the item", "Hope they understand which lamp"],
  },
  {
    year: "1995",
    how: "Drive to several shops",
    effort: [
      "Ask three salespeople",
      "Carry a paper photograph",
      "Return home without the exact one",
    ],
  },
  {
    year: "2010",
    how: "Search the web",
    effort: [
      "Try twelve keywords",
      "Open fifteen tabs",
      "Compare merchants",
      "Enter checkout details",
    ],
  },
  {
    year: "Today",
    how: "Use visual search",
    effort: [
      "Many visually similar products",
      "You still verify it yourself",
      "You still buy it yourself",
    ],
  },
  {
    year: "Morrow",
    how: "Show it once",
    effort: [
      "Exact or similar match classified",
      "Compatibility checked",
      "Trusted offers compared",
      "Prava completes the approved purchase",
    ],
  },
];

export function TimeTravel() {
  const [i, setI] = useState(0);
  const era = years[i]!;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionKicker index="06">Time travel</SectionKicker>
      <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
        Buying this lamp, through the years.
      </h2>

      <div
        className="mt-6 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2"
        role="tablist"
        aria-label="Era"
      >
        {years.map((y, idx) => (
          <button
            key={y.year}
            role="tab"
            aria-selected={idx === i}
            onClick={() => setI(idx)}
            className={`min-h-11 shrink-0 snap-start border px-4 label-caps transition-colors ${
              idx === i
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-brass"
            }`}
          >
            {y.year}
          </button>
        ))}
      </div>

      <Plate className="mt-4 p-4 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="label-caps text-muted-foreground">{era.year}</p>
            <p className="mt-2 font-display text-2xl leading-tight">{era.how}</p>
          </div>
          <ul className="space-y-2">
            {era.effort.map((e) => (
              <li
                key={e}
                className="flex gap-2 border-b border-dashed border-border pb-2 font-mono text-xs text-muted-foreground"
              >
                <span className="text-brass">·</span>
                {e}
              </li>
            ))}
          </ul>
        </div>
      </Plate>

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <p className="font-display text-xl">A century of commerce reduced to one natural action.</p>
        <Button className="min-h-11" asChild>
          <Link to="/scan">Get this</Link>
        </Button>
      </div>
    </section>
  );
}

/* ============================== USE CASES ================================ */

const useCases = [
  {
    title: "Refill it",
    body: "Photograph an empty product. The exact variant is reordered.",
    stamp: "Exact",
  },
  {
    title: "Replace it",
    body: "Photograph a broken or depleted component. Compatibility is verified before purchase.",
    stamp: "Compatible",
  },
  {
    title: "Find it",
    body: "Upload a fashion or décor screenshot. Get the exact item, or a clearly labelled alternative.",
    stamp: "Similar",
  },
  {
    title: "Remember it",
    body: "Photograph an object while travelling. Save it now, purchase it when you are ready.",
    stamp: "Saved",
  },
  {
    title: "Help them",
    body: "A parent sends a photograph. Morrow handles identification, comparison and payment approval.",
    stamp: "Assisted",
  },
  {
    title: "Source it",
    body: "A business user photographs a part or supply. Morrow checks availability and delivery urgency.",
    stamp: "Dispatched",
  },
];

export function UseCases() {
  return (
    <section id="merchants" className="border-y border-border bg-card surface-grain">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="05">In the world</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          Six ordinary moments Morrow was built for.
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((u) => (
            <Plate as="li" key={u.title} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl leading-tight">{u.title}</h3>
                <StatusStamp tone="info">{u.stamp}</StatusStamp>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{u.body}</p>
            </Plate>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ============================== COMPARISON =============================== */

const comparison = [
  {
    what: "Search engine",
    does: "Tells you what it might be",
    joke: "Twenty tabs open.",
  },
  {
    what: "Visual search",
    does: "Shows visually similar results",
    joke: "“Here are 46 lamps that are vaguely lamp-shaped.”",
  },
  {
    what: "Marketplace",
    does: "Lets you buy from its own inventory",
    joke: "“Sponsored result first, naturally.”",
  },
  {
    what: "Morrow",
    does: "Verifies what you mean, searches the market, and completes the approved purchase",
    joke: "“Exact model verified. Arriving tomorrow.”",
  },
];

export function Comparison() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionKicker index="08">The difference</SectionKicker>
      <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
        Recognition is not enough. Morrow verifies before it buys.
      </h2>
      <ol className="mt-8 divide-y divide-border border-y border-border">
        {comparison.map((c, i) => {
          const last = i === comparison.length - 1;
          return (
            <li
              key={c.what}
              className={`grid gap-1 py-4 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,240px)] sm:items-baseline sm:gap-4 ${
                last ? "bg-primary/5" : ""
              }`}
            >
              <span className={`label-caps ${last ? "text-primary" : "text-muted-foreground"}`}>
                {c.what}
              </span>
              <span className="font-display text-lg leading-snug">{c.does}</span>
              <span className="font-mono text-xs text-muted-foreground sm:text-right">
                {c.joke}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* =========================== PRAVA INFRASTRUCTURE ======================== */

const pipeline = [
  "User intent",
  "Product identification",
  "Exact-match verification",
  "Merchant and offer selection",
  "User-defined spending authority",
  "Prava-secured payment",
  "Verified order result",
];

export function PravaInfrastructure() {
  return (
    <section id="prava" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="06">Infrastructure</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          An agent that can act — with boundaries.
        </h2>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Prava secures each payment within the boundary you approve.
        </p>

        <ol className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((p, i) => (
            <li
              key={p}
              className="flex items-center gap-2 border border-border bg-background px-3 py-3"
            >
              <span className="font-mono text-[11px] text-brass">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 text-sm">{p}</span>
              {i < pipeline.length - 1 ? (
                <ArrowRight
                  className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-prose text-xs text-muted-foreground">
          Uncertain matches are never purchased without confirmation.
        </p>
      </div>
    </section>
  );
}

/* ============================== FINAL CTA ================================ */

export function FinalCta() {
  return (
    <section className="era-gradient surface-grain">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <img
          src={seal}
          alt="The Morrow seal: a brass lens, a parcel mark and the letter M"
          width={816}
          height={816}
          loading="lazy"
          className="mx-auto h-20 w-20"
        />
        <h2 className="mt-7 text-balance text-3xl sm:text-4xl">
          Commerce has finally caught up with human language.
        </h2>
        <p className="mx-auto mt-4 max-w-prose text-sm text-muted-foreground">
          Show it. Verify it. Get it.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" className="min-h-12 text-base" asChild>
            <Link to="/scan">Open Morrow</Link>
          </Button>
          <Button size="lg" variant="outline" className="min-h-12 text-base" asChild>
            <a href="#how">Explore the product</a>
          </Button>
        </div>
        <p className="mt-5 mono-caps text-muted-foreground">Payments secured through Prava</p>
      </div>
    </section>
  );
}

/* ================================ FOOTER ================================= */

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-double border-ink/40 bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1.2fr)_auto] sm:items-end">
          <div>
            <p className="font-display text-2xl leading-tight">Morrow Mercantile Co.</p>
            <p className="mt-2 text-sm italic text-muted-foreground">
              Established approximately one century late.
            </p>
            <p className="mt-4 max-w-prose border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              MORROW DOES NOT PURCHASE UNCERTAIN PRODUCTS WITHOUT USER CONFIRMATION.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 label-caps" aria-label="Footer">
            <a href="#how" className="text-muted-foreground hover:text-foreground">
              Process
            </a>
            <a href="#proof" className="text-muted-foreground hover:text-foreground">
              Proof
            </a>
            <a href="#authority" className="text-muted-foreground hover:text-foreground">
              Guardrails
            </a>
          </nav>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="mono-caps text-muted-foreground">
            MOR-1907-1842 · London &amp; Bengaluru
          </span>
          <span className="mono-caps text-muted-foreground">See it → Verify it → Get it</span>
        </div>
      </div>
    </footer>
  );
}
