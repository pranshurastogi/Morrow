import {
  BadgeCheck,
  Clock3,
  Fingerprint,
  KeyRound,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import type {
  EmbeddedPaymentSession,
  Offer,
  PublicPaymentResult,
} from "../api/types";
import { PravaCardForm } from "./prava-card-form";
import { TransactionMilestone } from "./transaction-milestone";

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

export function PaymentStatusPanel({
  offer,
  result,
}: {
  offer: Offer;
  result: PublicPaymentResult | null;
}) {
  const credentialReady = Boolean(
    result &&
    (result.providerStatus !== "pending" ||
      result.checkoutStatus !== "PENDING"),
  );
  const checkoutStarted = Boolean(
    result &&
    ["CHECKOUT_IN_PROGRESS", "COMPLETED"].includes(result.checkoutStatus),
  );
  const orderConfirmed = result?.status === "completed";

  const copy =
    result?.checkoutStatus === "CHECKOUT_IN_PROGRESS"
      ? {
          title: "Completing the dispatch.",
          message:
            "The merchant checkout is running with the amount- and merchant-scoped Prava credential.",
        }
      : credentialReady
        ? {
            title: "Approval verified.",
            message:
              "Prava issued the bounded credential. Morrow is waiting for the merchant checkout record.",
          }
        : {
            title: "Approval received.",
            message:
              "The secure form is closed. Morrow is reading Prava’s server-side result.",
          };

  return (
    <section
      className="receipt-enter"
      aria-labelledby="payment-status-title"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusStamp tone="info">Checking Prava</StatusStamp>
        <span className="font-mono text-[10px] text-muted-foreground">
          {result?.checkoutStatus.replaceAll("_", " ") ?? "APPROVAL RECEIVED"}
        </span>
      </div>
      <h1 id="payment-status-title" className="mt-5 text-3xl">
        {copy.title}
      </h1>
      <p
        className="mt-3 text-sm leading-relaxed text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {copy.message}
      </p>

      <div className="sandbox-verification-rule mt-5" aria-hidden />
      <Plate className="mt-3 p-4">
        <ol className="relative before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-border">
          <TransactionMilestone
            complete
            active={false}
            icon={Fingerprint}
            title="Device approval received"
            detail="Card entry and passkey approval stayed inside Prava."
          />
          <TransactionMilestone
            complete={credentialReady}
            active={!credentialReady}
            icon={KeyRound}
            title="Scoped credential"
            detail={`${offer.merchant.name} · limited to this approved total`}
          />
          <TransactionMilestone
            complete={checkoutStarted}
            active={credentialReady && !checkoutStarted}
            icon={PackageCheck}
            title="Merchant checkout"
            detail="Morrow requires a verified merchant order identifier."
          />
          <TransactionMilestone
            complete={orderConfirmed}
            active={checkoutStarted && !orderConfirmed}
            icon={BadgeCheck}
            title="Final confirmation"
            detail="Prava and the merchant must both report completion."
          />
        </ol>
      </Plate>
    </section>
  );
}
