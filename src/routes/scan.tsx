import {
  ClerkLoading,
  Show,
  SignInButton,
  SignUpButton,
} from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthorityPanel } from "@/features/scan/components/authority-panel";
import { CapturePanel } from "@/features/scan/components/capture-panel";
import {
  CompletionPanel,
  ErrorPanel,
} from "@/features/scan/components/completion-panel";
import { EvidenceRequest } from "@/features/scan/components/evidence-request";
import { PaymentPanel } from "@/features/scan/components/payment-panel";
import { ProgressPanel } from "@/features/scan/components/progress-panel";
import {
  AmbiguousPanel,
  ResultPanel,
} from "@/features/scan/components/result-panel";
import { ScanHeader } from "@/features/scan/components/scan-header";
import { ScanNavigation } from "@/features/scan/components/scan-navigation";
import { useScanFlow } from "@/features/scan/model/use-scan-flow";

const title = "Morrow — Object inspection";
const description =
  "Scan an object, verify the exact product, compare trusted dispatches, and approve a bounded purchase through Prava.";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.png" },
      {
        property: "og:image:alt",
        content: "Morrow — Show it. Verify it. Get it.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og.png" },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <ScanHeader />
      <ClerkLoading>
        <main className="mx-auto w-full max-w-[560px] px-4 py-5">
          <div
            className="ledger-card flex min-h-48 items-center justify-center p-6 text-center"
            role="status"
          >
            <p className="mono-caps text-muted-foreground">
              Opening the object desk
            </p>
          </div>
        </main>
      </ClerkLoading>
      <Show when="signed-out">
        <AuthenticationDesk />
      </Show>
      <Show when="signed-in">
        <AuthenticatedScanDesk />
      </Show>
    </div>
  );
}

function AuthenticationDesk() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-5">
      <section
        className="ledger-card overflow-hidden"
        aria-labelledby="sign-in-title"
      >
        <div className="border-b border-border bg-primary px-5 py-3 text-primary-foreground">
          <p className="mono-caps">Private object desk</p>
        </div>
        <div className="px-5 py-7 text-center sm:px-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-brass/60 bg-brass/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <h1 id="sign-in-title" className="mt-4 font-display text-3xl">
            Sign in before inspection
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Your account keeps inspections, purchase limits, and dispatches
            attached to you.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <SignInButton mode="modal">
              <Button size="lg" className="h-11 w-full">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="outline" size="lg" className="h-11 w-full">
                Create account
              </Button>
            </SignUpButton>
          </div>
          <p className="mono-caps mt-5 text-muted-foreground">
            Purchase authority stays item, merchant, amount, and time bounded
          </p>
        </div>
      </section>
    </main>
  );
}

function AuthenticatedScanDesk() {
  const { state, actions } = useScanFlow();
  const {
    stage,
    scan,
    candidate,
    offers,
    selectedOffer,
    paymentSession,
    paymentResult,
    error,
  } = state;

  return (
    <>
      <main className="mx-auto w-full max-w-[560px] px-4 py-5">
        {stage === "idle" && (
          <CapturePanel onFile={(file) => void actions.startScan(file)} />
        )}
        {(stage === "uploading" ||
          stage === "inspecting" ||
          stage === "checkout") && <ProgressPanel stage={stage} />}
        {stage === "more_evidence" && scan && (
          <EvidenceRequest
            scan={scan}
            onFile={(file) => void actions.addEvidence(file)}
          />
        )}
        {stage === "ambiguous" && scan && (
          <AmbiguousPanel scan={scan} onReset={actions.reset} />
        )}
        {stage === "result" && scan && candidate && (
          <ResultPanel
            scan={scan}
            candidate={candidate}
            offers={offers}
            offer={selectedOffer}
            onGet={() => void actions.requestAuthority()}
            onReject={actions.reset}
          />
        )}
        {stage === "authority" && selectedOffer && (
          <AuthorityPanel
            offer={selectedOffer}
            onApprove={() => void actions.approveWithPrava()}
          />
        )}
        {stage === "payment" && paymentSession && (
          <PaymentPanel
            session={paymentSession}
            onSuccess={() => void actions.pollPayment()}
            onError={(paymentError) => console.error(paymentError)}
          />
        )}
        {stage === "complete" && (
          <CompletionPanel result={paymentResult} onReset={actions.reset} />
        )}
        {stage === "error" && (
          <ErrorPanel
            code={error?.code ?? "CHECKOUT_FAILED"}
            message={
              error?.message ??
              "The operation stopped before a verified completion."
            }
            onReset={actions.reset}
          />
        )}
      </main>
      <ScanNavigation onScan={actions.reset} />
    </>
  );
}
