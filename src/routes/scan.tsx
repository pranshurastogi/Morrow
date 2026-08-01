import { createFileRoute } from "@tanstack/react-router";
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
    <div className="min-h-screen bg-background pb-20">
      <ScanHeader />
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
    </div>
  );
}
