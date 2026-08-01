import { Clock3, ShieldCheck } from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import type { EmbeddedPaymentSession, Offer } from "../api/types";
import { PravaCardForm } from "./prava-card-form";

export function PaymentPanel({
  session,
  offer,
  onSuccess,
  onError,
}: {
  session: EmbeddedPaymentSession;
  offer: Offer;
  onSuccess: () => void;
  onError: (error: Error) => void;
}) {
  return (
    <section className="receipt-enter" aria-labelledby="payment-title">
      <StatusStamp tone="info">Secured by Prava</StatusStamp>
      <h1 id="payment-title" className="mt-5 text-3xl">
        Approve this bounded purchase.
      </h1>
      <div className="mt-3 flex gap-3 text-sm leading-relaxed text-muted-foreground">
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden
        />
        <p>
          Morrow never receives your raw card number. Approval is single-use and
          merchant-scoped.
        </p>
      </div>
      <Plate className="mt-5 p-4">
        <dl className="divide-y divide-border border-y border-border">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">Item</dt>
            <dd className="max-w-[68%] text-right text-sm">
              {offer.product.title}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">Merchant</dt>
            <dd className="font-mono text-xs">{offer.merchant.name}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">Maximum total</dt>
            <dd className="font-mono text-xs">
              {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: offer.price.currency,
              }).format(offer.price.estimatedTotalMinor / 100)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-4 w-4 text-brass" aria-hidden />
          Approval expires{" "}
          {new Date(session.expiresAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </Plate>
      <Plate className="mt-4 p-3">
        <PravaCardForm
          session={session}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Plate>
    </section>
  );
}
