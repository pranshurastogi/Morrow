import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import productCatalogue from "@/assets/product-catalogue-plate.jpg";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArchiveNumber,
  EvidenceLedger,
  Plate,
  ProcessingDial,
  SectionKicker,
  StatusStamp,
} from "../bits";

type Sample = {
  id: string;
  label: string;
  product: string;
  brand: string;
  variant: string;
  identifier: string;
  merchant: string;
  total: string;
  evidence: { label: string; status: "confirmed" }[];
  exact: boolean;
  note: string;
};

const samples: Sample[] = [
  {
    id: "skincare",
    label: "Skincare bottle",
    product: "Foaming Facial Cleanser",
    brand: "CeraVe",
    variant: "Normal to Oily Skin · 473 ml",
    identifier: "GTIN 3337875597197",
    merchant: "Official retailer",
    total: "₹1,240 delivered",
    exact: true,
    note: "Lowest verified total from an authorised seller with next-day delivery.",
    evidence: [
      { label: "Barcode matched", status: "confirmed" },
      { label: "Product title matched", status: "confirmed" },
      { label: "473 ml size matched", status: "confirmed" },
      { label: "Packaging artwork matched", status: "confirmed" },
    ],
  },
  {
    id: "cartridge",
    label: "Printer cartridge",
    product: "67XL Black Ink Cartridge",
    brand: "HP",
    variant: "High yield · Black",
    identifier: "MODEL 3YM57AN",
    merchant: "Authorised supplier",
    total: "₹1,890 delivered",
    exact: true,
    note: "Compatibility confirmed against your recognised HP DeskJet 2755e.",
    evidence: [
      { label: "Model number matched", status: "confirmed" },
      { label: "Cartridge identifier matched", status: "confirmed" },
      { label: "Printer compatibility verified", status: "confirmed" },
      { label: "Region match confirmed", status: "confirmed" },
    ],
  },
  {
    id: "lamp",
    label: "Table lamp",
    product: "Brass Banker's Lamp",
    brand: "Unmarked workshop piece",
    variant: "Green glass shade · 36 cm",
    identifier: "NO IDENTIFIER FOUND",
    merchant: "Specialist décor seller",
    total: "₹4,350 delivered",
    exact: false,
    note: "Closest verified alternative: brushed brass instead of polished, shade 2 cm narrower.",
    evidence: [
      { label: "Silhouette matched", status: "confirmed" },
      { label: "Shade style matched", status: "confirmed" },
      { label: "Dimensions within 6%", status: "confirmed" },
      { label: "Manufacturer unconfirmed", status: "confirmed" },
    ],
  },
  {
    id: "shoes",
    label: "Pair of shoes",
    product: "Leather Penny Loafer",
    brand: "Bass Weejuns",
    variant: "Black · UK 9",
    identifier: "STYLE BA11010",
    merchant: "Brand store",
    total: "₹9,600 delivered",
    exact: true,
    note: "Saved size applied from your Cabinet. Exact colourway in stock.",
    evidence: [
      { label: "Logo detected in screenshot", status: "confirmed" },
      { label: "Style code matched", status: "confirmed" },
      { label: "Saved size 9 applied", status: "confirmed" },
      { label: "Colourway matched", status: "confirmed" },
    ],
  },
  {
    id: "pillow",
    label: "Hotel pillow",
    product: "Down Surround Pillow",
    brand: "Hotel supply line",
    variant: "Standard · Medium support",
    identifier: "SUPPLIER SKU 4471",
    merchant: "Hospitality supplier",
    total: "₹3,120 delivered",
    exact: true,
    note: "Supplier identified from the care label. Two available for home delivery.",
    evidence: [
      { label: "Care label text matched", status: "confirmed" },
      { label: "Supplier catalogue matched", status: "confirmed" },
      { label: "Fill weight matched", status: "confirmed" },
      { label: "Size matched", status: "confirmed" },
    ],
  },
];

const stages = [
  "Inspecting the object",
  "Reading visible markings",
  "Verifying the exact variant",
  "Comparing trusted sellers",
  "Preparing your approval",
];

