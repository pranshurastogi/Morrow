import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Circle,
  CircleAlert,
  CircleCheck,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  Fingerprint,
  PackageX,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Plate, StatusStamp, VintageLabel } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type {
  Offer,
  PravaBrowserCapabilities,
  PravaClientIssue,
  SandboxApprovalResult,
  SandboxApprovalSession,
} from "../api/types";
import {
  getPravaBrowserCapabilities,
  isPasskeyIssue,
  sandboxSupportDetails,
} from "../lib/prava-security";
import { PravaCardForm } from "./prava-card-form";
import { TransactionMilestone } from "./transaction-milestone";

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    amountMinor / 100,
  );
}

function useSessionClock(expiresAt: string): string {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      setRemaining(
        Math.max(0, new Date(expiresAt).getTime() - new Date().getTime()),
      );
    };
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);
  if (remaining === null) return "15 min";
  if (remaining === 0) return "Expired";
  const totalSeconds = Math.ceil(remaining / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function PurchaseContext({ offer }: { offer: Offer }) {
  return (
    <Plate className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <VintageLabel>Pinned purchase</VintageLabel>
          <p className="mt-3 text-sm font-medium leading-snug">
            {offer.product.title}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {offer.merchant.name} · sandbox only
          </p>
        </div>
        <p className="shrink-0 font-mono text-sm font-medium">
          {formatMoney(offer.price.estimatedTotalMinor, offer.price.currency)}
        </p>
      </div>
      <div className="border-t border-border bg-secondary/35 px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
        Item, merchant, and maximum amount are fixed for this session.
      </div>
    </Plate>
  );
}

function ReadinessChecks() {
  const [capabilities, setCapabilities] =
    useState<PravaBrowserCapabilities | null>(null);
  useEffect(() => {
    let active = true;
    void getPravaBrowserCapabilities().then((result) => {
      if (active) setCapabilities(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const checks = [
    {
      label: "HTTPS",
      ready: capabilities?.secureContext ?? null,
    },
    {
      label: "Passkey support",
      ready: capabilities?.webAuthnAvailable ?? null,
    },
  ];

  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-2 border-y border-border py-2.5"
      aria-label="Device security readiness"
    >
      {checks.map((check) => (
        <li
          key={check.label}
          className={`flex items-center gap-1.5 font-mono text-[10px] ${
            check.ready === null
              ? "text-muted-foreground"
              : check.ready
                ? "text-primary"
                : "text-postal"
          }`}
        >
          {check.ready === null ? (
            <Circle className="h-3.5 w-3.5" aria-hidden />
          ) : check.ready ? (
            <CircleCheck className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <CircleAlert className="h-3.5 w-3.5" aria-hidden />
          )}
          {check.label}{" "}
          {check.ready === null
            ? "checking"
            : check.ready
              ? "ready"
              : "required"}
        </li>
      ))}
    </ul>
  );
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Continue with the in-document fallback for restricted browsers.
    }
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function SecurityRecovery({
  issue,
  session,
  restarting,
  onRestart,
}: {
  issue: PravaClientIssue;
  session: SandboxApprovalSession;
  restarting: boolean;
  onRestart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const passkeyIssue = isPasskeyIssue(issue);
  const refreshFailed = issue.event === "SESSION_REFRESH_FAILED";
  const supportDetails = useMemo(
    () =>
      sandboxSupportDetails({
        issue,
        sandboxCheckId: session.sandboxCheckId,
        providerOrderId: session.providerOrderId,
      }),
    [issue, session.providerOrderId, session.sandboxCheckId],
  );

  const title = refreshFailed
    ? "A fresh session could not open."
    : passkeyIssue
      ? "Device approval did not finish."
      : "Secure approval paused.";

  return (
    <div className="sandbox-recovery receipt-enter" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-postal/55 text-postal">
          <Fingerprint className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <StatusStamp tone="postal">Approval paused</StatusStamp>
          <h2 className="mt-3 text-2xl">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {refreshFailed
              ? "Your verified item is still here. Check the connection, then request another session."
              : passkeyIssue
                ? "Request a fresh session, then complete the Touch ID, Face ID, device PIN, or security-key prompt without cancelling it."
                : issue.message}
          </p>
        </div>
      </div>

      <ol className="mt-4 grid gap-2 border-y border-border py-3 text-xs text-muted-foreground">
        <li className="flex gap-2">
          <span className="font-mono text-brass">01</span>
          Keep this secure page open while the device prompt is active.
        </li>
        <li className="flex gap-2">
          <span className="font-mono text-brass">02</span>
          Approve the prompt fully; a cancelled or timed-out prompt cannot be
          resumed.
        </li>
        <li className="flex gap-2">
          <span className="font-mono text-brass">03</span>
          If it repeats, copy the support details before trying another browser.
        </li>
      </ol>

      <Button
        className="mt-4 min-h-11 w-full"
        disabled={restarting}
        onClick={onRestart}
      >
        <RefreshCw
          className={restarting ? "animate-dial" : undefined}
          aria-hidden
        />
        {restarting ? "Opening fresh session…" : "Try with a fresh session"}
      </Button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="min-h-11 px-3"
          onClick={() => {
            void copyToClipboard(supportDetails).then(() => setCopied(true));
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy details"}
        </Button>
        <Button variant="outline" className="min-h-11 px-3" asChild>
          <a
            href="https://docs.prava.space/api-reference/testing"
            target="_blank"
            rel="noreferrer"
          >
            Troubleshoot
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </div>

      <details className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer items-center font-mono text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          View sanitized support details
        </summary>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-secondary/40 p-3 font-mono text-[10px] leading-relaxed">
          {supportDetails}
        </pre>
        {!issue.responseId && (
          <p className="mt-2 leading-relaxed">
            The isolated Prava iframe did not return its response header to
            Morrow. If support needs it, copy the X-Response-ID from the failed
            Prava request in browser developer tools.
          </p>
        )}
      </details>
    </div>
  );
}

export function SandboxCheckoutPanel({
  session,
  offer,
  issue,
  restarting,
  onSuccess,
  onIssue,
  onRestart,
}: {
  session: SandboxApprovalSession;
  offer: Offer;
  issue: PravaClientIssue | null;
  restarting: boolean;
  onSuccess: () => void;
  onIssue: (issue: PravaClientIssue) => void;
  onRestart: () => void;
}) {
  const clock = useSessionClock(session.expiresAt);
  return (
    <section className="receipt-enter" aria-labelledby="sandbox-checkout-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusStamp tone="info">Prava sandbox</StatusStamp>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5 text-brass" aria-hidden />
          {clock} · no real charge
        </span>
      </div>
      <h1 id="sandbox-checkout-title" className="mt-5 text-3xl">
        Confirm on your device.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Enter a sandbox card inside Prava. When your device asks, finish the
        passkey prompt before returning here.
      </p>

      <div className="mt-5">
        <PurchaseContext offer={offer} />
      </div>

      <Plate className="mt-4 overflow-hidden border-primary/35 p-0">
        <div className="px-4 pt-4">
          <div className="flex gap-3">
            <ShieldCheck
              className="h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <div>
              <p className="font-medium">Prava secure surface</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The card and biometric approval stay outside Morrow.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <ReadinessChecks />
          </div>
        </div>
        <div className="p-3">
          {restarting ? (
            <div
              className="prava-secure-status border border-border"
              data-active="true"
              role="status"
            >
              <span className="prava-status-dial" aria-hidden>
                <RefreshCw className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">
                  Opening a fresh session
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Your verified product and offer remain unchanged.
                </span>
              </span>
            </div>
          ) : issue ? (
            <SecurityRecovery
              issue={issue}
              session={session}
              restarting={restarting}
              onRestart={onRestart}
            />
          ) : (
            <PravaCardForm
              key={session.sandboxCheckId}
              session={session}
              onSuccess={onSuccess}
              onIssue={onIssue}
            />
          )}
        </div>
        <div
          className={`${issue ? "" : "grid grid-cols-2"} border-t border-border`}
        >
          <a
            href="https://docs.prava.space/api-reference/test-cards"
            target="_blank"
            rel="noreferrer"
            className={`flex min-h-11 items-center justify-center gap-2 px-2 text-center text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
              issue ? "" : "border-r border-border"
            }`}
          >
            Test cards
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          {!issue && (
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 px-2 text-center text-xs text-muted-foreground hover:bg-secondary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-50"
              disabled={restarting}
              onClick={onRestart}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Approval stuck?
            </button>
          )}
        </div>
      </Plate>
    </section>
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
        Verifying the approval.
      </h1>
      <p
        className="mt-3 text-sm leading-relaxed text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {result?.message ??
          "The secure form completed. Morrow is reading Prava’s server-side result."}
      </p>

      <div className="sandbox-verification-rule mt-5" aria-hidden />
      <Plate className="mt-3 p-4">
        <ol className="relative before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-border">
          <TransactionMilestone
            complete
            active={false}
            icon={CreditCard}
            title="Session created"
            detail={`${offer.merchant.name} · ${formatMoney(offer.price.estimatedTotalMinor, offer.price.currency)}`}
          />
          <TransactionMilestone
            complete={milestones?.cardAndPasskeyApproved ?? false}
            active={!milestones?.cardAndPasskeyApproved}
            icon={Fingerprint}
            title="Card and passkey approved"
            detail="Approval happens only on Prava’s isolated surface."
          />
          <TransactionMilestone
            complete={milestones?.credentialIssued ?? false}
            active={Boolean(
              milestones?.cardAndPasskeyApproved &&
              !milestones?.credentialIssued,
            )}
            icon={ShieldCheck}
            title="Scoped credential issued"
            detail="The one-time credential remains server-side."
          />
          <TransactionMilestone
            complete={milestones?.providerClosed ?? false}
            active={Boolean(
              milestones?.credentialIssued && !milestones?.providerClosed,
            )}
            icon={PackageX}
            title="Exercise closed"
            detail="No merchant checkout runs in this sandbox approval test."
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
        Approval verified.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Prava completed the card and passkey step for this bounded purchase
        context. No merchant order was attempted.
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
