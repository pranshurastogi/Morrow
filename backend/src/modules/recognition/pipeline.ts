import { createHash } from "node:crypto";
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
  getSavedCandidates,
  retrieveCandidates,
  saveCandidateVerifications,
} from "../catalog/catalog-repository";
import {
  classifyCandidateSet,
  rankCandidateReferences,
  verifyCandidate,
} from "../matching/verification";
import { determineNextCapture } from "../matching/capture-policy";
import {
  isPurchasableOffer,
  searchVerifiedListings,
} from "../offers/offer-repository";
import { detectBarcode } from "./barcode";
import { derivedObjectKeys, prepareImage } from "./image-preparation";
import { observeProduct, shouldEscalateObservation } from "./openai-observer";
import { extractText } from "./ocr";
import { getEnvironment } from "../../config/env";
import { rememberJson } from "../../infrastructure/cache/json-cache";
import { compareCandidatesVisually } from "../matching/openai-candidate-verifier";
import { discoverProductCandidates } from "./candidate-discovery";

function uniqueBarcodes(
  barcodes: Awaited<ReturnType<typeof detectBarcode>>,
): Awaited<ReturnType<typeof detectBarcode>> {
  const seen = new Set<string>();
  return barcodes.filter((barcode) => {
    const key = `${barcode.format}:${barcode.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function observationViews(
  preparedImages: Array<{
    imageRecord: { role: string };
    prepared: Awaited<ReturnType<typeof prepareImage>>;
  }>,
): Array<{ image: Buffer; role: string }> {
  return preparedImages.flatMap((item) => {
    if (item.imageRecord.role === "primary") {
      return [
        { image: item.prepared.processed, role: "primary" },
        { image: item.prepared.objectCrop, role: "object_crop" },
        { image: item.prepared.labelCrop, role: "label" },
      ];
    }
    if (item.imageRecord.role === "label") {
      return [{ image: item.prepared.labelCrop, role: "label" }];
    }
    return [{ image: item.prepared.processed, role: item.imageRecord.role }];
  });
}

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
  const extractionStartedAt = Date.now();
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
          objectKey: keys.objectCrop,
          body: prepared.objectCrop,
          contentType: "image/jpeg",
          retention: "processed-7d",
        }),
        writeObject({
          objectKey: keys.labelCrop,
          body: prepared.labelCrop,
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
        rememberJson(
          `barcode:${prepared.sha256}:aligned-v2`,
          7 * 86_400,
          async () => {
            const [full, label] = await Promise.all([
              detectBarcode(prepared.processed),
              detectBarcode(prepared.labelCrop),
            ]);
            return uniqueBarcodes([...full, ...label]);
          },
        ),
        getEnvironment().OCR_ENABLED
          ? rememberJson(`ocr:${prepared.sha256}:aligned-v2`, 30 * 86_400, () =>
              extractText(prepared.ocrReady),
            )
          : Promise.resolve([]),
      ]);
      return { imageRecord, prepared, barcodes, ocr };
    }),
  );
  const barcodes = preparedImages.flatMap((item) => item.barcodes);
  const ocr = preparedImages.flatMap((item) => item.ocr);
  const preparationDurationMs = Date.now() - extractionStartedAt;
  let result = await observeProduct({
    userId: scan.userId,
    scanId: scan.id,
    images: observationViews(preparedImages),
    ocr,
    barcodes,
    mode: scan.mode,
    countryCode: scan.countryCode,
  });
  if (shouldEscalateObservation(result.observation)) {
    try {
      result = await observeProduct({
        userId: scan.userId,
        scanId: scan.id,
        images: observationViews(preparedImages),
        ocr,
        barcodes,
        mode: scan.mode,
        countryCode: scan.countryCode,
        escalate: true,
      });
    } catch (error) {
      if (toMorrowError(error).code !== "AI_BUDGET_EXCEEDED") throw error;
      await writeAuditEvent({
        userId: scan.userId,
        entityType: "scan",
        entityId: scan.id,
        eventType: "AI_ESCALATION_SKIPPED_BUDGET",
        actorType: "policy",
        payload: { retainedModel: result.model },
      });
    }
  }
  const observation = mergeDeterministicBarcodes(result.observation, barcodes);

  await clearDerivedEvidence(scanId);
  for (const item of preparedImages) {
    await addEvidence({
      scanId,
      evidenceType: "image_quality",
      value: {
        width: item.prepared.width,
        height: item.prepared.height,
        blurScore: item.prepared.blurScore,
        brightnessScore: item.prepared.brightnessScore,
        alignedViews: ["full", "object", "label"],
      },
      source: "policy",
      sourceImageId: item.imageRecord.id,
    });
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
      imageCount: preparedImages.length,
      alignedViewCount: observationViews(preparedImages).length,
      lowQualityImageCount: preparedImages.filter(
        (item) =>
          item.prepared.blurScore < 0.12 ||
          item.prepared.brightnessScore < 0.12 ||
          item.prepared.brightnessScore > 0.94,
      ).length,
      preparationDurationMs,
      observationDurationMs:
        Date.now() - extractionStartedAt - preparationDurationMs,
      totalDurationMs: Date.now() - extractionStartedAt,
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
        const discovery = await discoverProductCandidates({
          observation: scan.observation,
          userId: scan.userId,
          scanId: scan.id,
          countryCode: scan.countryCode ?? "IN",
          currency: scan.currency ?? "INR",
        });
        const candidates = discovery.candidates;
        if (discovery.liveCatalog) {
          await writeAuditEvent({
            userId: scan.userId,
            entityType: "scan",
            entityId: scan.id,
            eventType: "LIVE_CATALOG_SEARCHED",
            actorType: "provider",
            payload: {
              provider: "shopify_ucp",
              candidateCount: discovery.discoveredProductIds.length,
              productCount: discovery.liveCatalog.productCount,
              attempts: discovery.liveCatalog.attempts.length,
              successfulAttempts: discovery.liveCatalog.attempts.filter(
                (attempt) => attempt.status === "succeeded",
              ).length,
              failedAttempts: discovery.liveCatalog.attempts.filter(
                (attempt) => attempt.status === "failed",
              ).length,
              durationMs: discovery.liveCatalog.durationMs,
              visualQueryCount: discovery.liveCatalog.visualQueries.length,
              queryKinds: [
                ...new Set(
                  discovery.liveCatalog.attempts.map(
                    (attempt) => attempt.queryKind,
                  ),
                ),
              ],
              routes: [
                ...new Set(
                  discovery.liveCatalog.attempts.map(
                    (attempt) => attempt.route,
                  ),
                ),
              ],
            },
          });
        } else if (discovery.liveCatalogError) {
          await writeAuditEvent({
            userId: scan.userId,
            entityType: "scan",
            entityId: scan.id,
            eventType: "LIVE_CATALOG_UNAVAILABLE",
            actorType: "provider",
            payload: {
              provider: "shopify_ucp",
              fallbackCandidateCount: candidates.length,
            },
          });
        }
        const verifications = candidates.map((candidate) =>
          verifyCandidate(scan.observation!, candidate),
        );
        await saveCandidateVerifications(
          scanId,
          rankCandidateReferences(candidates, verifications),
          verifications,
        );
        if (candidates.length === 0) {
          await transitionScan(scanId, "REQUIRES_MORE_EVIDENCE", {
            nextCapture: capture ?? {
              captureType: "full_object",
              title: "Add another view for a closer reference",
              message:
                "Morrow has described the object, but the current catalogues returned no useful reference. A second angle may surface one.",
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
        let candidates = await getSavedCandidates(scanId);
        if (candidates.length === 0) {
          candidates = await retrieveCandidates({
            observation: scan.observation,
            userId: scan.userId,
            scanId: scan.id,
          });
        }
        const preparedImages = (await getScanImages(scanId))
          .filter((image) => Boolean(image.processedObjectKey && image.sha256))
          .slice(-4);
        const deterministicVerifications = candidates.map((candidate) =>
          verifyCandidate(scan.observation!, candidate),
        );
        const deterministicDecision = classifyCandidateSet(
          deterministicVerifications,
        );
        if (
          preparedImages.length > 0 &&
          deterministicDecision.status !== "EXACT_VERIFIED"
        ) {
          try {
            const scanImages = await Promise.all(
              preparedImages.map(async (image) => {
                const keys = derivedObjectKeys(image.objectKey);
                const [processed, aligned] = await Promise.all([
                  readObject(image.processedObjectKey!),
                  image.role === "primary"
                    ? Promise.allSettled([
                        readObject(keys.objectCrop),
                        readObject(keys.labelCrop),
                      ])
                    : Promise.resolve([]),
                ]);
                const views = [
                  {
                    image: processed,
                    role: image.role,
                    sha256: image.sha256!,
                  },
                ];
                if (image.role === "primary") {
                  if (aligned[0]?.status === "fulfilled") {
                    views.push({
                      image: aligned[0].value,
                      role: "object_crop",
                      sha256: createHash("sha256")
                        .update(aligned[0].value)
                        .digest("hex"),
                    });
                  }
                  if (aligned[1]?.status === "fulfilled") {
                    views.push({
                      image: aligned[1].value,
                      role: "label",
                      sha256: createHash("sha256")
                        .update(aligned[1].value)
                        .digest("hex"),
                    });
                  }
                }
                return views;
              }),
            );
            const visualComparison = await compareCandidatesVisually({
              userId: scan.userId,
              scanId: scan.id,
              scanImages: scanImages.flat(),
              candidates,
            });
            candidates = visualComparison.candidates;
            await writeAuditEvent({
              userId: scan.userId,
              entityType: "scan",
              entityId: scan.id,
              eventType: "VISUAL_CANDIDATES_COMPARED",
              actorType: "worker",
              payload: { ...visualComparison.report },
            });
          } catch {
            await writeAuditEvent({
              userId: scan.userId,
              entityType: "scan",
              entityId: scan.id,
              eventType: "VISUAL_COMPARISON_UNAVAILABLE",
              actorType: "worker",
              payload: { fallback: "deterministic_text_and_identifier_policy" },
            });
          }
        } else if (deterministicDecision.status === "EXACT_VERIFIED") {
          await writeAuditEvent({
            userId: scan.userId,
            entityType: "scan",
            entityId: scan.id,
            eventType: "VISUAL_COMPARISON_SKIPPED",
            actorType: "policy",
            payload: {
              reason: "exact_identifier_already_settled_identity",
              productId: deterministicDecision.selected?.candidateId,
            },
          });
        }
        const verifications = candidates.map((candidate) =>
          verifyCandidate(scan.observation!, candidate),
        );
        candidates = rankCandidateReferences(candidates, verifications);
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
        if (scan.initiationSource === "archive_repeat" && scan.observation) {
          const refreshed = await discoverProductCandidates({
            observation: scan.observation,
            userId: scan.userId,
            scanId: scan.id,
            countryCode: scan.countryCode ?? "IN",
            currency: scan.currency ?? "INR",
          });
          await writeAuditEvent({
            userId: scan.userId,
            entityType: "scan",
            entityId: scan.id,
            eventType: "ARCHIVE_REPEAT_CATALOG_REFRESHED",
            actorType: "provider",
            payload: {
              sourceScanId: scan.sourceScanId,
              discoveredProductCount:
                refreshed.liveCatalog?.productCount ??
                refreshed.discoveredProductIds.length,
              candidateCount: refreshed.candidates.length,
              liveCatalogAvailable: Boolean(refreshed.liveCatalog),
            },
          });
        }
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
        const purchasableOffers = offers.filter(isPurchasableOffer);
        const rejectionReasons = [
          ...new Set(offers.flatMap((offer) => offer.rejectedReasons)),
        ];
        await writeAuditEvent({
          userId: scan.userId,
          entityType: "scan",
          entityId: scan.id,
          eventType: "MERCHANT_OFFERS_EVALUATED",
          actorType: "policy",
          payload: {
            listingCount: offers.length,
            purchasableCount: purchasableOffers.length,
            rejectionReasons,
          },
        });
        await transitionScan(scanId, "OFFERS_READY", {
          errorCode:
            purchasableOffers.length === 0 ? "PRODUCT_NOT_AVAILABLE" : null,
          errorMessage:
            purchasableOffers.length === 0
              ? offers.length === 0
                ? "No current India merchant listing is available for the selected product."
                : "Listings were found, but no in-stock variant passed identity, currency, and budget checks."
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
