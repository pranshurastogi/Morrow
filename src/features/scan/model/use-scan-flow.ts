import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  ApiError,
  addEvidenceImage,
  approvePurchaseIntent,
  createPaymentSession,
  createPurchaseIntent,
  createSandboxApprovalCheck,
  createScanFromFile,
  confirmProduct,
  getCandidates,
  getOffers,
  getPaymentStatus,
  getSandboxApprovalStatus,
  getScan,
  recordSandboxApprovalClientIssue,
  refreshOffers,
  retryScan,
  watchScan,
} from "../api/client";
import type {
  Candidate,
  CheckoutCapability,
  EmbeddedPaymentSession,
  Offer,
  PravaClientIssue,
  PublicPaymentResult,
  SandboxApprovalResult,
  SandboxApprovalSession,
  ScanRecord,
} from "../api/types";
import { createPravaClientIssue } from "../lib/prava-security";

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
  | "sandbox_payment"
  | "sandbox_closing"
  | "sandbox_complete"
  | "complete"
  | "error";

interface DisplayError {
  code: string;
  message: string;
  reference?: string;
}

interface State {
  stage: ScanStage;
  previewUrl: string | null;
  scan: ScanRecord | null;
  candidate: Candidate | null;
  candidates: Candidate[];
  offers: Offer[];
  checkoutCapability: CheckoutCapability | null;
  selectedOffer: Offer | null;
  purchaseIntentId: string | null;
  paymentSession: EmbeddedPaymentSession | null;
  paymentResult: PublicPaymentResult | null;
  sandboxSession: SandboxApprovalSession | null;
  sandboxResult: SandboxApprovalResult | null;
  sandboxIssue: PravaClientIssue | null;
  sandboxStartError: DisplayError | null;
  sandboxRestarting: boolean;
  offerRefreshing: boolean;
  offerRefreshMessage: string | null;
  error: DisplayError | null;
}

type Action =
  | { type: "stage"; stage: ScanStage }
  | { type: "preview"; previewUrl: string }
  | { type: "scan"; scan: ScanRecord; stage?: ScanStage }
  | {
      type: "result";
      scan: ScanRecord;
      candidate: Candidate;
      offers: Offer[];
      selectedOffer: Offer | null;
      checkoutCapability: CheckoutCapability;
    }
  | { type: "review"; scan: ScanRecord; candidates: Candidate[] }
  | { type: "intent"; purchaseIntentId: string }
  | { type: "select-offer"; offer: Offer }
  | { type: "payment"; session: EmbeddedPaymentSession }
  | { type: "payment-result"; result: PublicPaymentResult; stage: ScanStage }
  | {
      type: "payment-failed";
      result: PublicPaymentResult;
      error: { code: string; message: string };
    }
  | { type: "sandbox-payment"; session: SandboxApprovalSession }
  | { type: "sandbox-issue"; issue: PravaClientIssue }
  | {
      type: "sandbox-start-failed";
      error: DisplayError;
    }
  | { type: "sandbox-restarting"; restarting: boolean }
  | { type: "offer-refreshing" }
  | {
      type: "offers-refreshed";
      offers: Offer[];
      selectedOffer: Offer | null;
      checkoutCapability: CheckoutCapability;
      message: string;
    }
  | { type: "offer-refresh-failed"; message: string }
  | {
      type: "sandbox-result";
      result: SandboxApprovalResult;
      stage: ScanStage;
    }
  | { type: "error"; error: unknown }
  | { type: "reset" };

const initialState: State = {
  stage: "idle",
  previewUrl: null,
  scan: null,
  candidate: null,
  candidates: [],
  offers: [],
  checkoutCapability: null,
  selectedOffer: null,
  purchaseIntentId: null,
  paymentSession: null,
  paymentResult: null,
  sandboxSession: null,
  sandboxResult: null,
  sandboxIssue: null,
  sandboxStartError: null,
  sandboxRestarting: false,
  offerRefreshing: false,
  offerRefreshMessage: null,
  error: null,
};

