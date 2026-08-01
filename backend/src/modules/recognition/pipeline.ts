import { toMorrowError } from "../../common/errors";
import type { ProductObservation } from "../../domain/product-observation";
import { writeAuditEvent } from "../../infrastructure/database/audit-repository";
import {
  addEvidence,
  clearDerivedEvidence,
  getScan,
  getScanImages,
  saveImagePreparation,
  setScanError,
  transitionScan,
} from "../../infrastructure/database/scan-repository";
import { readObject, writeObject } from "../../infrastructure/storage/r2";
import {
  retrieveCandidates,
  saveCandidateVerifications,
} from "../catalog/catalog-repository";
import {
  classifyCandidateSet,
  verifyCandidate,
} from "../matching/verification";
import { determineNextCapture } from "../matching/capture-policy";
import { searchVerifiedListings } from "../offers/offer-repository";
import { detectBarcode } from "./barcode";
import { derivedObjectKeys, prepareImage } from "./image-preparation";
import { observeProduct, shouldEscalateObservation } from "./openai-observer";
import { extractText } from "./ocr";
import { getEnvironment } from "../../config/env";
import { rememberJson } from "../../infrastructure/cache/json-cache";

function mergeDeterministicBarcodes(
  observation: ProductObservation,
  barcodes: Awaited<ReturnType<typeof detectBarcode>>,
): ProductObservation {
  const known = new Set(
    observation.visibleIdentifiers.map((identifier) => identifier.value),
  );
  const additions = barcodes
    .filter((barcode) => !known.has(barcode.value))
    .map((barcode) => ({
      type: "barcode" as const,
      value: barcode.value,
      evidenceBasis: "barcode_decoder" as const,
    }));
  return {
    ...observation,
    visibleIdentifiers: [...observation.visibleIdentifiers, ...additions],
  };
}

async function extractObservation(scanId: string) {
  const scan = await getScan(scanId);
  const images = await getScanImages(scanId);
  if (images.length === 0) throw new Error("Scan has no image");
  const selectedImages = images.slice(-4);
  const preparedImages = await Promise.all(
    selectedImages.map(async (imageRecord) => {
      const original = await readObject(imageRecord.objectKey);
      const prepared = await prepareImage(original);
      const keys = derivedObjectKeys(imageRecord.objectKey);
      await Promise.all([
        writeObject({
          objectKey: keys.processed,
          body: prepared.processed,
          contentType: "image/jpeg",
          retention: "processed-7d",
        }),
        writeObject({
          objectKey: keys.thumbnail,
          body: prepared.thumbnail,
          contentType: "image/webp",
          retention: "thumbnail-7d",
        }),
      ]);
      await saveImagePreparation(imageRecord.id, {
        processedObjectKey: keys.processed,
        thumbnailObjectKey: keys.thumbnail,
        width: prepared.width,
        height: prepared.height,
        blurScore: prepared.blurScore,
        brightnessScore: prepared.brightnessScore,
        sha256: prepared.sha256,
      });
      const [barcodes, ocr] = await Promise.all([
        rememberJson(`barcode:${prepared.sha256}`, 7 * 86_400, () =>
          detectBarcode(prepared.processed),
        ),
        getEnvironment().OCR_ENABLED
          ? rememberJson(`ocr:${prepared.sha256}`, 30 * 86_400, () =>
              extractText(prepared.processed),
            )
          : Promise.resolve([]),
      ]);
      return { imageRecord, prepared, barcodes, ocr };
    }),
  );
  const barcodes = preparedImages.flatMap((item) => item.barcodes);
  const ocr = preparedImages.flatMap((item) => item.ocr);
  let result = await observeProduct({
    images: preparedImages.map((item) => ({
      image: item.prepared.processed,
      role: item.imageRecord.role,
    })),
    ocr,
    barcodes,
    mode: scan.mode,
    countryCode: scan.countryCode,
  });
  if (shouldEscalateObservation(result.observation)) {
    result = await observeProduct({
      images: preparedImages.map((item) => ({
        image: item.prepared.processed,
        role: item.imageRecord.role,
      })),
      ocr,
      barcodes,
      mode: scan.mode,
      countryCode: scan.countryCode,
      escalate: true,
    });
  }
  const observation = mergeDeterministicBarcodes(result.observation, barcodes);

  await clearDerivedEvidence(scanId);
  for (const item of preparedImages) {
    for (const barcode of item.barcodes) {
      await addEvidence({
        scanId,
        evidenceType: "barcode",
        value: { format: barcode.format, value: barcode.value },
        normalizedValue: barcode.value,
        source: "barcode_decoder",
        confidence: barcode.confidence,
        sourceImageId: item.imageRecord.id,
      });
    }
    for (const block of item.ocr) {
      await addEvidence({
        scanId,
        evidenceType: "text",
        value: { text: block.text },
        normalizedValue: block.text,
        source: "ocr",
        confidence: block.confidence,
        sourceImageId: item.imageRecord.id,
      });
    }
  }
  for (const claim of observation.claims) {
    const source =
      preparedImages.find(
        (item) => item.imageRecord.role === claim.sourceImageRole,
      ) ?? preparedImages[preparedImages.length - 1];
    await addEvidence({
      scanId,
      evidenceType: claim.field,
      value: { value: claim.value, evidenceBasis: claim.evidenceBasis },
      normalizedValue: claim.value,
      source: "vision_model",
      ...(source ? { sourceImageId: source.imageRecord.id } : {}),
      modelVersion: result.model,
      promptVersion: result.promptVersion,
    });
  }
  await writeAuditEvent({
    userId: scan.userId,
    entityType: "scan",
    entityId: scan.id,
    eventType: "AI_OBSERVATION_CREATED",
    actorType: "worker",
    payload: {
      model: result.model,
      promptVersion: result.promptVersion,
      claimCount: observation.claims.length,
    },
  });
  return observation;
}

