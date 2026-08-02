import { Camera, Fingerprint, ScanSearch, ShieldCheck } from "lucide-react";
import { SectionKicker, StatusStamp } from "@/components/morrow/bits";

const promises = [
  { icon: Camera, label: "One photograph" },
  { icon: ScanSearch, label: "Evidence before identity" },
  { icon: ShieldCheck, label: "Policy before purchase" },
  { icon: Fingerprint, label: "A passkey before payment" },
];

const machineReceipts = [
  ["05", "purpose-built views"],
  ["06", "retrieval lanes"],
  ["≤09", "visual finalists"],
  ["≤02", "precision finalists"],
  ["00", "card digits retained"],
];

export function TechnologyHero() {
  return (
    <section className="tech-hero overflow-hidden border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)] lg:items-center lg:py-20">
        <div className="tech-hero-copy">
          <SectionKicker index="FIELD MANUAL 01">
            Under the counter
          </SectionKicker>
          <h1 className="mt-5 max-w-3xl text-balance text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
            The quiet machinery behind one photograph.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            A model may observe. Policy must verify. Only the customer may
            authorise.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <StatusStamp tone="verified">Production boundary</StatusStamp>
            <StatusStamp tone="info">Versioned decisions</StatusStamp>
          </div>
        </div>

        <div className="tech-principle-dial" aria-label="Morrow trust sequence">
          <div className="tech-principle-dial-ring" aria-hidden />
          <div className="tech-principle-core">
            <span className="mono-caps text-brass">Morrow rule 01</span>
            <strong className="mt-2 block font-display text-2xl font-medium leading-tight">
              Recognition is not authority.
            </strong>
          </div>
          <ol className="tech-principle-orbit">
            {promises.map((item, index) => (
              <li key={item.label} data-position={index + 1}>
                <span className="tech-principle-mark">
                  <item.icon aria-hidden />
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ol>
        </div>

        <dl className="tech-proof-strip lg:col-span-2">
          {machineReceipts.map(([value, label]) => (
            <div key={label}>
              <dt>{value}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
