import {
  Check,
  Circle,
  CreditCard,
  ExternalLink,
  Fingerprint,
  PackageX,
  ShieldCheck,
} from "lucide-react";
import { Plate, StatusStamp, VintageLabel } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type {
  Offer,
  SandboxApprovalResult,
  SandboxApprovalSession,
} from "../api/types";
import { PravaCardForm } from "./prava-card-form";

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    amountMinor / 100,
  );
}

function OrderSummary({ offer }: { offer: Offer }) {
  return (
    <Plate className="p-0">
      <div className="border-b border-border bg-secondary/45 px-4 py-3">
        <VintageLabel>Sandbox purchase context</VintageLabel>
      </div>
      <dl className="divide-y divide-border px-4">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-sm text-muted-foreground">Item</dt>
          <dd className="max-w-[68%] text-right text-sm">
            {offer.product.title}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-sm text-muted-foreground">Merchant</dt>
          <dd className="text-right font-mono text-xs">
            {offer.merchant.name}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-sm text-muted-foreground">Approval amount</dt>
          <dd className="text-right font-mono text-xs">
            {formatMoney(offer.price.estimatedTotalMinor, offer.price.currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-sm text-muted-foreground">Environment</dt>
          <dd className="text-right font-mono text-xs">Prava sandbox</dd>
        </div>
      </dl>
    </Plate>
  );
}

export function SandboxCheckoutPanel({
  session,
  offer,
  onSuccess,
  onError,
}: {
  session: SandboxApprovalSession;
  offer: Offer;
  onSuccess: () => void;
  onError: (error: Error) => void;
}) {
  return (
    <section className="receipt-enter" aria-labelledby="sandbox-checkout-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusStamp tone="info">Prava sandbox</StatusStamp>
        <span className="mono-caps text-muted-foreground">No real charge</span>
      </div>
      <h1 id="sandbox-checkout-title" className="mt-5 text-3xl">
        Test the secure approval.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The real item, merchant, and amount are pinned below. Sandbox card data
        stays inside Prava, and no merchant order will be placed.
      </p>

      <div className="mt-5">
        <OrderSummary offer={offer} />
      </div>

      <Plate className="mt-4 border-primary/35 p-3">
        <div className="mb-3 flex gap-3 border-b border-border px-1 pb-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-medium">Prava secure surface</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use a Prava sandbox test card. A real device passkey prompt may
              appear.
            </p>
          </div>
        </div>
        <PravaCardForm
          session={session}
          onSuccess={onSuccess}
          onError={onError}
        />
        <a
          href="https://docs.prava.space/api-reference/test-cards"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex min-h-11 items-center justify-center gap-2 border-t border-border px-2 pt-3 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Open Prava sandbox test cards
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </Plate>
    </section>
  );
}

function Milestone({
  complete,
  active,
  icon: Icon,
  title,
  detail,
}: {
  complete: boolean;
  active: boolean;
  icon: typeof CreditCard;
  title: string;
  detail: string;
}) {
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      <span
        className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border ${
          complete
            ? "border-primary bg-primary text-primary-foreground"
            : active
              ? "border-brass bg-secondary text-foreground"
              : "border-border bg-parchment text-muted-foreground"
        }`}
      >
        {complete ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : active ? (
          <Icon className="h-4 w-4" aria-hidden />
        ) : (
          <Circle className="h-3 w-3" aria-hidden />
        )}
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
    </li>
  );
}

export function SandboxStatusPanel({
  offer,
  result,
}: {
  offer: Offer;
  result: SandboxApprovalResult | null;
}) {
  const milestones = result?.milestones;
  return (
    <section className="receipt-enter" aria-labelledby="sandbox-status-title">
      <StatusStamp tone="info">Checking Prava</StatusStamp>
      <h1 id="sandbox-status-title" className="mt-5 text-3xl">
        Closing the test safely.
      </h1>
      <p
        className="mt-3 text-sm leading-relaxed text-muted-foreground"
        role="status"
      >
        {result?.message ??
          "The secure form completed. Morrow is reading Prava’s server-side result."}
      </p>

      <Plate className="mt-5 p-4">
        <ol className="relative before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-border">
          <Milestone
            complete
            active={false}
            icon={CreditCard}
            title="Session created"
            detail={`${offer.merchant.name} · ${formatMoney(offer.price.estimatedTotalMinor, offer.price.currency)}`}
          />
          <Milestone
            complete={milestones?.cardAndPasskeyApproved ?? false}
            active={!milestones?.cardAndPasskeyApproved}
            icon={Fingerprint}
            title="Card and passkey approved"
            detail="Approval happens only on Prava’s isolated surface."
          />
          <Milestone
            complete={milestones?.credentialIssued ?? false}
            active={Boolean(
              milestones?.cardAndPasskeyApproved &&
              !milestones?.credentialIssued,
            )}
            icon={ShieldCheck}
            title="Scoped credential issued"
            detail="The one-time credential remains server-side and is never shown here."
          />
          <Milestone
            complete={milestones?.providerClosed ?? false}
            active={Boolean(
              milestones?.credentialIssued && !milestones?.providerClosed,
            )}
            icon={PackageX}
            title="No-checkout result reported"
            detail="Because no merchant executor ran, Morrow reports a declined checkout outcome instead of claiming an order."
          />
        </ol>
      </Plate>
    </section>
  );
}

export function SandboxCompletionPanel({
  offer,
  result,
  onReset,
}: {
  offer: Offer;
  result: SandboxApprovalResult;
  onReset: () => void;
}) {
  return (
    <section
      className="receipt-enter py-5"
      aria-labelledby="sandbox-complete-title"
    >
      <StatusStamp animate tone="verified">
        Sandbox verified
      </StatusStamp>
      <ShieldCheck className="mt-6 h-9 w-9 text-primary" aria-hidden />
      <h1 id="sandbox-complete-title" className="mt-4 text-3xl">
        Prava approval works.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The card and passkey step completed for the real purchase context. The
        exercise was then closed without attempting merchant checkout.
      </p>

      <Plate className="mt-5 p-4">
        <dl className="divide-y divide-border border-y border-border">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">Item</dt>
            <dd className="max-w-[65%] text-right text-sm">
              {offer.product.title}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">Approval amount</dt>
            <dd className="font-mono text-xs">
              {formatMoney(
                offer.price.estimatedTotalMinor,
                offer.price.currency,
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">Prava reference</dt>
            <dd className="max-w-[65%] break-all text-right font-mono text-[10px]">
              {result.providerOrderId}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">Merchant order</dt>
            <dd className="font-mono text-xs">Not placed</dd>
          </div>
        </dl>
      </Plate>

      <Button className="mt-5 min-h-11 w-full" onClick={onReset}>
        Inspect another object
      </Button>
    </section>
  );
}
