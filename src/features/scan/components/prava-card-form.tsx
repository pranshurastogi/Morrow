import { useCallback, useEffect, useRef, useState } from "react";
import {
  PravaSDK,
  type CardValidationState,
  type PravaError,
} from "@prava-sdk/core";
import { Check, Fingerprint, ShieldCheck } from "lucide-react";
import { publicEnvironment } from "@/config/public-env";
import type { PravaClientIssue, PravaCollectionSession } from "../api/types";
import { createPravaClientIssue } from "../lib/prava-security";

type SecureFormPhase = "opening" | "ready" | "details_ready" | "approved";

const phaseCopy: Record<SecureFormPhase, { title: string; detail: string }> = {
  opening: {
    title: "Opening secure surface",
    detail: "Establishing an isolated Prava session.",
  },
  ready: {
    title: "Secure form ready",
    detail: "Card details remain inside Prava.",
  },
  details_ready: {
    title: "Device approval next",
    detail: "Continue inside Prava, then approve the device prompt.",
  },
  approved: {
    title: "Approval received",
    detail: "Morrow is checking the server-side result.",
  },
};

function PhaseIcon({ phase }: { phase: SecureFormPhase }) {
  if (phase === "approved") return <Check aria-hidden />;
  if (phase === "details_ready") return <Fingerprint aria-hidden />;
  return <ShieldCheck aria-hidden />;
}

export function PravaCardForm({
  session,
  onSuccess,
  onError,
  onIssue,
}: {
  session: PravaCollectionSession;
  onSuccess: () => void;
  onError?: (error: Error) => void;
  onIssue?: (issue: PravaClientIssue) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const sdk = useRef<PravaSDK | null>(null);
  const mounted = useRef(false);
  const issueHandled = useRef(false);
  const successHandled = useRef(false);
  const readyTimeout = useRef<number | null>(null);
  const frameObserver = useRef<MutationObserver | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onIssueRef = useRef(onIssue);
  const [phase, setPhase] = useState<SecureFormPhase>("opening");

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onIssueRef.current = onIssue;
  }, [onError, onIssue, onSuccess]);

  const clearWatchers = useCallback(() => {
    if (readyTimeout.current !== null) {
      window.clearTimeout(readyTimeout.current);
      readyTimeout.current = null;
    }
    frameObserver.current?.disconnect();
    frameObserver.current = null;
  }, []);

  const markReady = useCallback(() => {
    clearWatchers();
    setPhase((current) =>
      current === "details_ready" || current === "approved" ? current : "ready",
    );
  }, [clearWatchers]);

  const reportIssue = useCallback(
    async (
      event: PravaClientIssue["event"],
      error: unknown,
      message?: string,
    ) => {
      if (issueHandled.current || successHandled.current) return;
      issueHandled.current = true;
      clearWatchers();
      const issue = await createPravaClientIssue({
        event,
        error,
        ...(message ? { message } : {}),
      });
      onIssueRef.current?.(issue);
      onErrorRef.current?.(
        Object.assign(new Error(issue.message), {
          code: issue.code,
        }),
      );
    },
    [clearWatchers],
  );

  const reportSuccess = useCallback(() => {
    if (successHandled.current) return;
    successHandled.current = true;
    clearWatchers();
    setPhase("approved");
    onSuccessRef.current();
  }, [clearWatchers]);

  const mount = useCallback(async () => {
    issueHandled.current = false;
    successHandled.current = false;
    if (!publicEnvironment.pravaPublishableKey.startsWith("pk_")) {
      await reportIssue(
        "SDK_ERROR",
        Object.assign(
          new Error("The Prava publishable key is not configured."),
          { code: "INVALID_CONFIG" },
        ),
      );
      return;
    }
    if (!container.current) return;
    clearWatchers();
    setPhase("opening");
    sdk.current?.destroy();
    try {
      sdk.current = new PravaSDK({
        publishableKey: publicEnvironment.pravaPublishableKey,
      });
      readyTimeout.current = window.setTimeout(() => {
        void reportIssue(
          "SDK_ERROR",
          Object.assign(
            new Error("Prava's secure form took too long to open."),
            { code: "IFRAME_LOAD_TIMEOUT" },
          ),
        );
      }, 30_000);
      frameObserver.current = new MutationObserver(() => {
        const frame = container.current?.querySelector("iframe");
        if (frame) frame.addEventListener("load", markReady, { once: true });
      });
      frameObserver.current.observe(container.current, {
        childList: true,
        subtree: true,
      });
      await sdk.current.collectPAN({
        sessionToken: session.sessionToken,
        iframeUrl: session.iframeUrl,
        container: container.current,
        onReady: markReady,
        onChange: (state: CardValidationState) => {
          setPhase(state.isComplete ? "details_ready" : "ready");
        },
        onSuccess: reportSuccess,
        onError: (error: PravaError) => {
          void reportIssue("SDK_ERROR", error);
        },
        onDismiss: ({ reason }) => {
          const message = reason
            ? `Prava approval was dismissed: ${reason}`
            : "Prava approval was dismissed.";
          void reportIssue(
            "SDK_DISMISSED",
            { code: "SDK_DISMISSED", message },
            message,
          );
        },
      });
      reportSuccess();
    } catch (error) {
      await reportIssue("SDK_ERROR", error);
    }
  }, [
    clearWatchers,
    markReady,
    reportIssue,
    reportSuccess,
    session.iframeUrl,
    session.sessionToken,
  ]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      void mount();
    }
    return () => {
      clearWatchers();
      sdk.current?.destroy();
      sdk.current = null;
      mounted.current = false;
    };
  }, [clearWatchers, mount]);

  const copy = phaseCopy[phase];
  const active = phase === "opening" || phase === "details_ready";

  return (
    <div className="prava-form-shell" data-phase={phase}>
      <div
        className="prava-secure-status"
        data-active={active ? "true" : "false"}
        role="status"
        aria-live="polite"
      >
        <span className="prava-status-dial" aria-hidden>
          <PhaseIcon phase={phase} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{copy.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {copy.detail}
          </span>
        </span>
      </div>
      <div
        className="prava-progress-rule"
        data-active={active ? "true" : "false"}
        aria-hidden
      />
      <div
        ref={container}
        className={`min-h-[400px] overflow-hidden ${
          phase === "approved" ? "hidden" : ""
        }`}
        aria-label="Prava secure card approval"
      />
      {phase === "approved" && (
        <div
          className="prava-approved-receipt"
          role="status"
          aria-live="polite"
        >
          <span className="prava-approved-seal" aria-hidden>
            <Check />
          </span>
          <p className="mt-4 font-medium">Device approval received.</p>
          <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
            The secure surface is closed. Morrow is reading the durable Prava
            session status now.
          </p>
        </div>
      )}
    </div>
  );
}
