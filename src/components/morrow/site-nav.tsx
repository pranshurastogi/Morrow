import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, ScanLine, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import seal from "@/assets/morrow-seal.png";

const links = [
  { label: "How it works", href: "#how" },
  { label: "Proof", href: "#proof" },
  { label: "Guardrails", href: "#authority" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header sticky top-0 z-50 border-b-2 border-double border-ink/35 bg-parchment/94 backdrop-blur-md">
      <div className="mx-auto grid min-h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Link
          to="/"
          className="brand-lockup group flex min-w-0 items-center gap-2.5"
          aria-label="Morrow home"
        >
          <span className="brand-seal grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brass/50 bg-ivory">
            <img
              src={seal}
              alt=""
              width={816}
              height={816}
              className="h-9 w-9"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[1.35rem] leading-none">
              Morrow
            </span>
            <span className="mt-1 hidden mono-caps text-muted-foreground sm:block">
              Mercantile Co. · Est. 1900
            </span>
          </span>
        </Link>

        <nav
          className="header-index hidden items-center gap-1 border-x border-border px-2 lg:flex"
          aria-label="Main"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="header-index-link rounded-sm px-3 py-2 label-caps text-muted-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-2">
          <Button
            size="sm"
            className="morrow-invite min-h-10 px-3 sm:px-4"
            asChild
          >
            <Link to="/scan">
              <ScanLine className="morrow-invite-scan h-4 w-4" aria-hidden />
              <span>Open Morrow</span>
              <ArrowUpRight
                className="hidden h-3.5 w-3.5 sm:block"
                aria-hidden
              />
            </Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[84vw] max-w-xs bg-card p-0"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-display text-lg">Index</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex flex-col p-2" aria-label="Mobile">
                {links.map((l, i) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center justify-between border-b border-border/70 px-3 text-sm"
                  >
                    {l.label}
                    <span className="font-mono text-[11px] text-brass">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </a>
                ))}
              </nav>
              <div className="p-4">
                <Button className="morrow-invite min-h-11 w-full" asChild>
                  <Link to="/scan" onClick={() => setOpen(false)}>
                    <ScanLine
                      className="morrow-invite-scan h-4 w-4"
                      aria-hidden
                    />
                    Open Morrow
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