function errorDetails(error: unknown): DisplayError {
  if (error instanceof Error) {
    const providerReference =
      error instanceof ApiError &&
      typeof error.details?.["responseId"] === "string"
        ? error.details["responseId"]
        : null;
    const requestReference = error instanceof ApiError ? error.requestId : null;
    const reference = providerReference ?? requestReference;
    return {
      code: "code" in error ? String(error.code) : "REQUEST_FAILED",
      message: error.message,
      ...(reference ? { reference } : {}),
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
    case "preview":
      return { ...state, previewUrl: action.previewUrl };
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
        candidates: [action.candidate],
        offers: action.offers,
        selectedOffer: action.selectedOffer,
        checkoutCapability: action.checkoutCapability,
        sandboxStartError: null,
        offerRefreshing: false,
        offerRefreshMessage: null,
        error: null,
      };
    case "review":
      return {
        ...state,
        stage: "ambiguous",
        scan: action.scan,
        candidates: action.candidates,
        candidate:
          action.candidates.find(
            (candidate) => candidate.id === action.scan.selectedProductId,
          ) ?? null,
        error: null,
      };
    case "intent":
      return {
        ...state,
        stage: "authority",
        purchaseIntentId: action.purchaseIntentId,
      };
    case "select-offer":
      return {
        ...state,
        selectedOffer: action.offer,
        sandboxStartError: null,
      };
    case "payment":
      return { ...state, stage: "payment", paymentSession: action.session };
    case "payment-result":
      return { ...state, stage: action.stage, paymentResult: action.result };
    case "payment-failed":
      return {
        ...state,
        stage: "error",
        paymentResult: action.result,
        error: action.error,
      };
    case "sandbox-payment":
      return {
        ...state,
        stage: "sandbox_payment",
        sandboxSession: action.session,
        sandboxResult: null,
        sandboxIssue: null,
        sandboxStartError: null,
        sandboxRestarting: false,
      };
    case "sandbox-issue":
      return {
        ...state,
        sandboxIssue: action.issue,
        sandboxRestarting: false,
      };
    case "sandbox-start-failed":
      return {
        ...state,
        stage: "result",
        sandboxStartError: action.error,
        sandboxRestarting: false,
        error: null,
      };
    case "sandbox-restarting":
      return {
        ...state,
        sandboxRestarting: action.restarting,
        ...(action.restarting ? { sandboxStartError: null } : {}),
      };
    case "offer-refreshing":
      return {
        ...state,
        offerRefreshing: true,
        offerRefreshMessage: null,
      };
    case "offers-refreshed":
      return {
        ...state,
        offers: action.offers,
        selectedOffer: action.selectedOffer,
        checkoutCapability: action.checkoutCapability,
        sandboxStartError: null,
        offerRefreshing: false,
        offerRefreshMessage: action.message,
      };
    case "offer-refresh-failed":
      return {
        ...state,
        offerRefreshing: false,
        offerRefreshMessage: action.message,
      };
    case "sandbox-result":
      return { ...state, stage: action.stage, sandboxResult: action.result };
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

function waitForPoll(signal: AbortSignal, delayMs: number): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, delayMs);
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function readPollStatus<T>(
  request: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (
        signal.aborted ||
        !(error instanceof ApiError) ||
        !error.retryable ||
        attempt === 3
      ) {
        throw error;
      }
      await waitForPoll(signal, 750 * 2 ** attempt);
    }
  }
  throw new Error("Payment status could not be read.");
}

function sessionDeadline(expiresAt: string): number {
  const providerDeadline = new Date(expiresAt).getTime();
  return Number.isFinite(providerDeadline)
    ? providerDeadline + 30_000
    : Date.now() + 15 * 60_000;
}

function paymentFailure(result: PublicPaymentResult): {
  code: string;
  message: string;
} {
  if (result.checkoutIssue) return result.checkoutIssue;
  if (result.checkoutStatus === "EXPIRED") {
    return {
      code: "PAYMENT_SESSION_EXPIRED",
      message: "The Prava approval window expired before payment completed.",
    };
  }
  if (result.checkoutStatus === "REVOKED") {
    return {
      code: "PAYMENT_SESSION_REVOKED",
      message: "The bounded Prava payment was revoked before checkout.",
    };
  }
  return {
    code: "PAYMENT_DECLINED",
    message: "Prava or the merchant declined this bounded payment.",
  };
}