export function LiveDemo() {
  const [sample, setSample] = useState<Sample>(samples[0]!);
  const [step, setStep] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = step >= stages.length;
  const sampleIndex = samples.findIndex((item) => item.id === sample.id);

  useEffect(() => {
    if (step < 0 || done) return;
    timer.current = setTimeout(() => setStep((current) => current + 1), 520);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [step, done]);

  const progress = useMemo(
    () => Math.min(100, Math.max(0, (step / stages.length) * 100)),
    [step],
  );

  function run(next: Sample) {
    setSample(next);
    setStep(0);
  }

  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-14">
      <SectionKicker index="02">Live demonstration</SectionKicker>
      <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
        Choose an object. Watch Morrow work.
      </h2>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <Plate as="article" className="catalogue-preview overflow-hidden">
            <figure key={sample.id} className="catalogue-preview-inner">
              <div className="overflow-hidden bg-ivory">
                <img
                  src={productCatalogue}
                  alt="Catalogue arrangement of a cleanser bottle, ink cartridge, banker’s lamp, leather loafers and hotel pillow"
                  width={1536}
                  height={1024}
                  loading="lazy"
                  className="catalogue-preview-image aspect-[3/2] w-full object-cover"
                />
              </div>
              <figcaption className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block mono-caps text-muted-foreground">
                    Selected specimen
                  </span>
                  <span className="mt-0.5 block truncate font-display text-lg">
                    {sample.label}
                  </span>
                </span>
                <ArchiveNumber
                  value={`${String(sampleIndex + 1).padStart(2, "0")} / ${String(samples.length).padStart(2, "0")}`}
                />
              </figcaption>
            </figure>
          </Plate>

          <p className="mt-4 label-caps text-muted-foreground">
            Sample objects
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {samples.map((nextSample, index) => (
              <button
                key={nextSample.id}
                type="button"
                onClick={() => run(nextSample)}
                aria-pressed={nextSample.id === sample.id}
                className={`sample-object-tab group flex min-h-11 items-center gap-2 rounded-sm border px-3 text-left text-sm transition-[color,background-color,border-color,transform] ${
                  nextSample.id === sample.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-brass"
                }`}
              >
                <span
                  className={`font-mono text-[10px] ${
                    nextSample.id === sample.id
                      ? "text-primary-foreground/65"
                      : "text-brass"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{nextSample.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => run(sample)} className="min-h-11">
              <ScanLine className="mr-2 h-4 w-4" aria-hidden />
              Run inspection
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setStep(stages.length)}
            >
              Skip animation
            </Button>
          </div>
        </div>

        <Plate className="machine-window overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="mono-caps text-muted-foreground">
              Object inspection
            </span>
            <ArchiveNumber value="MOR-1907-1842" />
          </div>

          {step < 0 ? (
            <div className="px-4 py-12 text-center">
              <ProcessingDial label="Awaiting an object" />
              <p className="mt-4 text-sm text-muted-foreground">
                Select a sample object to begin.
              </p>
            </div>
          ) : !done ? (
            <div className="px-4 py-10">
              <ProcessingDial
                label={stages[Math.min(step, stages.length - 1)] ?? ""}
              />
              <Progress value={progress} className="mt-6 h-1" />
              <ul className="mt-5 space-y-1">
                {stages.slice(0, step + 1).map((stage, index) => (
                  <li
                    key={stage}
                    className={`animate-slip font-mono text-xs ${
                      index === step
                        ? "text-foreground animate-ticker"
                        : "text-muted-foreground"
                    }`}
                  >
                    · {stage}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="receipt-enter p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-caps text-muted-foreground">
                    {sample.brand}
                  </p>
                  <h3 className="mt-1 text-xl leading-tight">
                    {sample.product}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sample.variant}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-brass">
                    {sample.identifier}
                  </p>
                </div>
                <StatusStamp
                  animate
                  tone={sample.exact ? "verified" : "similar"}
                  className="text-center"
                >
                  {sample.exact
                    ? "Exact match verified"
                    : "Closest verified alt."}
                </StatusStamp>
              </div>

              <EvidenceLedger className="mt-4" items={sample.evidence} />

              <div className="mt-4 border border-dashed border-brass/70 p-3">
                <p className="label-caps text-muted-foreground">
                  Recommended dispatch
                </p>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-display text-lg">
                    {sample.merchant}
                  </span>
                  <span className="font-mono text-sm">{sample.total}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {sample.note}
                </p>
              </div>

              <Button className="mt-4 min-h-12 w-full text-base" asChild>
                <Link to="/scan">Get this</Link>
              </Button>
            </div>
          )}
        </Plate>
      </div>
    </section>
  );
}
