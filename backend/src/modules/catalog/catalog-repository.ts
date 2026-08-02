import OpenAI from "openai";
import type { Sql } from "postgres";
import { createHash } from "node:crypto";
import { MorrowError } from "../../common/errors";
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
  jaccardSimilarity,
  normalizeBarcode,
  normalizeIdentifier,
  normalizeText,
  tokenize,
} from "../recognition/normalization";
import { getDatabase } from "../../infrastructure/database/client";
import { rememberJson } from "../../infrastructure/cache/json-cache";
import {
  meterOpenAiEmbedding,
  openAiSafetyIdentifier,
} from "../usage/ai-usage-repository";

export interface RetrievalRanking {
  ids: string[];
  weight: number;
}

/**
 * Score-only retrieval channels (FTS, embeddings, history, live catalogues)
 * use incomparable scales. Reciprocal-rank fusion rewards agreement between
 * them without pretending those raw scores are calibrated probabilities.
 */
export function reciprocalRankFusion(
  rankings: RetrievalRanking[],
  rankConstant = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  const activeRankings = rankings.filter(
    (ranking) => ranking.weight > 0 && ranking.ids.length > 0,
  );
  const maximum = activeRankings.reduce(
    (sum, ranking) => sum + ranking.weight / (rankConstant + 1),
    0,
  );
  if (maximum <= 0) return scores;
  for (const ranking of activeRankings) {
    const seen = new Set<string>();
    ranking.ids.forEach((id, index) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      scores.set(
        id,
        (scores.get(id) ?? 0) + ranking.weight / (rankConstant + index + 1),
      );
    });
  }
  for (const [id, score] of scores) {
    scores.set(id, Math.max(0, Math.min(1, score / maximum)));
  }
  return scores;
}

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
    ...(observation.visualSearchTerms ?? []),
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

function compactIdentityText(observation: ProductObservation): string {
  const visibleIdentity = [
    observation.brand,
    observation.productName,
    observation.modelNumber,
    observation.partNumber,
    observation.variant,
    observation.size
      ? `${observation.size.value} ${observation.size.unit}`
      : null,
  ];
  const hasStrongIdentity = Boolean(
    observation.brand ||
    observation.modelNumber ||
    observation.partNumber ||
    observation.visibleIdentifiers.length > 0,
  );
  return [
    ...visibleIdentity,
    ...(!hasStrongIdentity
      ? [
          observation.subcategory,
          observation.category,
          ...(observation.visualSearchTerms ?? []).slice(0, 5),
        ]
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 500);
}

function broadLexicalQuery(observation: ProductObservation): string {
  const stopWords = new Set(["and", "for", "the", "with", "pack", "product"]);
  return [...tokenize(compactIdentityText(observation))]
    .map((token) => normalizeText(token))
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .slice(0, 18)
    .join(" | ");
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
    imageUrl:
      row.image_url === null ? null : String(row.image_url ?? "") || null,
    sourceProvider:
      row.source_provider === null
        ? null
        : String(row.source_provider ?? "") || null,
    sourceProductId:
      row.source_product_id === null
        ? null
        : String(row.source_product_id ?? "") || null,
    sourceVariantId:
      row.source_variant_id === null
        ? null
        : String(row.source_variant_id ?? "") || null,
    sourceMerchantDomain:
      row.source_merchant_domain === null
        ? null
        : String(row.source_merchant_domain ?? "") || null,
  };
}

async function createEmbedding(input: {
  text: string;
  userId: string;
  scanId: string | null;
}): Promise<number[] | null> {
  const env = getEnvironment();
  if (!env.OPENAI_API_KEY || !input.text) return null;
  const normalizedText = input.text.slice(0, 8_000);
  const digest = createHash("sha256")
    .update(`${env.OPENAI_EMBEDDING_MODEL}:${normalizedText}`)
    .digest("hex");
  try {
    return await rememberJson(`embedding:${digest}`, 30 * 86_400, async () => {
      const response = await meterOpenAiEmbedding({
        userId: input.userId,
        scanId: input.scanId,
        operation: "catalog_query_embedding",
        model: env.OPENAI_EMBEDDING_MODEL,
        request: () =>
          new OpenAI({
            apiKey: env.OPENAI_API_KEY,
            maxRetries: 2,
          }).embeddings.create({
            model: env.OPENAI_EMBEDDING_MODEL,
            input: normalizedText,
            encoding_format: "float",
            dimensions: 1_536,
            user: openAiSafetyIdentifier(input.userId),
          }),
      });
      return response.data[0]?.embedding ?? null;
    });
  } catch (error) {
    if (error instanceof MorrowError && error.code === "AI_BUDGET_EXCEEDED") {
      return null;
    }
    // Dense retrieval is an independent recall channel. A transient model
    // outage must not discard exact identifiers, full-text results, history,
    // or newly discovered UCP products.
    return null;
  }
}

