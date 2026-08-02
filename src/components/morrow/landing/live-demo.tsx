import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Camera,
  Fingerprint,
  PackageCheck,
  ScanLine,
  ScanText,
  Store,
} from "lucide-react";
import productCatalogue from "@/assets/product-catalogue-plate.jpg";
import { Button } from "@/components/ui/button";
import {
  ArchiveNumber,
  EvidenceLedger,
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
  cropPosition: string;
  cropSize: string;
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
    cropPosition: "0% 54%",
    cropSize: "230%",
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
    cropPosition: "27% 68%",
    cropSize: "245%",
    exact: true,
    note: "Compatibility confirmed against a recognised HP DeskJet 2755e.",
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
    cropPosition: "48% 28%",
    cropSize: "180%",
    exact: false,
    note: "Closest verified alternative: brushed brass, with a shade 2 cm narrower.",
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
    cropPosition: "69% 91%",
    cropSize: "195%",
    exact: true,
    note: "Saved size applied from the Cabinet. Exact colourway shown in stock.",
    evidence: [
      { label: "Logo detected", status: "confirmed" },
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
    cropPosition: "100% 24%",
    cropSize: "190%",
    exact: true,
    note: "Supplier identified from the care label. Two shown for home delivery.",
    evidence: [
      { label: "Care label text matched", status: "confirmed" },
      { label: "Supplier catalogue matched", status: "confirmed" },
      { label: "Fill weight matched", status: "confirmed" },
      { label: "Size matched", status: "confirmed" },
    ],
  },
];

const stageMeta = [
  { short: "Picture", icon: Camera },
  { short: "Evidence", icon: ScanText },
  { short: "Identity", icon: BadgeCheck },
  { short: "Offer", icon: Store },
  { short: "Approval", icon: Fingerprint },
];

const stageDurations = [680, 760, 820, 760, 720];

