import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  addEvidenceImage,
  approvePurchaseIntent,
  createPaymentSession,
  createPurchaseIntent,
  createScanFromFile,
  getCandidates,
  getOffers,
  getPaymentStatus,
  getScan,
  watchScan,
} from "../api/client";
import type {
  Candidate,
  EmbeddedPaymentSession,
  Offer,
  PublicPaymentResult,
  ScanRecord,
} from "../api/types";

export type ScanStage =
  | "idle"
  | "uploading"
  | "inspecting"
  | "more_evidence"
  | "ambiguous"
  | "result"
  | "authority"
  | "payment"
  | "checkout"
  | "complete"
  | "error";

interface State {
  stage: ScanStage;
  scan: ScanRecord | null;
  candidate: Candidate | null;
  offers: Offer[];
  selectedOffer: Offer | null;
  purchaseIntentId: string | null;
  paymentSession: EmbeddedPaymentSession | null;
  paymentResult: PublicPaymentResult | null;
  error: { code: string; message: string } | null;
}

type Action =
  | { type: "stage"; stage: ScanStage }
  | { type: "scan"; scan: ScanRecord; stage?: ScanStage }
  | {
      type: "result";
      scan: ScanRecord;
      candidate: Candidate;
      offers: Offer[];
      selectedOffer: Offer | null;
    }
  | { type: "intent"; purchaseIntentId: string }
  | { type: "payment"; session: EmbeddedPaymentSession }
  | { type: "payment-result"; result: PublicPaymentResult; stage: ScanStage }
  | { type: "error"; error: unknown }
  | { type: "reset" };

const initialState: State = {
  stage: "idle",
  scan: null,
  candidate: null,
  offers: [],
  selectedOffer: null,
  purchaseIntentId: null,
  paymentSession: null,
  paymentResult: null,
  error: null,
};

function errorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return {
      code: "code" in error ? String(error.code) : "REQUEST_FAILED",
      message: error.message,
    };
  }
  return {
    code: "REQUEST_FAILED",
    message: "The request could not be completed.",
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "stage":
      return { ...state, stage: action.stage, error: null };
    case "scan":
      return {
        ...state,
        scan: action.scan,
        error:
          action.scan.errorCode && action.scan.status !== "OFFERS_READY"
            ? {
                code: action.scan.errorCode,
                message:
                  action.scan.errorMessage ??
                  "The inspection stopped before it could be verified.",
              }
            : state.error,
        ...(action.stage ? { stage: action.stage } : {}),
      };
    case "result":
      return {
        ...state,
        stage: "result",
        scan: action.scan,
        candidate: action.candidate,
        offers: action.offers,
        selectedOffer: action.selectedOffer,
        error: null,
      };
    case "intent":
      return {
        ...state,
        stage: "authority",
        purchaseIntentId: action.purchaseIntentId,
      };
    case "payment":
      return { ...state, stage: "payment", paymentSession: action.session };
    case "payment-result":
      return { ...state, stage: action.stage, paymentResult: action.result };
    case "error":
      return { ...state, stage: "error", error: errorDetails(action.error) };
    case "reset":
      return initialState;
  }
}

function stageForScan(scan: ScanRecord): ScanStage {
  if (scan.errorCode && scan.status !== "OFFERS_READY") return "error";
  if (scan.status === "REQUIRES_MORE_EVIDENCE") return "more_evidence";
  if (scan.status === "AMBIGUOUS" || scan.status === "SIMILAR_FOUND")
    return "ambiguous";
  if (scan.status === "OFFERS_READY") return "result";
  if (scan.status === "ORDER_COMPLETED") return "complete";
  if (scan.status === "CHECKOUT_FAILED") return "error";
  return "inspecting";
}

