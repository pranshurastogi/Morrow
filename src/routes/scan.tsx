import { ClerkLoading, Show } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthenticationDesk } from "@/features/auth/authentication-desk";
import { AuthorityPanel } from "@/features/scan/components/authority-panel";
import { CapturePanel } from "@/features/scan/components/capture-panel";
import {
  CompletionPanel,
  ErrorPanel,
} from "@/features/scan/components/completion-panel";
import { EvidenceRequest } from "@/features/scan/components/evidence-request";
import {
  PaymentPanel,
  PaymentStatusPanel,
} from "@/features/scan/components/payment-panel";
import { ProgressPanel } from "@/features/scan/components/progress-panel";
import {
  AmbiguousPanel,
  ResultPanel,
} from "@/features/scan/components/result-panel";
import { ScanHeader } from "@/features/scan/components/scan-header";
import { ScanNavigation } from "@/features/scan/components/scan-navigation";
import {
  SandboxCheckoutPanel,
  SandboxCompletionPanel,
  SandboxStatusPanel,
} from "@/features/scan/components/sandbox-checkout-panel";
import { useScanFlow } from "@/features/scan/model/use-scan-flow";

const title = "Morrow — Object inspection";
const description =
  "Scan an object, verify the exact product, compare trusted dispatches, and approve a bounded purchase through Prava.";

export const Route = createFileRoute("/scan")({
  validateSearch: z.object({
    resumeScanId: z.string().uuid().optional(),
    purchaseIntentId: z.string().uuid().optional(),
  }),
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

function AuthenticatedScanDesk() {
  const { resumeScanId } = Route.useSearch();
  const { state, actions } = useScanFlow(resumeScanId);
  const {
    stage,
    previewUrl,
    scan,
    candidate,
    candidates,
    offers,
    selectedOffer,
    paymentSession,
    paymentResult,
    sandboxSession,
    sandboxResult,
    sandboxIssue,
    sandboxStartError,
    sandboxRestarting,
    offerRefreshing,
    offerRefreshMessage,
    checkoutCapability,
    error,
  } = state;
  const retryableInspection =
    scan !== null &&
    [
      "PREPROCESSING",
      "EVIDENCE_EXTRACTED",
      "CANDIDATES_RETRIEVED",
      "VERIFYING",
      "SEARCHING_MERCHANTS",
    ].includes(scan.status);

  return (
    <>
      <main className="mx-auto w-full max-w-[560px] px-4 py-5">
        {stage === "idle" && (
          <CapturePanel onFile={(file) => void actions.startScan(file)} />
        )}
        {(stage === "uploading" || stage === "inspecting") && (
          <ProgressPanel stage={stage} scan={scan} previewUrl={previewUrl} />
        )}
        {stage === "more_evidence" && scan && (
          <EvidenceRequest
            scan={scan}
            onFile={(file) => void actions.addEvidence(file)}
          />
        )}
        {stage === "ambiguous" && scan && (
          <AmbiguousPanel
            scan={scan}
            candidates={candidates}
            onConfirm={(productId) => void actions.confirmCandidate(productId)}
            onEvidence={(file) => void actions.addEvidence(file)}
            onReset={actions.reset}
          />
        )}
        {stage === "result" && scan && candidate && (
          <ResultPanel
            scan={scan}
            candidate={candidate}
            offers={offers}
            checkoutCapability={checkoutCapability}
            offer={selectedOffer}
            onGet={() => void actions.requestAuthority()}
            onSandboxTest={() => void actions.startSandboxApproval()}
            onSelectOffer={actions.selectOffer}
            onRefreshOffers={() => void actions.refreshMerchantOffers()}
            offerRefreshing={offerRefreshing}
            offerRefreshMessage={offerRefreshMessage}
            sandboxStartError={sandboxStartError}
            sandboxRestarting={sandboxRestarting}
            onReject={actions.reset}
          />
        )}
        {stage === "authority" && selectedOffer && (
          <AuthorityPanel
            offer={selectedOffer}
            onApprove={() => void actions.approveWithPrava()}
          />
        )}
        {stage === "payment" && paymentSession && selectedOffer && (
          <PaymentPanel
            session={paymentSession}
            offer={selectedOffer}
            onSuccess={actions.acknowledgePaymentSurface}
            onError={actions.stopWithError}
          />
        )}
        {stage === "checkout" && selectedOffer && (
          <PaymentStatusPanel offer={selectedOffer} result={paymentResult} />
        )}
        {stage === "sandbox_payment" && sandboxSession && selectedOffer && (
          <SandboxCheckoutPanel
            session={sandboxSession}
            offer={selectedOffer}
            issue={sandboxIssue}
            restarting={sandboxRestarting}
            onSuccess={actions.acknowledgeSandboxSurface}
            onIssue={actions.recordSandboxIssue}
            onRestart={() => void actions.startSandboxApproval()}
          />
        )}
        {stage === "sandbox_closing" && selectedOffer && (
          <SandboxStatusPanel offer={selectedOffer} result={sandboxResult} />
        )}
        {stage === "sandbox_complete" && selectedOffer && sandboxResult && (
          <SandboxCompletionPanel
            offer={selectedOffer}
            result={sandboxResult}
            onReset={actions.reset}
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
            {...(retryableInspection
              ? { onRetry: () => void actions.retryInspection() }
              : {})}
            onReset={actions.reset}
          />
        )}
      </main>
      <ScanNavigation onScan={actions.reset} />
    </>
  );
}