export function useScanFlow(initialScanId?: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const streamAbort = useRef<AbortController | null>(null);
  const paymentAbort = useRef<AbortController | null>(null);
  const sandboxSessionPending = useRef(false);
  const paymentPollSessionId = useRef<string | null>(null);
  const sandboxPollSessionId = useRef<string | null>(null);
  const paymentSurfaceApproved = useRef(false);
  const paymentSurfaceFailed = useRef(false);
  const sandboxSurfaceApproved = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const resumedScanId = useRef<string | null>(null);

  const setPreview = useCallback((file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    dispatch({ type: "preview", previewUrl });
  }, []);

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
      checkoutCapability: offerResponse.checkout,
    });
  }, []);

  const hydrateReview = useCallback(async (scan: ScanRecord) => {
    const response = await getCandidates(scan.id);
    const candidates = response.candidates.slice(0, 4);
    dispatch({ type: "review", scan, candidates });
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
        if (
          settled.status === "SIMILAR_FOUND" ||
          settled.status === "AMBIGUOUS"
        ) {
          await hydrateReview(settled);
        }
      } catch (error) {
        if (!controller.signal.aborted) dispatch({ type: "error", error });
      }
    },
    [hydrateResult, hydrateReview],
  );

  useEffect(() => {
    if (!initialScanId || resumedScanId.current === initialScanId) return;
    resumedScanId.current = initialScanId;
    dispatch({ type: "stage", stage: "inspecting" });
    void followScan(initialScanId);
  }, [followScan, initialScanId]);

  const startScan = useCallback(
    async (file: File) => {
      setPreview(file);
      dispatch({ type: "stage", stage: "uploading" });
      try {
        const result = await createScanFromFile(file);
        dispatch({ type: "stage", stage: "inspecting" });
        await followScan(result.scanId);
      } catch (error) {
        dispatch({ type: "error", error });
      }
    },
    [followScan, setPreview],
  );

  const addEvidence = useCallback(
    async (file: File) => {
      if (!state.scan) return;
      setPreview(file);
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
    [followScan, setPreview, state.scan],
  );

  const retryInspection = useCallback(async () => {
    if (!state.scan) return;
    dispatch({ type: "stage", stage: "inspecting" });
    try {
      await retryScan(state.scan.id);
      await followScan(state.scan.id);
    } catch (error) {
      dispatch({ type: "error", error });
    }
  }, [followScan, state.scan]);

  const refreshMerchantOffers = useCallback(async () => {
    if (!state.scan?.selectedProductId || state.offerRefreshing) return;
    dispatch({ type: "offer-refreshing" });
    try {
      const response = await refreshOffers({
        scanId: state.scan.id,
        productId: state.scan.selectedProductId,
        currency: state.scan.currency ?? "INR",
        ...(state.scan.maxBudgetMinor === null
          ? {}
          : { maxTotalMinor: state.scan.maxBudgetMinor }),
      });
      const selectedOffer =
        response.offers.find(
          (offer) =>
            !offer.illustrative &&
            offer.identityVerification.status === "verified" &&
            offer.rejectedReasons.length === 0,
        ) ?? null;
      const merchantLabel = `${response.discovery.merchantCount} ${
        response.discovery.merchantCount === 1 ? "catalogue" : "catalogues"
      }`;
      const unavailableLabel = response.discovery.failedMerchantCount
        ? `; ${response.discovery.failedMerchantCount} source${
            response.discovery.failedMerchantCount === 1 ? " was" : "s were"
          } unavailable`
        : "";
      dispatch({
        type: "offers-refreshed",
        offers: response.offers,
        selectedOffer,
        checkoutCapability: response.checkout,
        message: selectedOffer
          ? `Dispatch refreshed across ${merchantLabel} and ${response.discovery.productCount} live products.`
          : `Checked ${merchantLabel}${unavailableLabel}; no exact orderable variant is available right now.`,
      });
    } catch (error) {
      dispatch({
        type: "offer-refresh-failed",
        message:
          error instanceof Error
            ? error.message
            : "Merchant catalogues could not be refreshed.",
      });
    }
  }, [state.offerRefreshing, state.scan]);

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

  const startSandboxApproval = useCallback(async () => {
    if (
      sandboxSessionPending.current ||
      !state.scan?.selectedProductId ||
      !state.selectedOffer
    )
      return;
    sandboxSessionPending.current = true;
    paymentAbort.current?.abort();
    sandboxPollSessionId.current = null;
    sandboxSurfaceApproved.current = false;
    dispatch({ type: "sandbox-restarting", restarting: true });
    try {
      const session = await createSandboxApprovalCheck({
        scanId: state.scan.id,
        productId: state.scan.selectedProductId,
        offerId: state.selectedOffer.id,
      });
      dispatch({ type: "sandbox-payment", session });
    } catch (error) {
      if (state.sandboxSession) {
        const issue = await createPravaClientIssue({
          event: "SESSION_REFRESH_FAILED",
          error,
          message:
            error instanceof Error
              ? error.message
              : "A fresh Prava sandbox session could not be created.",
        });
        dispatch({ type: "sandbox-issue", issue });
      } else {
        dispatch({ type: "sandbox-start-failed", error: errorDetails(error) });
      }
    } finally {
      sandboxSessionPending.current = false;
      dispatch({ type: "sandbox-restarting", restarting: false });
    }
  }, [state.sandboxSession, state.scan, state.selectedOffer]);

  const recordSandboxIssue = useCallback(
    (issue: PravaClientIssue) => {
      dispatch({ type: "sandbox-issue", issue });
      if (!state.sandboxSession) return;
      void recordSandboxApprovalClientIssue(
        state.sandboxSession.sandboxCheckId,
        issue,
      ).catch(() => {
        // Approval recovery must remain available if audit delivery is offline.
      });
    },
    [state.sandboxSession],
  );

  const confirmCandidate = useCallback(
    async (productId: string) => {
      if (!state.scan) return;
      try {
        await confirmProduct(state.scan.id, productId);
        dispatch({ type: "stage", stage: "inspecting" });
        await followScan(state.scan.id);
      } catch (error) {
        dispatch({ type: "error", error });
      }
    },
    [followScan, state.scan],
  );

  const approveWithPrava = useCallback(async () => {
    if (!state.purchaseIntentId) return;
    paymentAbort.current?.abort();
    paymentPollSessionId.current = null;
    paymentSurfaceApproved.current = false;
    paymentSurfaceFailed.current = false;
    try {
      await approvePurchaseIntent(state.purchaseIntentId);
      const session = await createPaymentSession(state.purchaseIntentId);
      dispatch({ type: "payment", session });
    } catch (error) {
      dispatch({ type: "error", error });
    }
  }, [state.purchaseIntentId]);

  const pollPayment = useCallback(async () => {
    const session = state.paymentSession;
    if (!session) return;
    const sessionId = session.paymentSessionId;
    if (paymentPollSessionId.current === sessionId) return;
    paymentAbort.current?.abort();
    const controller = new AbortController();
    paymentAbort.current = controller;
    paymentPollSessionId.current = sessionId;
    let approvalObserved = paymentSurfaceApproved.current;
    let deadline = sessionDeadline(session.expiresAt);
    try {
      while (!controller.signal.aborted && Date.now() <= deadline) {
        const result = await readPollStatus(
          () => getPaymentStatus(sessionId),
          controller.signal,
        );
        if (controller.signal.aborted) return;
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
          dispatch({
            type: "payment-failed",
            result,
            error: paymentFailure(result),
          });
          return;
        }
        const serverObservedApproval =
          result.providerStatus !== "pending" ||
          result.checkoutStatus !== "PENDING";
        const nextApprovalObserved =
          approvalObserved ||
          paymentSurfaceApproved.current ||
          serverObservedApproval;
        if (!approvalObserved && nextApprovalObserved) {
          deadline = Math.max(deadline, Date.now() + 5 * 60_000);
        }
        approvalObserved = nextApprovalObserved;
        dispatch({
          type: "payment-result",
          result,
          stage: approvalObserved
            ? "checkout"
            : paymentSurfaceFailed.current
              ? "error"
              : "payment",
        });
        await waitForPoll(controller.signal, 2_000);
      }
      if (!controller.signal.aborted) {
        throw Object.assign(
          new Error(
            approvalObserved
              ? "Merchant confirmation is taking longer than expected. The payment state remains protected while Morrow checks it."
              : "The Prava approval window expired before device approval completed.",
          ),
          {
            code: approvalObserved
              ? "CHECKOUT_RESULT_UNKNOWN"
              : "PAYMENT_SESSION_EXPIRED",
          },
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "error", error });
    } finally {
      if (paymentAbort.current === controller) {
        if (paymentPollSessionId.current === sessionId) {
          paymentPollSessionId.current = null;
        }
        paymentAbort.current = null;
      }
    }
  }, [state.paymentSession]);

  const pollSandboxApproval = useCallback(async () => {
    const session = state.sandboxSession;
    if (!session) return;
    const sessionId = session.sandboxCheckId;
    if (sandboxPollSessionId.current === sessionId) return;
    paymentAbort.current?.abort();
    const controller = new AbortController();
    paymentAbort.current = controller;
    sandboxPollSessionId.current = sessionId;
    let approvalObserved = sandboxSurfaceApproved.current;
    let deadline = sessionDeadline(session.expiresAt);
    try {
      while (!controller.signal.aborted && Date.now() <= deadline) {
        const result = await readPollStatus(
          () => getSandboxApprovalStatus(sessionId),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (result.status === "verified") {
          dispatch({
            type: "sandbox-result",
            result,
            stage: "sandbox_complete",
          });
          return;
        }
        if (result.status === "failed" || result.status === "expired") {
          throw Object.assign(new Error(result.message), {
            code:
              result.status === "expired"
                ? "PAYMENT_SESSION_EXPIRED"
                : "PAYMENT_DECLINED",
          });
        }
        const nextApprovalObserved =
          approvalObserved ||
          sandboxSurfaceApproved.current ||
          result.providerStatus !== "pending" ||
          result.milestones.cardAndPasskeyApproved;
        if (!approvalObserved && nextApprovalObserved) {
          deadline = Math.max(deadline, Date.now() + 2 * 60_000);
        }
        approvalObserved = nextApprovalObserved;
        dispatch({
          type: "sandbox-result",
          result,
          stage: approvalObserved ? "sandbox_closing" : "sandbox_payment",
        });
        await waitForPoll(controller.signal, 1_500);
      }
      if (!controller.signal.aborted) {
        throw Object.assign(
          new Error(
            approvalObserved
              ? "Prava approved the sandbox session, but final confirmation is taking longer than expected."
              : "The Prava sandbox approval window expired before device approval completed.",
          ),
          {
            code: approvalObserved
              ? "CHECKOUT_RESULT_UNKNOWN"
              : "PAYMENT_SESSION_EXPIRED",
          },
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "error", error });
    } finally {
      if (paymentAbort.current === controller) {
        if (sandboxPollSessionId.current === sessionId) {
          sandboxPollSessionId.current = null;
        }
        paymentAbort.current = null;
      }
    }
  }, [state.sandboxSession]);

  const acknowledgePaymentSurface = useCallback(() => {
    paymentSurfaceApproved.current = true;
    dispatch({ type: "stage", stage: "checkout" });
  }, []);

  const acknowledgeSandboxSurface = useCallback(() => {
    sandboxSurfaceApproved.current = true;
    dispatch({ type: "stage", stage: "sandbox_closing" });
  }, []);

  const stopPaymentWithError = useCallback((error: unknown) => {
    paymentSurfaceFailed.current = true;
    dispatch({ type: "error", error });
  }, []);

  const paymentSessionId = state.paymentSession?.paymentSessionId;
  useEffect(() => {
    if (paymentSessionId) void pollPayment();
  }, [paymentSessionId, pollPayment]);

  const sandboxCheckId = state.sandboxSession?.sandboxCheckId;
  useEffect(() => {
    if (sandboxCheckId) void pollSandboxApproval();
  }, [pollSandboxApproval, sandboxCheckId]);

  const reset = useCallback(() => {
    streamAbort.current?.abort();
    paymentAbort.current?.abort();
    paymentPollSessionId.current = null;
    sandboxPollSessionId.current = null;
    paymentSurfaceApproved.current = false;
    paymentSurfaceFailed.current = false;
    sandboxSurfaceApproved.current = false;
    sandboxSessionPending.current = false;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  useEffect(
    () => () => {
      streamAbort.current?.abort();
      paymentAbort.current?.abort();
      paymentPollSessionId.current = null;
      sandboxPollSessionId.current = null;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    },
    [],
  );

  return {
    state,
    actions: {
      startScan,
      addEvidence,
      confirmCandidate,
      selectOffer: (offer: Offer) => dispatch({ type: "select-offer", offer }),
      requestAuthority,
      startSandboxApproval,
      recordSandboxIssue,
      approveWithPrava,
      pollPayment,
      pollSandboxApproval,
      acknowledgePaymentSurface,
      acknowledgeSandboxSurface,
      retryInspection,
      refreshMerchantOffers,
      stopWithError: stopPaymentWithError,
      reset,
    },
  };
}