export function useScanFlow() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const streamAbort = useRef<AbortController | null>(null);
  const paymentAbort = useRef<AbortController | null>(null);

  const hydrateResult = useCallback(async (scan: ScanRecord) => {
    if (!scan.selectedProductId)
      throw new Error("The verified product record is missing.");
    const [candidateResponse, offerResponse] = await Promise.all([
      getCandidates(scan.id),
      getOffers(scan.id, scan.selectedProductId),
    ]);
    const candidate =
      candidateResponse.candidates.find(
        (item) => item.id === scan.selectedProductId,
      ) ?? candidateResponse.candidates[0];
    if (!candidate)
      throw new Error("The verified catalogue record is unavailable.");
    const selectedOffer =
      offerResponse.offers.find(
        (offer) =>
          !offer.illustrative &&
          offer.identityVerification.status === "verified" &&
          offer.rejectedReasons.length === 0,
      ) ?? null;
    dispatch({
      type: "result",
      scan,
      candidate,
      offers: offerResponse.offers,
      selectedOffer,
    });
  }, []);

  const followScan = useCallback(
    async (scanId: string) => {
      streamAbort.current?.abort();
      const controller = new AbortController();
      streamAbort.current = controller;
      let latest: ScanRecord | null = null;
      try {
        await watchScan(scanId, controller.signal, (scan) => {
          latest = scan;
          dispatch({ type: "scan", scan, stage: stageForScan(scan) });
        });
        const settled: ScanRecord = latest ?? (await getScan(scanId));
        if (settled.status === "OFFERS_READY") await hydrateResult(settled);
      } catch (error) {
        if (!controller.signal.aborted) dispatch({ type: "error", error });
      }
    },
    [hydrateResult],
  );

  const startScan = useCallback(
    async (file: File) => {
      dispatch({ type: "stage", stage: "uploading" });
      try {
        const result = await createScanFromFile(file);
        dispatch({ type: "stage", stage: "inspecting" });
        await followScan(result.scanId);
      } catch (error) {
        dispatch({ type: "error", error });
      }
    },
    [followScan],
  );

  const addEvidence = useCallback(
    async (file: File) => {
      if (!state.scan) return;
      dispatch({ type: "stage", stage: "uploading" });
      try {
        const role =
          state.scan.nextCapture?.captureType === "barcode"
            ? "barcode"
            : "label";
        await addEvidenceImage(state.scan.id, file, role);
        dispatch({ type: "stage", stage: "inspecting" });
        await followScan(state.scan.id);
      } catch (error) {
        dispatch({ type: "error", error });
      }
    },
    [followScan, state.scan],
  );

  const requestAuthority = useCallback(async () => {
    if (!state.scan?.selectedProductId || !state.selectedOffer) return;
    try {
      const intent = await createPurchaseIntent({
        scanId: state.scan.id,
        productId: state.scan.selectedProductId,
        offerId: state.selectedOffer.id,
        maximumAuthorizedTotalMinor:
          state.selectedOffer.price.estimatedTotalMinor,
        currency: state.selectedOffer.price.currency,
      });
      dispatch({ type: "intent", purchaseIntentId: intent.id });
    } catch (error) {
      dispatch({ type: "error", error });
    }
  }, [state.scan, state.selectedOffer]);

  const approveWithPrava = useCallback(async () => {
    if (!state.purchaseIntentId) return;
    try {
      await approvePurchaseIntent(state.purchaseIntentId);
      const session = await createPaymentSession(state.purchaseIntentId);
      dispatch({ type: "payment", session });
    } catch (error) {
      dispatch({ type: "error", error });
    }
  }, [state.purchaseIntentId]);

  const pollPayment = useCallback(async () => {
    if (!state.paymentSession) return;
    paymentAbort.current?.abort();
    const controller = new AbortController();
    paymentAbort.current = controller;
    dispatch({ type: "stage", stage: "checkout" });
    try {
      for (
        let attempt = 0;
        attempt < 90 && !controller.signal.aborted;
        attempt += 1
      ) {
        const result = await getPaymentStatus(
          state.paymentSession.paymentSessionId,
        );
        if (result.checkoutIssue) {
          throw Object.assign(new Error(result.checkoutIssue.message), {
            code: result.checkoutIssue.code,
          });
        }
        if (result.status === "completed") {
          dispatch({ type: "payment-result", result, stage: "complete" });
          return;
        }
        if (result.status === "failed") {
          dispatch({ type: "payment-result", result, stage: "error" });
          return;
        }
        dispatch({ type: "payment-result", result, stage: "checkout" });
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      if (!controller.signal.aborted)
        throw new Error(
          "Checkout confirmation is taking longer than expected.",
        );
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "error", error });
    }
  }, [state.paymentSession]);

  useEffect(
    () => () => {
      streamAbort.current?.abort();
      paymentAbort.current?.abort();
    },
    [],
  );

  return {
    state,
    actions: {
      startScan,
      addEvidence,
      requestAuthority,
      approveWithPrava,
      pollPayment,
      reset: () => dispatch({ type: "reset" }),
    },
  };
}