export async function retrieveCandidates(
  input: {
    observation: ProductObservation;
    userId: string;
    scanId?: string;
    preferredProductIds?: string[];
  },
  sql: Sql = getDatabase(),
): Promise<CanonicalProductCandidate[]> {
  const identifiers = identifierValues(input.observation);
  const query = productSearchText(input.observation);
  const identityQuery = compactIdentityText(input.observation);
  const lexicalQuery = broadLexicalQuery(input.observation);
  const embeddingPromise = createEmbedding({
    text: query,
    userId: input.userId,
    scanId: input.scanId ?? null,
  });

  const identifierPromise = identifiers.length
    ? sql`
        select *, 1::float as retrieval_score from canonical_products
        where gtin in ${sql(identifiers)} or upc in ${sql(identifiers)} or ean in ${sql(identifiers)}
          or upper(regexp_replace(coalesce(mpn, ''), '[^A-Za-z0-9]', '', 'g')) in ${sql(identifiers)}
          or upper(regexp_replace(coalesce(model_number, ''), '[^A-Za-z0-9]', '', 'g')) in ${sql(identifiers)}
        limit 20
      `
    : Promise.resolve([]);
  const strictTextPromise = identityQuery
    ? sql`
        select *, ts_rank_cd(search_vector, websearch_to_tsquery('simple', ${identityQuery}))::float as retrieval_score
        from canonical_products
        where search_vector @@ websearch_to_tsquery('simple', ${identityQuery})
        order by retrieval_score desc limit 30
      `
    : Promise.resolve([]);
  const broadTextPromise = lexicalQuery
    ? sql`
        select *, ts_rank_cd(search_vector, to_tsquery('simple', ${lexicalQuery}))::float as retrieval_score
        from canonical_products
        where search_vector @@ to_tsquery('simple', ${lexicalQuery})
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
  const preferredIds = [...new Set(input.preferredProductIds ?? [])];
  const preferredPromise = preferredIds.length
    ? sql`
        select *, 0.35::float as retrieval_score
        from canonical_products where id in ${sql(preferredIds)}
      `
    : Promise.resolve([]);

  const [
    identifierRows,
    strictTextRows,
    broadTextRows,
    historyRows,
    preferredRows,
    embedding,
  ] = await Promise.all([
    identifierPromise,
    strictTextPromise,
    broadTextPromise,
    historyPromise,
    preferredPromise,
    embeddingPromise,
  ]);
  const vectorRows = embedding
    ? await sql`
        select *, (1 - (text_embedding <=> ${`[${embedding.join(",")}]`}::vector))::float as retrieval_score
        from canonical_products where text_embedding is not null
        order by text_embedding <=> ${`[${embedding.join(",")}]`}::vector limit 30
      `
    : [];

  const rowIds = (rows: Iterable<Record<string, unknown>>): string[] =>
    [...rows].map((row) => String(row.id));
  const fusionScores = reciprocalRankFusion([
    { ids: rowIds(identifierRows), weight: 2.5 },
    { ids: rowIds(preferredRows), weight: 1.15 },
    { ids: rowIds(strictTextRows), weight: 1.35 },
    { ids: rowIds(broadTextRows), weight: 0.8 },
    { ids: rowIds(vectorRows), weight: 1.1 },
    { ids: rowIds(historyRows), weight: 0.75 },
  ]);
  const exactIdentifierIds = new Set(rowIds(identifierRows));

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
  ingest(preferredRows, 0.78);
  ingest(strictTextRows, 0.78);
  ingest(broadTextRows, 0.5);
  ingest(vectorRows, 0.62);
  ingest(historyRows, 0.8, true);

  const ranked = [...candidates.values()]
    .map((candidate) => {
      const candidateText = [
        candidate.brand,
        candidate.name,
        candidate.variant,
        candidate.size
          ? `${candidate.size.value} ${candidate.size.unit}`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        ...candidate,
        retrievalScore: exactIdentifierIds.has(candidate.id)
          ? 1
          : Math.max(
              candidate.retrievalScore * 0.55 +
                (fusionScores.get(candidate.id) ?? 0) * 0.45,
              jaccardSimilarity(query, candidateText) * 0.85,
            ),
      };
    })
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, 10);
  if (ranked.length === 0) return [];
  const imageRows = await sql`
    select distinct on (product_id) product_id, image_url
    from product_images
    where product_id in ${sql(ranked.map((candidate) => candidate.id))}
    order by product_id, case when image_type = 'primary' then 0 else 1 end, created_at desc
  `;
  const images = new Map(
    imageRows.map((row) => [String(row.product_id), String(row.image_url)]),
  );
  return ranked.map((candidate) => ({
    ...candidate,
    imageUrl: images.get(candidate.id) ?? candidate.imageUrl ?? null,
  }));
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

export async function getSavedCandidates(
  scanId: string,
  sql: Sql = getDatabase(),
): Promise<CanonicalProductCandidate[]> {
  const rows = await sql`
    select cp.*, sc.retrieval_score, sc.image_score as image_similarity,
      (sc.history_score > 0) as history_match,
      (select pi.image_url from product_images pi where pi.product_id = cp.id
        order by case when pi.image_type = 'primary' then 0 else 1 end, pi.created_at desc
        limit 1) as image_url
    from scan_candidates sc
    join canonical_products cp on cp.id = sc.product_id
    where sc.scan_id = ${scanId}
    order by sc.rank
    limit 10
  `;
  return rows.map((row) => mapCandidate(row));
}

export async function listCandidatesForUser(
  scanId: string,
  userId: string,
  sql: Sql = getDatabase(),
) {
  return sql`
    select sc.rank, sc.retrieval_score, sc.identity_score, sc.purchase_score, sc.classification,
      sc.matched_evidence, sc.contradictions, cp.id, cp.brand, cp.name, cp.variant,
      cp.size_value, cp.size_unit, cp.gtin, cp.model_number, cp.mpn,
      cp.source_provider, cp.source_product_id, cp.source_variant_id,
      cp.source_merchant_domain,
      (select pi.image_url from product_images pi where pi.product_id = cp.id
        order by case when pi.image_type = 'primary' then 0 else 1 end, pi.created_at desc
        limit 1) as image_url
    from scan_candidates sc
    join scans s on s.id = sc.scan_id
    join canonical_products cp on cp.id = sc.product_id
    where sc.scan_id = ${scanId} and s.user_id = ${userId}
    order by sc.rank
    limit 6
  `;
}
