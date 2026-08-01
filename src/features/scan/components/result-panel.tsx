import { useRef } from "react";
import { Camera, Check, CircleAlert, FlaskConical } from "lucide-react";
import {
  EvidenceLedger,
  Plate,
  StatusStamp,
  VintageLabel,
} from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type {
  Candidate,
  CheckoutCapability,
  Offer,
  ScanRecord,
} from "../api/types";

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
  checkoutCapability,
  onGet,
  onSandboxTest,
  onSelectOffer,
  onReject,
}: {
  scan: ScanRecord;
  candidate: Candidate;
  offer: Offer | null;
  offers: Offer[];
  checkoutCapability: CheckoutCapability | null;
  onGet: () => void;
  onSandboxTest: () => void;
  onSelectOffer: (offer: Offer) => void;
  onReject: () => void;
}) {
  const evidence = candidate.matched_evidence.map((item) => ({
    label: `${item.field.replaceAll("_", " ")} matched`,
    status: "confirmed" as const,
  }));
  const unavailable = !offer || checkoutCapability?.available !== true;
  const eligibleOffers = offers.filter(
    (item) =>
      !item.illustrative &&
      item.identityVerification.status === "verified" &&
      item.rejectedReasons.length === 0,
  );
  const exact = candidate.classification === "exact_verified";
  const identityLabel = exact
    ? "Exact match verified"
    : candidate.classification === "likely_exact"
      ? "Likely match · confirmed"
      : "Alternative · confirmed";
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
        <StatusStamp
          animate
          tone={exact ? "verified" : "similar"}
          className="text-center"
        >
          {identityLabel}
        </StatusStamp>
      </div>

      <Plate className="mt-5 p-4">
        <p className="label-caps text-muted-foreground">Evidence ledger</p>
        <EvidenceLedger
          className="mt-3"
          items={
            evidence.length
              ? evidence
              : [
                  {
                    label: exact
                      ? "Exact identifier matched"
                      : "Product choice confirmed by you",
                    status: "confirmed",
                  },
                ]
          }
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Identity score {Number(candidate.identity_score).toFixed(2)} ·
          deterministic contradictions checked.
        </p>
      </Plate>

      <h2 className="mt-7 font-display text-xl">Available dispatches</h2>
      {eligibleOffers.length > 1 && (
        <div
          className="mt-3 grid gap-2"
          role="list"
          aria-label="Verified dispatches"
        >
          {eligibleOffers.slice(0, 4).map((item) => {
            const selected = item.id === offer?.id;
            return (
              <button
                key={item.id}
                type="button"
                role="listitem"
                className="min-h-14 border border-border bg-card px-3 py-2 text-left shadow-ledger transition-transform active:translate-y-px"
                aria-pressed={selected}
                onClick={() => onSelectOffer(item)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium">{item.merchant.name}</span>
                  <span className="font-mono text-xs">
                    {formatMoney(
                      item.price.estimatedTotalMinor,
                      item.price.currency,
                    )}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {selected ? "Selected dispatch" : "Select this dispatch"}
                </span>
              </button>
            );
          })}
        </div>
      )}
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

      {offer && checkoutCapability?.available === false && (
        <Plate className="mt-3 p-4">
          <div className="flex gap-3">
            <CircleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-postal"
              aria-hidden
            />
            <div>
              <p className="font-medium">Purchase connection pending</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {checkoutCapability.message}
              </p>
            </div>
          </div>
        </Plate>
      )}

      {offer && checkoutCapability?.sandboxApprovalAvailable && (
        <Plate className="mt-3 border-primary/35 p-4">
          <div className="flex gap-3">
            <FlaskConical
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <div>
              <p className="font-medium">Sandbox checkout check available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Verify the real item, merchant, amount, card surface, and
                passkey flow without moving money or claiming an order.
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
        {offer && checkoutCapability?.sandboxApprovalAvailable && (
          <Button
            variant={unavailable ? "default" : "outline"}
            className="min-h-12 text-base"
            onClick={onSandboxTest}
          >
            <FlaskConical className="mr-2 h-4 w-4" aria-hidden />
            Test with Prava sandbox
          </Button>
        )}
        <Button variant="outline" className="min-h-11" onClick={onReject}>
          This is not it
        </Button>
      </div>
    </section>
  );
}

export function AmbiguousPanel({
  scan,
  candidates,
  onConfirm,
  onEvidence,
  onReset,
}: {
  scan: ScanRecord;
  candidates: Candidate[];
  onConfirm: (productId: string) => void;
  onEvidence: (file: File) => void;
  onReset: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="receipt-enter py-5" aria-labelledby="candidate-title">
      <StatusStamp tone="similar">
        {scan.status === "SIMILAR_FOUND" ? "Likely match" : "Choice required"}
      </StatusStamp>
      <h1 id="candidate-title" className="mt-5 text-3xl leading-tight">
        {scan.status === "SIMILAR_FOUND"
          ? "This looks close. You make the final call."
          : "More than one catalogue record fits."}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        A chosen match may proceed to merchant comparison, but it will not be
        relabelled as an exact identifier match.
      </p>

      <div className="mt-5 space-y-3">
        {candidates.map((candidate, index) => (
          <Plate key={candidate.id} className="p-4">
            <div className="flex gap-3">
              {candidate.image_url ? (
                <img
                  src={candidate.image_url}
                  alt=""
                  width={80}
                  height={80}
                  className="h-20 w-20 shrink-0 border border-border bg-ivory object-contain p-1"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="label-caps text-muted-foreground">
                      Candidate {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-1 font-display text-lg leading-tight">
                      {candidate.brand ? `${candidate.brand} ` : ""}
                      {candidate.name}
                    </h2>
                  </div>
                  <StatusStamp tone="similar">
                    {candidate.classification === "exact_verified"
                      ? "Exact evidence"
                      : candidate.classification === "likely_exact"
                        ? "Likely"
                        : "Alternative"}
                  </StatusStamp>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    candidate.variant,
                    candidate.size_value
                      ? `${candidate.size_value} ${candidate.size_unit}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Variant not exposed"}
                </p>
                <p className="mt-2 font-mono text-[11px] text-brass">
                  Identity evidence{" "}
                  {Number(candidate.identity_score).toFixed(2)}
                </p>
              </div>
            </div>
            <Button
              className="mt-4 min-h-11 w-full"
              onClick={() => onConfirm(candidate.id)}
            >
              Use this match
            </Button>
          </Plate>
        ))}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => input.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4" aria-hidden />
          Add clearer evidence
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={onReset}>
          Start another inspection
        </Button>
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onEvidence(file);
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
