import { useState } from "react";
import {
  Clock,
  Fingerprint,
  Lock,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plate, SectionKicker, StatusStamp } from "../bits";

const authorityTerms = [
  ["Maximum", "₹2,000"],
  ["Purpose", "One compatible water-purifier filter"],
  ["Merchant", "Selected verified seller"],
  ["Duration", "10 minutes"],
  ["Additional charges", "Not allowed"],
  ["Reusable", "No"],
];

const protections = [
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
];

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
            {authorityTerms.map(([term, value]) => (
              <div
                key={term}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2.5"
              >
                <dt className="min-w-0 text-sm text-muted-foreground">
                  {term}
                </dt>
                <dd className="text-right font-mono text-xs">{value}</dd>
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
                <Button
                  className="min-h-12 w-full text-base"
                  onClick={() => setApproved(true)}
                >
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
          {protections.map((protection) => (
            <Plate key={protection.title} className="p-4">
              <protection.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg leading-tight">{protection.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {protection.body}
              </p>
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
