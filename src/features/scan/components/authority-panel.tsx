import { Fingerprint, LockKeyhole } from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type { Offer } from "../api/types";

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    amountMinor / 100,
  );
}

export function AuthorityPanel({
  offer,
  onApprove,
}: {
  offer: Offer;
  onApprove: () => void;
}) {
  return (
    <section className="receipt-enter" aria-labelledby="authority-title">
      <StatusStamp tone="postal">Approval required</StatusStamp>
      <h1 id="authority-title" className="mt-5 text-3xl">
        Bound to this purchase.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your approval is limited to one item, one merchant, this amount, and
        this short session.
      </p>
      <Plate className="mt-5 p-4">
        <div className="flex gap-3 border-b border-border pb-3">
          <LockKeyhole
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            aria-hidden
          />
          <div>
            <p className="label-caps">Purchase authority</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Raw card details stay on Prava's secure surface.
            </p>
          </div>
        </div>
        <dl className="divide-y divide-border border-b border-border">
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-sm text-muted-foreground">Item</dt>
            <dd className="max-w-[60%] text-right text-sm">
              {offer.product.title}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-sm text-muted-foreground">Merchant</dt>
            <dd className="text-right font-mono text-xs">
              {offer.merchant.name}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-sm text-muted-foreground">Maximum total</dt>
            <dd className="text-right font-mono text-xs">
              {formatMoney(
                offer.price.estimatedTotalMinor,
                offer.price.currency,
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-sm text-muted-foreground">Permission</dt>
            <dd className="text-right font-mono text-xs">
              Single use · 15 minutes
            </dd>
          </div>
        </dl>
        <Button className="mt-4 min-h-12 w-full text-base" onClick={onApprove}>
          <Fingerprint className="mr-2 h-5 w-5" aria-hidden />
          Continue with Prava
        </Button>
      </Plate>
    </section>
  );
}
