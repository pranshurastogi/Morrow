import OpenAI from "openai";
import type { Sql } from "postgres";
import { createHash } from "node:crypto";
import { getEnvironment } from "../../config/env";
import {
  normalizedSizeSchema,
  type ProductObservation,
} from "../../domain/product-observation";
import type {
  CandidateVerification,
  CanonicalProductCandidate,
} from "../matching/verification";
import {
  normalizeBarcode,
  normalizeIdentifier,
} from "../recognition/normalization";
import { getDatabase } from "../../infrastructure/database/client";
import { rememberJson } from "../../infrastructure/cache/json-cache";

function productSearchText(observation: ProductObservation): string {
  return [
    observation.brand,
    observation.productName,
    observation.modelNumber,
    observation.partNumber,
    observation.variant,
    observation.category,
    observation.subcategory,
    ...observation.colors,
    ...observation.materials,
    ...observation.distinctiveFeatures,
    observation.visualFingerprint,
    observation.size
      ? `${observation.size.value} ${observation.size.unit}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function identifierValues(observation: ProductObservation): string[] {
  const identifiers = observation.visibleIdentifiers
    .map((identifier) =>
      identifier.type === "barcode"
        ? normalizeBarcode(identifier.value)
        : normalizeIdentifier(identifier.value),
    )
    .filter((value): value is string => Boolean(value));
  if (observation.modelNumber)
    identifiers.push(normalizeIdentifier(observation.modelNumber));
  if (observation.partNumber)
    identifiers.push(normalizeIdentifier(observation.partNumber));
  return [...new Set(identifiers)];
}

function mapCandidate(
  row: Record<string, unknown>,
  overrides: Partial<
    Pick<
      CanonicalProductCandidate,
      "retrievalScore" | "imageSimilarity" | "historyMatch"
    >
  > = {},
): CanonicalProductCandidate {
  const size =
    row.size_value !== null && row.size_unit !== null
      ? normalizedSizeSchema.safeParse({
          value: Number(row.size_value),
          unit: row.size_unit,
        })
      : null;
  return {
    id: String(row.id),
    category: String(row.category),
    brand: row.brand === null ? null : String(row.brand),
    name: String(row.name),
    variant: row.variant === null ? null : String(row.variant),
    size: size?.success ? size.data : null,
    gtin: row.gtin === null ? null : String(row.gtin),
    upc: row.upc === null ? null : String(row.upc),
    ean: row.ean === null ? null : String(row.ean),
    mpn: row.mpn === null ? null : String(row.mpn),
    modelNumber: row.model_number === null ? null : String(row.model_number),
    attributes: (row.attributes as Record<string, unknown>) ?? {},
    retrievalScore:
      overrides.retrievalScore ?? Number(row.retrieval_score ?? 0),
    imageSimilarity:
      overrides.imageSimilarity ?? Number(row.image_similarity ?? 0),
    historyMatch: overrides.historyMatch ?? Boolean(row.history_match),
  };
}

async function createEmbedding(text: string): Promise<number[] | null> {
  const env = getEnvironment();
  if (!env.OPENAI_API_KEY || !text) return null;
  const normalizedText = text.slice(0, 8_000);
  const digest = createHash("sha256")
    .update(`${env.OPENAI_EMBEDDING_MODEL}:${normalizedText}`)
    .digest("hex");
  return rememberJson(`embedding:${digest}`, 30 * 86_400, async () => {
    const response = await new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      maxRetries: 2,
    }).embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: normalizedText,
      encoding_format: "float",
    });
    return response.data[0]?.embedding ?? null;
  });
}

export async function retrieveCandidates(
  input: { observation: ProductObservation; userId: string },
  sql: Sql = getDatabase(),
): Promise<CanonicalProductCandidate[]> {
  const identifiers = identifierValues(input.observation);
  const query = productSearchText(input.observation);
  const embeddingPromise = createEmbedding(query);

  const identifierPromise = identifiers.length
    ? sql`
        select *, 1::float as retrieval_score from canonical_products
        where gtin in ${sql(identifiers)} or upc in ${sql(identifiers)} or ean in ${sql(identifiers)}
          or upper(regexp_replace(coalesce(mpn, ''), '[^A-Za-z0-9]', '', 'g')) in ${sql(identifiers)}
          or upper(regexp_replace(coalesce(model_number, ''), '[^A-Za-z0-9]', '', 'g')) in ${sql(identifiers)}
        limit 20
      `
    : Promise.resolve([]);
  const textPromise = query
    ? sql`
        select *, ts_rank(search_vector, websearch_to_tsquery('simple', ${query}))::float as retrieval_score
        from canonical_products
        where search_vector @@ websearch_to_tsquery('simple', ${query})
        order by retrieval_score desc limit 30
      `
    : Promise.resolve([]);
  const historyPromise = sql`
    select cp.*, true as history_match, 0.8::float as retrieval_score
    from user_product_confirmations upc
    join canonical_products cp on cp.id = upc.product_id
    where upc.user_id = ${input.userId}
    order by upc.created_at desc limit 20
  `;

  const [identifierRows, textRows, historyRows, embedding] = await Promise.all([
    identifierPromise,
    textPromise,
    historyPromise,
    embeddingPromise,
  ]);
  const vectorRows = embedding
    ? await sql`
        select *, (1 - (text_embedding <=> ${`[${embedding.join(",")}]`}::vector))::float as retrieval_score
        from canonical_products where text_embedding is not null
        order by text_embedding <=> ${`[${embedding.join(",")}]`}::vector limit 30
      `
    : [];

  const candidates = new Map<string, CanonicalProductCandidate>();
  const ingest = (
    rows: Iterable<Record<string, unknown>>,
    sourceWeight: number,
    historyMatch = false,
  ) => {
    for (const row of rows) {
      const id = String(row.id);
      const rawScore = Math.max(
        0,
        Math.min(1, Number(row.retrieval_score ?? 0)),
      );
      const previous = candidates.get(id);
      const score = Math.max(
        previous?.retrievalScore ?? 0,
        rawScore * sourceWeight,
      );
      candidates.set(
        id,
        mapCandidate(row, {
          retrievalScore: score,
          imageSimilarity: previous?.imageSimilarity ?? 0,
          historyMatch: historyMatch || previous?.historyMatch || false,
        }),
      );
    }
  };
  ingest(identifierRows, 1);
  ingest(textRows, 0.72);
  ingest(vectorRows, 0.62);
  ingest(historyRows, 0.8, true);

  return [...candidates.values()]
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, 10);
}

export async function saveCandidateVerifications(
  scanId: string,
  candidates: CanonicalProductCandidate[],
  verifications: CandidateVerification[],
  sql: Sql = getDatabase(),
): Promise<void> {
  const byId = new Map(
    verifications.map((verification) => [
      verification.candidateId,
      verification,
    ]),
  );
  await sql.begin(async (transaction) => {
    await transaction`delete from scan_candidates where scan_id = ${scanId}`;
    for (const [index, candidate] of candidates.entries()) {
      const verification = byId.get(candidate.id);
      if (!verification) continue;
      await transaction`
        insert into scan_candidates (
          scan_id, product_id, retrieval_score, identifier_score, text_score, image_score,
          history_score, identity_score, purchase_score, classification, matched_evidence,
          contradictions, rank
        ) values (
          ${scanId}, ${candidate.id}, ${candidate.retrievalScore}, 0, 0, ${candidate.imageSimilarity},
          ${candidate.historyMatch ? 1 : 0}, ${verification.identityScore}, ${verification.purchaseScore},
          ${verification.classification}, ${transaction.json(verification.matchedEvidence)},
          ${transaction.json(verification.contradictions)}, ${index + 1}
        )
      `;
    }
  });
}

export async function listCandidatesForUser(
  scanId: string,
  userId: string,
  sql: Sql = getDatabase(),
) {
  return sql`
    select sc.rank, sc.retrieval_score, sc.identity_score, sc.purchase_score, sc.classification,
      sc.matched_evidence, sc.contradictions, cp.id, cp.brand, cp.name, cp.variant,
      cp.size_value, cp.size_unit, cp.gtin, cp.model_number, cp.mpn
    from scan_candidates sc
    join scans s on s.id = sc.scan_id
    join canonical_products cp on cp.id = sc.product_id
    where sc.scan_id = ${scanId} and s.user_id = ${userId}
    order by sc.rank
  `;
}