export function LiveDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const autoPlayed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sample, setSample] = useState<Sample>(samples[0]!);
  const [step, setStep] = useState(-1);
  const [runId, setRunId] = useState(0);
  const done = step >= stageMeta.length;
  const running = step >= 0 && !done;
  const sampleIndex = samples.findIndex((item) => item.id === sample.id);

  const stages = useMemo(
    () => [
      {
        title: "Picture received",
        body: "The object is separated from its surroundings.",
        finding: sample.label,
      },
      {
        title: "Visible evidence found",
        body:
          sample.identifier === "NO IDENTIFIER FOUND"
            ? "No reliable code is visible, so identity remains constrained."
            : "The visible code is normalised before catalogue search.",
        finding: sample.identifier,
      },
      {
        title: sample.exact ? "Exact variant locked" : "Alternative only",
        body: sample.exact
          ? "Brand, title, variant and size agree; contradictions are clear."
          : "The form is similar, but the maker cannot be proved from this view.",
        finding: sample.variant,
      },
      {
        title: "Orderable offer checked",
        body: "Wrong sizes, unavailable variants and unsafe totals are set aside.",
        finding: `${sample.merchant} · ${sample.total}`,
      },
      {
        title: "Your hand stays on the till",
        body: "A passkey grants one item, one merchant, one maximum and a short window.",
        finding: "Nothing moves without approval",
      },
    ],
    [sample],
  );

  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(
      () => setStep((current) => current + 1),
      stageDurations[step] ?? 720,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [running, step]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || autoPlayed.current) return;
        autoPlayed.current = true;
        observer.disconnect();
        setRunId((current) => current + 1);
        setStep(
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? stageMeta.length
            : 0,
        );
      },
      { threshold: 0.28 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function run(next: Sample) {
    autoPlayed.current = true;
    setSample(next);
    setRunId((current) => current + 1);
    setStep(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? stageMeta.length
        : 0,
    );
  }

  const activeStage = stages[Math.min(step, stages.length - 1)];
  const specimenStyle = {
    backgroundImage: `url(${productCatalogue})`,
    backgroundPosition: sample.cropPosition,
    backgroundSize: sample.cropSize,
  };

  return (
    <section
      ref={sectionRef}
      id="how"
      className="mx-auto max-w-6xl px-4 py-14 sm:py-16"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionKicker index="02">Live inspection</SectionKicker>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl sm:text-4xl">
            Choose an object. Watch Merchant of Tomorrow work.
          </h2>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-right">
          Illustrative catalogue and dispatch data. The live desk uses your
          photograph and connected merchant sources.
        </p>
      </div>

      <div className="object-film mt-7" aria-label="Choose a sample object">
        {samples.map((nextSample, index) => (
          <button
            key={nextSample.id}
            type="button"
            onClick={() => run(nextSample)}
            aria-pressed={nextSample.id === sample.id}
            className="object-film-button"
          >
            <span
              className="object-film-picture"
              role="img"
              aria-label={`Illustrated ${nextSample.label}`}
              style={{
                backgroundImage: `url(${productCatalogue})`,
                backgroundPosition: nextSample.cropPosition,
                backgroundSize: nextSample.cropSize,
              }}
            />
            <span className="min-w-0 px-2 py-2 text-left">
              <span className="block font-mono text-[9px] text-brass">
                0{index + 1}
              </span>
              <span className="mt-0.5 block truncate text-xs">
                {nextSample.label}
              </span>
            </span>
          </button>
        ))}
      </div>

      <section
        className="tomorrow-inspector plate mt-4 overflow-hidden rounded-sm bg-card"
        data-running={running ? "true" : "false"}
        data-done={done ? "true" : "false"}
        aria-busy={running}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/50 px-3 py-2.5 sm:px-4">
          <span className="flex min-w-0 items-center gap-2">
            <ScanLine className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate mono-caps text-muted-foreground">
              Optical merchandise inspector
            </span>
          </span>
          <ArchiveNumber value="MOR-1907-1842" />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <figure className="specimen-bay border-b border-border lg:border-b-0 lg:border-r">
            <div
              key={`${sample.id}-${runId}`}
              className="demo-photo-slot"
              data-running={running ? "true" : "false"}
              data-done={done ? "true" : "false"}
            >
              <div className="demo-photo-sheet">
                <div
                  className="demo-photo-image"
                  role="img"
                  aria-label={`Catalogue illustration cropped to the selected ${sample.label}`}
                  style={specimenStyle}
                />
                <div
                  className="demo-photo-past"
                  style={specimenStyle}
                  aria-hidden="true"
                />
                <span className="demo-photo-beam" aria-hidden="true" />
                {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                  <span
                    key={corner}
                    className="demo-photo-corner"
                    data-corner={corner}
                    aria-hidden="true"
                  />
                ))}
                {(step >= 1 || done) && (
                  <span className="demo-evidence-tag demo-evidence-tag-code">
                    {sample.identifier}
                  </span>
                )}
                {(step >= 2 || done) && (
                  <span className="demo-evidence-tag demo-evidence-tag-variant">
                    {sample.exact ? "VARIANT AGREES" : "MAKER UNKNOWN"}
                  </span>
                )}
                {(step >= 3 || done) && (
                  <span className="demo-evidence-tag demo-evidence-tag-offer">
                    OFFER CHECKED
                  </span>
                )}
              </div>
            </div>
            <figcaption className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-2.5 sm:px-4">
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

          <div className="verdict-bay min-w-0" aria-live="polite">
            {step < 0 ? (
              <div className="grid min-h-[390px] place-items-center p-8 text-center">
                <div>
                  <span className="awaiting-aperture" aria-hidden="true">
                    <Camera className="h-7 w-7" />
                  </span>
                  <h3 className="mt-5 text-2xl">Show us the object.</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The desk will begin when this section enters view.
                  </p>
                </div>
              </div>
            ) : !done && activeStage ? (
              <div
                key={`${sample.id}-${step}-${runId}`}
                className="inspection-note min-h-[390px] p-5 sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="inspection-note-number">
                    {String(step + 1).padStart(2, "0")}
                  </span>
                  <span className="mono-caps text-muted-foreground">
                    {stageMeta[step]?.short}
                  </span>
                </div>
                <div className="mt-9 flex items-start gap-4">
                  <span
                    className={`inspection-note-icon ${step === 4 ? "inspection-note-icon-passkey" : ""}`}
                    aria-hidden="true"
                  >
                    {(() => {
                      const Icon = stageMeta[step]?.icon ?? ScanLine;
                      return <Icon className="h-7 w-7" />;
                    })()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-2xl leading-tight">
                      {activeStage.title}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                      {activeStage.body}
                    </p>
                  </div>
                </div>
                <div className="inspection-finding-slip mt-10">
                  <span className="label-caps text-muted-foreground">
                    Finding
                  </span>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-primary">
                    {activeStage.finding}
                  </p>
                </div>
              </div>
            ) : (
              <div className="receipt-enter p-4 sm:p-5">
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
                    {sample.exact ? "Exact verified" : "Alternative only"}
                  </StatusStamp>
                </div>

                <EvidenceLedger className="mt-4" items={sample.evidence} />

                <div className="mt-4 border border-dashed border-brass/70 p-3">
                  <p className="label-caps text-muted-foreground">
                    Illustrative dispatch
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
                  <Link to="/scan">
                    <PackageCheck className="mr-2 h-4 w-4" aria-hidden />
                    Get this
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <ol className="demo-process-track" aria-label="Inspection progress">
          {stageMeta.map((stage, index) => {
            const state =
              done || index < step
                ? "complete"
                : index === step
                  ? "current"
                  : "upcoming";
            return (
              <li
                key={stage.short}
                className="demo-process-step"
                data-state={state}
              >
                <span className="demo-process-mark" aria-hidden="true">
                  <stage.icon className="h-3.5 w-3.5" />
                </span>
                <span>{stage.short}</span>
              </li>
            );
          })}
        </ol>
        <div className="demo-progress-rule" aria-hidden="true">
          <span
            style={{
              width: `${step < 0 ? 0 : done ? 100 : ((step + 1) / stageMeta.length) * 100}%`,
            }}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-xs text-muted-foreground">
            {running
              ? "Inspecting visible evidence — purchase controls remain locked."
              : done
                ? "Inspection complete. Approval remains yours."
                : "Select any object to replay the inspection."}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(sample)}
              className="min-h-10 flex-1 sm:flex-none"
            >
              <ScanLine className="mr-2 h-4 w-4" aria-hidden />
              Replay
            </Button>
            {running ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep(stageMeta.length)}
                className="min-h-10 flex-1 sm:flex-none"
              >
                Show result
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
}
