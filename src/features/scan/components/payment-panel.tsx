import { ShieldCheck } from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import type { EmbeddedPaymentSession } from "../api/types";
import { PravaCardForm } from "./prava-card-form";

export function PaymentPanel({
  session,
  onSuccess,
  onError,
}: {
  session: EmbeddedPaymentSession;
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
      <Plate className="mt-5 p-3">
        <PravaCardForm
          session={session}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Plate>
    </section>
  );
}
