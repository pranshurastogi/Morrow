import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Camera,
  ChevronLeft,
  Image as ImageIcon,
  Link2,
  Mic,
  Package,
  ScanLine,
  Archive,
  Compass,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ArchiveNumber,
  EvidenceLedger,
  Plate,
  ProcessingDial,
  SectionKicker,
  StatusStamp,
  VintageLabel,
} from "@/components/morrow/bits";

const title = "Morrow — Object inspection";
const description =
  "Scan an object, verify the exact product, compare trusted dispatches, and approve a bounded purchase through Prava.";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.png" },
      { property: "og:image:alt", content: "Morrow — Show it. Verify it. Get it." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og.png" },
    ],
  }),
  component: ScanPage,
});

type Step = "idle" | "processing" | "result" | "authority" | "secured";

const evidence = [
  { label: "Barcode matched", status: "confirmed" as const },
  { label: "Product title matched", status: "confirmed" as const },
  { label: "473 ml size matched", status: "confirmed" as const },
  { label: "Packaging artwork matched", status: "confirmed" as const },
];

function ScanPage() {
  const [step, setStep] = useState<Step>("idle");

  function capture() {
    setStep("processing");
    setTimeout(() => setStep("result"), 2200);
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-parchment/92 px-3 py-2 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-11 w-11" asChild>
          <Link to="/" aria-label="Back to the landing page">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 text-center">
          <p className="truncate font-display text-lg leading-none">Morrow</p>
          <p className="mono-caps text-muted-foreground">Object desk</p>
        </div>
        <ArchiveNumber value="1842" />
      </header>

      <main className="mx-auto w-full max-w-[560px] px-4 py-5">
        {step === "idle" && (
          <div className="animate-slip">
            <SectionKicker>Discover</SectionKicker>
            <h1 className="mt-4 text-4xl leading-[1.05]">What have you found?</h1>
            <p className="mt-3 text-sm text-muted-foreground">Point, verify, purchase.</p>

            <Plate className="relative mt-6 overflow-hidden p-4">
              <div className="pointer-events-none absolute inset-3 border border-dashed border-brass/50" />
              <div className="relative flex flex-col items-center gap-4 py-6">
                <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-brass/70">
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-ink/25 bg-primary/5">
                    <ScanLine className="h-7 w-7 text-primary" aria-hidden />
                  </div>
                </div>
                <Button
                  size="lg"
                  className="min-h-12 w-full text-base active:translate-y-px"
                  onClick={capture}
                >
                  <Camera className="mr-2 h-5 w-5" aria-hidden />
                  Scan an object
                </Button>
              </div>
            </Plate>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { icon: ImageIcon, label: "Upload image" },
                { icon: ImageIcon, label: "Paste screenshot" },
                { icon: Link2, label: "Paste link" },
                { icon: Mic, label: "Describe it" },
              ].map((a) => (
                <Button
                  key={a.label}
                  variant="outline"
                  className="min-h-11 justify-start"
                  onClick={capture}
                >
                  <a.icon className="mr-2 h-4 w-4 text-brass" aria-hidden />
                  {a.label}
                </Button>
              ))}
            </div>

            <h2 className="mt-8 label-caps text-muted-foreground">Recently handled</h2>
            <ul className="mt-3 space-y-2">
              {[
                ["Skincare refill", "Exact", "2 Aug"],
                ["Printer cartridge", "Compatible", "29 Jul"],
                ["Hotel pillow", "Dispatched", "21 Jul"],
                ["Lamp alternative", "Similar", "14 Jul"],
              ].map(([name, stamp, date]) => (
                <Plate as="li" key={name} className="flex items-center gap-3 p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center border border-border bg-secondary/60">
                    <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{name}</span>
                    <span className="mono-caps text-muted-foreground">{date}</span>
                  </span>
                  <StatusStamp
                    tone={stamp === "Exact" ? "verified" : stamp === "Similar" ? "similar" : "info"}
                  >
                    {stamp}
                  </StatusStamp>
                </Plate>
              ))}
            </ul>
          </div>
        )}

        {step === "processing" && (
          <div className="receipt-enter py-16">
            <ProcessingDial label="Reading visible markings" />
            <ul className="mx-auto mt-8 max-w-xs space-y-1 font-mono text-xs text-muted-foreground">
              <li>· Inspecting the object</li>
              <li>· Reading visible markings</li>
              <li className="animate-ticker text-foreground">· Checking product catalogues</li>
            </ul>
          </div>
        )}

        {(step === "result" || step === "authority" || step === "secured") && (
          <div key={step} className="receipt-enter">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-caps text-muted-foreground">CeraVe</p>
                <h1 className="mt-1 text-2xl leading-tight">Foaming Facial Cleanser</h1>
                <p className="mt-1 text-sm text-muted-foreground">Normal to Oily Skin · 473 ml</p>
                <p className="mt-1 font-mono text-[11px] text-brass">GTIN 3337875597197</p>
              </div>
              <StatusStamp animate tone="verified" className="text-center">
                Exact match verified
              </StatusStamp>
            </div>

            <Plate className="mt-5 p-4">
              <p className="label-caps text-muted-foreground">Evidence ledger</p>
              <EvidenceLedger className="mt-3" items={evidence} />
              <p className="mt-3 text-xs text-muted-foreground">
                Confidence 0.98 · identifier, variant and packaging agree.
              </p>
            </Plate>

            <h2 className="mt-7 font-display text-xl">Available dispatches</h2>
            <Plate className="mt-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <VintageLabel>Recommended dispatch</VintageLabel>
                <StatusStamp tone="info">Authorised</StatusStamp>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="font-display text-xl">Official retailer</span>
                <span className="font-mono text-sm">₹1,240 delivered</span>
              </div>
              <dl className="mt-3 divide-y divide-border border-y border-border">
                {[
                  ["Delivery", "Arrives tomorrow"],
                  ["Stock", "In stock"],
                  ["Returns", "30 days"],
                  ["Trust score", "94 / 100"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-2">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="font-mono text-xs">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Lowest verified total from an authorised seller with next-day delivery.
              </p>
            </Plate>

            {step === "authority" && (
              <Plate className="mt-5 p-4">
                <p className="label-caps">Purchase authority</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Morrow is requesting permission to complete this purchase.
                </p>
                <dl className="mt-3 divide-y divide-border border-y border-border">
                  {[
                    ["Merchant", "Official retailer"],
                    ["Maximum authorised total", "₹1,300"],
                    ["Permission expires", "10 minutes"],
                    ["Usable for", "This purchase only"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-2">
                      <dt className="text-sm text-muted-foreground">{k}</dt>
                      <dd className="text-right font-mono text-xs">{v}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  className="mt-4 min-h-12 w-full text-base"
                  onClick={() => setStep("secured")}
                >
                  Approve purchase
                </Button>
              </Plate>
            )}

            {step === "secured" && (
              <Plate className="mt-5 p-4 text-center">
                <StatusStamp animate tone="postal" className="text-base">
                  Secured
                </StatusStamp>
                <p className="mt-4 font-display text-2xl">It is on its way.</p>
                <dl className="mt-4 divide-y divide-border border-y border-border text-left">
                  {[
                    ["Order", "MOR-1907-1842"],
                    ["Merchant", "Official retailer"],
                    ["Total paid", "₹1,240"],
                    ["Delivery", "Tomorrow, by 21:00"],
                    ["Return deadline", "1 September"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-2">
                      <dt className="text-sm text-muted-foreground">{k}</dt>
                      <dd className="font-mono text-xs">{v}</dd>
                    </div>
                  ))}
                </dl>
                <Button variant="outline" className="mt-4 min-h-11 w-full" asChild>
                  <Link to="/">Track dispatch</Link>
                </Button>
              </Plate>
            )}

            {step === "result" && (
              <div className="mt-5 flex flex-col gap-2">
                <Button className="min-h-12 text-base" onClick={() => setStep("authority")}>
                  Get this
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => setStep("idle")}>
                  This is not it
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-parchment/95 backdrop-blur-sm"
        aria-label="Sections"
      >
        <ul className="mx-auto grid max-w-[560px] grid-cols-4">
          {[
            { icon: Compass, label: "Scan" },
            { icon: Zap, label: "Requests" },
            { icon: Package, label: "Dispatches" },
            { icon: Archive, label: "Archive" },
          ].map((t, i) => (
            <li key={t.label}>
              <button
                onClick={() => setStep("idle")}
                aria-current={i === 0 ? "page" : undefined}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 ${
                  i === 0 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" aria-hidden />
                <span className="label-caps">{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