export async function processScan(scanId: string): Promise<void> {
  try {
    for (let pass = 0; pass < 10; pass += 1) {
      const scan = await getScan(scanId);
      if (scan.status === "IMAGE_UPLOADED") {
        await transitionScan(scanId, "PREPROCESSING");
        continue;
      }
      if (scan.status === "PREPROCESSING") {
        const observation = await extractObservation(scanId);
        await transitionScan(scanId, "EVIDENCE_EXTRACTED", {
          observation,
          nextCapture: null,
        });
        continue;
      }
      if (scan.status === "EVIDENCE_EXTRACTED") {
        if (!scan.observation) throw new Error("Scan observation is missing");
        const capture = determineNextCapture(scan.observation);
        if (capture && scan.mode === "exact") {
          await transitionScan(scanId, "REQUIRES_MORE_EVIDENCE", {
            nextCapture: capture,
          });
          return;
        }
        const candidates = await retrieveCandidates({
          observation: scan.observation,
          userId: scan.userId,
        });
        const verifications = candidates.map((candidate) =>
          verifyCandidate(scan.observation!, candidate),
        );
        await saveCandidateVerifications(scanId, candidates, verifications);
        if (candidates.length === 0) {
          await transitionScan(scanId, "REQUIRES_MORE_EVIDENCE", {
            nextCapture: capture ?? {
              captureType: "back_label",
              title: "Show another identifying mark",
              message:
                "No catalogue record can be verified from the current evidence.",
            },
          });
          return;
        }
        await transitionScan(scanId, "CANDIDATES_RETRIEVED");
        continue;
      }
      if (scan.status === "CANDIDATES_RETRIEVED") {
        await transitionScan(scanId, "VERIFYING");
        continue;
      }
      if (scan.status === "VERIFYING") {
        if (!scan.observation) throw new Error("Scan observation is missing");
        const candidates = await retrieveCandidates({
          observation: scan.observation,
          userId: scan.userId,
        });
        const verifications = candidates.map((candidate) =>
          verifyCandidate(scan.observation!, candidate),
        );
        await saveCandidateVerifications(scanId, candidates, verifications);
        const decision = classifyCandidateSet(verifications);
        if (decision.status === "REQUIRES_MORE_EVIDENCE") {
          await transitionScan(scanId, "AMBIGUOUS");
          return;
        }
        await transitionScan(scanId, decision.status, {
          selectedProductId: decision.selected?.candidateId ?? null,
        });
        await writeAuditEvent({
          userId: scan.userId,
          entityType: "scan",
          entityId: scan.id,
          eventType: decision.status,
          actorType: "policy",
          payload: {
            productId: decision.selected?.candidateId,
            identityScore: decision.selected?.identityScore,
            evidence: decision.selected?.matchedEvidence.map(
              (item) => item.field,
            ),
          },
        });
        if (decision.status !== "EXACT_VERIFIED") return;
        continue;
      }
      if (scan.status === "EXACT_VERIFIED") {
        await transitionScan(scanId, "SEARCHING_MERCHANTS");
        continue;
      }
      if (scan.status === "SEARCHING_MERCHANTS") {
        if (!scan.selectedProductId)
          throw new Error("Verified scan has no selected product");
        const offers = await searchVerifiedListings({
          scanId,
          productId: scan.selectedProductId,
          requirements: {
            currency: scan.currency ?? "INR",
            ...(scan.maxBudgetMinor === null
              ? {}
              : { maxTotalMinor: scan.maxBudgetMinor }),
          },
        });
        await transitionScan(scanId, "OFFERS_READY", {
          errorCode: offers.length === 0 ? "PRODUCT_NOT_AVAILABLE" : null,
          errorMessage:
            offers.length === 0
              ? "No current verified merchant offer is available"
              : null,
        });
        return;
      }
      return;
    }
    throw new Error("Scan pipeline exceeded its state-transition limit");
  } catch (error) {
    const morrowError = toMorrowError(error);
    await setScanError(scanId, {
      code: morrowError.code,
      message: morrowError.message,
    }).catch(() => undefined);
    throw error;
  }
}
