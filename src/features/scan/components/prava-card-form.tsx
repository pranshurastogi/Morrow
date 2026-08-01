import { useCallback, useEffect, useRef, useState } from "react";
import {
  PravaSDK,
  type CardValidationState,
  type PravaError,
} from "@prava-sdk/core";
import { publicEnvironment } from "@/config/public-env";
import type { PravaCollectionSession } from "../api/types";

export function PravaCardForm({
  session,
  onSuccess,
  onError,
}: {
  session: PravaCollectionSession;
  onSuccess: () => void;
  onError: (error: Error) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const sdk = useRef<PravaSDK | null>(null);
  const mounted = useRef(false);
  const observer = useRef<MutationObserver | null>(null);
  const readyTimeout = useRef<number | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onError, onSuccess]);

  const clearWatchers = useCallback(() => {
    observer.current?.disconnect();
    observer.current = null;
    if (readyTimeout.current !== null) {
      window.clearTimeout(readyTimeout.current);
      readyTimeout.current = null;
    }
  }, []);

  const markReady = useCallback(() => {
    clearWatchers();
    setReady(true);
  }, [clearWatchers]);

  const mount = useCallback(async () => {
    if (!publicEnvironment.pravaPublishableKey) {
      onErrorRef.current(
        new Error("VITE_PRAVA_PUBLISHABLE_KEY is not configured."),
      );
      return;
    }
    if (!container.current) return;
    clearWatchers();
    setReady(false);
    setComplete(false);
    setMessage(null);
    sdk.current?.destroy();
    sdk.current = new PravaSDK({
      publishableKey: publicEnvironment.pravaPublishableKey,
    });
    observer.current = new MutationObserver(() => {
      if (container.current?.querySelector("iframe")) {
        markReady();
      }
    });
    observer.current.observe(container.current, {
      childList: true,
      subtree: true,
    });
    readyTimeout.current = window.setTimeout(() => {
      if (container.current?.querySelector("iframe")) {
        markReady();
        return;
      }
      const error = new Error(
        "Prava's secure form took too long to open. Please try again.",
      );
      setMessage(error.message);
      onErrorRef.current(error);
    }, 12_000);
    try {
      await sdk.current.collectPAN({
        sessionToken: session.sessionToken,
        iframeUrl: session.iframeUrl,
        container: container.current,
        onReady: markReady,
        onChange: (state: CardValidationState) => {
          setComplete(state.isComplete);
        },
        onSuccess: () => onSuccessRef.current(),
        onError: (error: PravaError) => {
          clearWatchers();
          setMessage(error.message);
          onErrorRef.current(new Error(error.message));
        },
        onDismiss: ({ reason }) => {
          clearWatchers();
          const error = new Error(
            reason
              ? `Prava approval was dismissed: ${reason}`
              : "Prava approval was dismissed.",
          );
          setMessage(error.message);
          onErrorRef.current(error);
        },
      });
    } catch (error) {
      clearWatchers();
      const caught =
        error instanceof Error
          ? error
          : new Error("Prava could not open the approval form.");
      setMessage(caught.message);
      onErrorRef.current(caught);
    }
  }, [clearWatchers, markReady, session.iframeUrl, session.sessionToken]);

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

  return (
    <div>
      {!ready && !message && (
        <p
          className="py-8 text-center font-mono text-xs text-muted-foreground"
          role="status"
        >
          Opening Prava's secure approval surface…
        </p>
      )}
      {message && (
        <div
          className="mb-3 border border-postal/50 bg-postal/5 p-3 text-sm text-postal"
          role="alert"
        >
          {message}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => void mount()}
          >
            Try again
          </button>
        </div>
      )}
      <div
        ref={container}
        className="min-h-[400px] overflow-hidden"
        aria-label="Prava secure card approval"
      />
      {ready && (
        <p
          className="border-t border-border px-2 pt-3 font-mono text-[10px] text-muted-foreground"
          role="status"
        >
          {complete
            ? "Card details valid · finish inside Prava"
            : "Secure form ready · details remain with Prava"}
        </p>
      )}
    </div>
  );
}
