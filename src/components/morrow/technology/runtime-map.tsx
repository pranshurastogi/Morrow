import {
  Boxes,
  Cloud,
  Database,
  Eye,
  LockKeyhole,
  Radio,
  Server,
  ShoppingBag,
} from "lucide-react";
import { Plate, SectionKicker, VintageLabel } from "@/components/morrow/bits";

const runtime = [
  {
    zone: "Public desk",
    title: "TanStack web app",
    detail: "Camera, upload, account, live inspection",
    icon: Eye,
    marks: ["Vercel", "PWA", "Clerk"],
  },
  {
    zone: "Control room",
    title: "Fastify API",
    detail: "Ownership, validation, state and approval",
    icon: Server,
    marks: ["REST", "SSE", "Zod"],
  },
  {
    zone: "Restricted floor",
    title: "BullMQ workers",
    detail: "Recognition, merchants, checkout, retention",
    icon: Boxes,
    marks: ["Redis", "No public port", "Bounded concurrency"],
  },
];

const instruments = [
  { icon: Cloud, label: "R2", note: "private image objects" },
  { icon: Database, label: "PostgreSQL", note: "ledger + pgvector" },
  { icon: Radio, label: "Vision", note: "structured observation" },
  { icon: ShoppingBag, label: "Shopify UCP", note: "live variants + carts" },
  { icon: LockKeyhole, label: "Prava", note: "scoped payment authority" },
];

export function RuntimeMap() {
  return (
    <section id="runtime" className="mx-auto max-w-6xl px-4 py-16">
      <SectionKicker index="02">Deployment topology</SectionKicker>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <h2 className="max-w-3xl text-balance text-3xl sm:text-4xl">
          Three rooms. Deliberately separate keys.
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground lg:text-right">
          Public interaction, orchestration, and checkout never share the same
          authority.
        </p>
      </div>

      <Plate className="mt-8 overflow-hidden p-3 sm:p-5">
        <ol className="tech-runtime-rail" aria-label="Morrow runtime flow">
          {runtime.map((node, index) => (
            <li className="contents" key={node.title}>
              <article className="tech-runtime-node">
                <div className="flex items-center justify-between gap-3">
                  <span className="mono-caps text-brass">{node.zone}</span>
                  <node.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-5 text-2xl leading-tight">{node.title}</h3>
                <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                  {node.detail}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {node.marks.map((mark) => (
                    <VintageLabel key={mark}>{mark}</VintageLabel>
                  ))}
                </div>
              </article>
              {index < runtime.length - 1 ? (
                <div className="tech-runtime-connector" aria-hidden="true">
                  <span>
                    {index === 0 ? "AUTH REST + SSE" : "DURABLE JOBS"}
                  </span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-3 border-t border-border pt-3 sm:mt-5 sm:pt-5">
          <p className="mb-3 mono-caps text-muted-foreground">
            Server-side instruments
          </p>
          <ul className="tech-instrument-grid">
            {instruments.map((instrument) => (
              <li key={instrument.label}>
                <instrument.icon aria-hidden />
                <span>
                  <strong>{instrument.label}</strong>
                  <small>{instrument.note}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Plate>
    </section>
  );
}
