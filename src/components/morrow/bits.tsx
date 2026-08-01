import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ---------------------------------- stamps --------------------------------- */

type StampTone = "verified" | "similar" | "unverified" | "postal" | "info";

const stampTone: Record<StampTone, string> = {
  verified: "border-primary text-primary",
  similar: "border-brass text-brass",
  unverified: "border-muted-foreground text-muted-foreground",
  postal: "border-postal text-postal",
  info: "border-faded-blue text-faded-blue",
};

export function StatusStamp({
  children,
  tone = "verified",
  className,
  animate,
}: {
  children: ReactNode;
  tone?: StampTone;
  className?: string;
  animate?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border-2 border-double px-2.5 py-1 label-caps",
        "rotate-[-2deg] bg-transparent",
        stampTone[tone],
        animate && "animate-stamp",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------- labels --------------------------------- */

export function VintageLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border border-border bg-secondary/60 px-2 py-1 mono-caps text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionKicker({
  index,
  children,
}: {
  index?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {index ? <span className="mono-caps text-brass">{index}</span> : null}
      <span className="h-px w-6 bg-brass" aria-hidden />
      <span className="label-caps text-muted-foreground">{children}</span>
    </div>
  );
}

export function Plate({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section";
}) {
  return (
    <Tag className={cn("plate rounded-sm bg-card", className)}>{children}</Tag>
  );
}

/* --------------------------------- ledger ---------------------------------- */

export function EvidenceLedger({
  items,
  className,
}: {
  items: { label: string; status: "confirmed" | "pending" | "failed" }[];
  className?: string;
}) {
  return (
    <ul
      className={cn("divide-y divide-border border-y border-border", className)}
    >
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center justify-between gap-3 py-2"
        >
          <span className="min-w-0 truncate font-mono text-xs text-foreground">
            {item.label}
          </span>
          <span
            className={cn(
              "shrink-0 mono-caps",
              item.status === "confirmed" && "text-primary",
              item.status === "pending" && "text-brass",
              item.status === "failed" && "text-postal",
            )}
          >
            {item.status === "confirmed"
              ? "✓ matched"
              : item.status === "pending"
                ? "· checking"
                : "✕ no match"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------- scan dial -------------------------------- */

export function ProcessingDial({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative grid h-24 w-24 place-items-center rounded-full border border-brass/70">
        <div className="absolute inset-1.5 animate-dial rounded-full border border-dashed border-brass/60" />
        <div className="absolute inset-0 rounded-full rule-tick opacity-40 [mask-image:radial-gradient(circle,transparent_58%,black_60%)]" />
        <div className="h-10 w-10 rounded-full border-2 border-primary/80 bg-primary/5" />
        <div className="absolute top-1 h-3 w-px bg-postal" />
      </div>
      {label ? (
        <p className="mono-caps text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------ archival number ---------------------------- */

export function ArchiveNumber({ value }: { value: string }) {
  return (
    <span className="font-mono text-[11px] tracking-[0.18em] text-brass">
      {value}
    </span>
  );
}
