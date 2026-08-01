import { Check, CircleAlert } from "lucide-react";
import {
  EvidenceLedger,
  Plate,
  StatusStamp,
  VintageLabel,
} from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type { Candidate, Offer, ScanRecord } from "../api/types";

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    amountMinor / 100,
  );
}

export function ResultPanel({
  scan,
  candidate,
  offer,
  offers,
  onGet,
  onReject,
}: {
  scan: ScanRecord;
  candidate: Candidate;
  offer: Offer | null;
  offers: Offer[];
  onGet: () => void;
  onReject: () => void;
}) {
  const evidence = candidate.matched_evidence.map((item) => ({
    label: `${item.field.replaceAll("_", " ")} matched`,
    status: "confirmed" as const,
  }));
  const unavailable = !offer;
  return (
    <section className="receipt-enter" aria-labelledby="verified-product-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">
            {candidate.brand ?? "Maker not visible"}
          </p>
          <h1
            id="verified-product-title"
            className="mt-1 text-2xl leading-tight"
          >
            {candidate.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              candidate.variant,
              candidate.size_value
                ? `${candidate.size_value} ${candidate.size_unit}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {(candidate.gtin || candidate.model_number || candidate.mpn) && (
            <p className="mt-1 font-mono text-[11px] text-brass">
              {candidate.gtin
                ? `GTIN ${candidate.gtin}`
                : `MODEL ${candidate.model_number ?? candidate.mpn}`}
            </p>
          )}
        </div>
        <StatusStamp animate tone="verified" className="text-center">
          Exact match verified
        </StatusStamp>
      </div>

      <Plate className="mt-5 p-4">
        <p className="label-caps text-muted-foreground">Evidence ledger</p>
        <EvidenceLedger
          className="mt-3"
          items={
            evidence.length
              ? evidence
              : [{ label: "Exact identifier matched", status: "confirmed" }]
          }
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Identity score {Number(candidate.identity_score).toFixed(2)} ·
          deterministic contradictions checked.
        </p>
      </Plate>

      <h2 className="mt-7 font-display text-xl">Available dispatches</h2>
      {offer ? (
        <Plate className="mt-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <VintageLabel>Recommended dispatch</VintageLabel>
            <StatusStamp tone="info">
              {offer.merchant.authorizedSeller
                ? "Authorised"
                : "Variant verified"}
            </StatusStamp>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="font-display text-xl">{offer.merchant.name}</span>
            <span className="font-mono text-sm">
              {formatMoney(
                offer.price.estimatedTotalMinor,
                offer.price.currency,
              )}{" "}
              estimated
            </span>
          </div>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-sm text-muted-foreground">Inventory</dt>
              <dd className="font-mono text-xs">
                {offer.inventory.status.replaceAll("_", " ")}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-sm text-muted-foreground">Price status</dt>
              <dd className="font-mono text-xs">
                {offer.price.isBinding
                  ? "Binding"
                  : "Estimate—rechecked at checkout"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt className="text-sm text-muted-foreground">
                Merchant variant
              </dt>
              <dd className="font-mono text-xs">Verified</dd>
            </div>
          </dl>
          {offer.rankingReasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {offer.rankingReasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                    aria-hidden
                  />
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </Plate>
      ) : (
        <Plate className="mt-3 p-4">
          <div className="flex gap-3">
            <CircleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-postal"
              aria-hidden
            />
            <div>
              <p className="font-medium">No purchasable exact offer yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {offers.length > 0
                  ? "Listings were found, but none passed exact-variant and policy checks."
                  : (scan.errorMessage ??
                    "No current merchant listing is available.")}
              </p>
            </div>
          </div>
        </Plate>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Button
          className="min-h-12 text-base"
          disabled={unavailable}
          onClick={onGet}
        >
          Get this
        </Button>
        <Button variant="outline" className="min-h-11" onClick={onReject}>
          This is not it
        </Button>
      </div>
    </section>
  );
}

export function AmbiguousPanel({
  scan,
  onReset,
}: {
  scan: ScanRecord;
  onReset: () => void;
}) {
  return (
    <section className="receipt-enter py-8">
      <StatusStamp tone="similar">Not exact yet</StatusStamp>
      <h1 className="mt-5 text-3xl">
        The evidence supports alternatives, not an exact purchase.
      </h1>
      <Plate className="mt-5 p-4 text-sm text-muted-foreground">
        Morrow will not silently promote a visually similar item. Add a clearer
        identifier or begin a new inspection.
      </Plate>
      <Button
        variant="outline"
        className="mt-5 min-h-11 w-full"
        onClick={onReset}
      >
        Start another inspection
      </Button>
    </section>
  );
}
