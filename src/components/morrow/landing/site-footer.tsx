import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-double border-ink/40 bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1.2fr)_auto] sm:items-end">
          <div>
            <p className="font-display text-2xl leading-tight">
              Merchant of Tomorrow
            </p>
            <p className="mt-2 text-sm italic text-muted-foreground">
              The old mercantile promise, finally made simple.
            </p>
            <p className="mt-4 max-w-prose border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              UNCERTAIN PRODUCTS ARE NEVER PURCHASED WITHOUT USER CONFIRMATION.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 label-caps"
            aria-label="Footer"
          >
            <a
              href="/#how"
              className="text-muted-foreground hover:text-foreground"
            >
              Process
            </a>
            <Link
              to="/how-it-works"
              className="text-muted-foreground hover:text-foreground"
            >
              Under the hood
            </Link>
            <a
              href="/#proof"
              className="text-muted-foreground hover:text-foreground"
            >
              Proof
            </a>
            <a
              href="/#authority"
              className="text-muted-foreground hover:text-foreground"
            >
              Guardrails
            </a>
          </nav>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="mono-caps text-muted-foreground">
            MOR-1907-1842 · London &amp; Bengaluru
          </span>
          <span className="mono-caps text-muted-foreground">
            See it → Verify it → Get it
          </span>
        </div>
      </div>
    </footer>
  );
}
