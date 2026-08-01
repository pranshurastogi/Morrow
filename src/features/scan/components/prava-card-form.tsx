import { useCallback, useEffect, useRef, useState } from "react";
import { PravaSDK, type PravaError } from "@prava-sdk/core";
import { publicEnvironment } from "@/config/public-env";
import type { EmbeddedPaymentSession } from "../api/types";

export function PravaCardForm({
  session,
  onSuccess,
  onError,
}: {
  session: EmbeddedPaymentSession;
  onSuccess: () => void;
  onError: (error: Error) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const sdk = useRef<PravaSDK | null>(null);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const mount = useCallback(async () => {
    if (!publicEnvironment.pravaPublishableKey) {
      onError(new Error("VITE_PRAVA_PUBLISHABLE_KEY is not configured."));
      return;
    }
    if (!container.current) return;
    setMessage(null);
    sdk.current?.destroy();
    sdk.current = new PravaSDK({
      publishableKey: publicEnvironment.pravaPublishableKey,
    });
    try {
      await sdk.current.collectPAN({
        sessionToken: session.sessionToken,
        iframeUrl: session.iframeUrl,
        container: container.current,
        onReady: () => setReady(true),
        onSuccess,
        onError: (error: PravaError) => {
          setMessage(error.message);
          onError(new Error(error.message));
        },
      });
    } catch (error) {
      onError(
        error instanceof Error
          ? error
          : new Error("Prava could not open the approval form."),
      );
    }
  }, [onError, onSuccess, session]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      void mount();
    }
    return () => {
      sdk.current?.destroy();
      sdk.current = null;
      mounted.current = false;
    };
  }, [mount]);

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
    </div>
  );
}
